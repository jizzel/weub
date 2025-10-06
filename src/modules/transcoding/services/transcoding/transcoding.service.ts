import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../core/config/prisma/prisma/prisma.service';
import { IStorageService } from '../../../../infrastructure/storage/storage.interface';
import { TranscodingJobData } from '../../../../infrastructure/queue/producer/producer.service';
import { JobStatus } from '../../../../shared/enums/job-status.enum';
import { VideoStatus } from '../../../../shared/enums/video-status.enum';
import {
  TranscodingOutput,
  TranscodingProgress,
  TranscodingResult,
} from '../../../../shared/interfaces/transcoding-job.interface';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { VIDEO_PROCESSING_CONFIG } from '../../../../shared/constants/file-types.constant';

@Injectable()
export class TranscodingService {
  private readonly logger = new Logger(TranscodingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ffmpegService: FfmpegService,
    private readonly configService: ConfigService,
    @Inject('STORAGE_SERVICE') private readonly storageService: IStorageService,
  ) {}

  async processVideo(jobData: TranscodingJobData): Promise<TranscodingResult> {
    const { videoId, inputPath, resolutions } = jobData;
    const startTime = Date.now();

    this.logger.log(`Starting video processing for: ${videoId}`);

    try {
      await this.updateVideoStatus(videoId, VideoStatus.PROCESSING);
      await this.updateJobStatus(videoId, JobStatus.PROCESSING, 0);

      const videoHLSOutputDir = `hls/${videoId}`;
      const thumbnailStoragePath = this.storageService.getThumbnailPath(videoId);

      const onProgress = async (progress: {
        percent: number;
        currentResolution: string;
      }) => {
        const taskProgress =
          ((completedResolutions.length + progress.percent / 100) /
            totalTasks) *
          100;
        await this.updateJobProgress(videoId, {
          percent: Math.round(taskProgress),
          currentResolution: progress.currentResolution,
          completedResolutions: [...completedResolutions],
          currentTask: `Transcoding ${progress.currentResolution}`,
          estimatedTimeRemaining: this.calculateETA(taskProgress, startTime),
        });
      };

      const metadata = await this.ffmpegService.getVideoMetadata(inputPath);
      this.logger.log(
        `Video metadata: ${metadata.width}x${metadata.height}, duration: ${metadata.duration}s`,
      );
      await this.updateVideoMetadata(videoId, metadata);

      const totalTasks = resolutions.length + 1; // +1 for thumbnail
      const completedResolutions: string[] = [];

      const outputs = await this.ffmpegService.transcodeToHLS({
        inputPath,
        outputDir: videoHLSOutputDir,
        resolutions,
        metadata,
        onProgress,
      });

      if (outputs.length === 0) {
        throw new Error('All transcoding attempts failed');
      }

      completedResolutions.push(...outputs.map((o) => o.resolution));

      this.logger.log('Generating thumbnail...');
      await this.updateJobProgress(videoId, {
        percent: Math.round((completedResolutions.length / totalTasks) * 100),
        currentResolution: 'thumbnail',
        completedResolutions,
        currentTask: 'Generating thumbnail',
        estimatedTimeRemaining: this.calculateETA(
          (completedResolutions.length / totalTasks) * 100,
          startTime,
        ),
      });

      const generatedThumbnailPath = await this.ffmpegService.generateThumbnail(
        inputPath,
        thumbnailStoragePath,
        Math.min(10, metadata.duration / 2),
      );

      const masterPlaylistPath = `${videoHLSOutputDir}/master.m3u8`;

      await this.saveOutputsToDatabase(
        videoId,
        outputs,
        generatedThumbnailPath,
        masterPlaylistPath,
      );

      await this.updateVideoStatus(videoId, VideoStatus.READY);
      await this.updateJobStatus(videoId, JobStatus.COMPLETED, 100);

      if (this.configService.get<boolean>('transcoding.cleanupOriginal')) {
        await this.cleanupOriginalFile(inputPath);
      }

      this.logger.log(`Video processing completed for: ${videoId}`);
      return {
        success: true,
        outputs,
        duration: metadata.duration,
        thumbnail: generatedThumbnailPath,
      };
    } catch (error) {
      this.logger.error(`Video processing failed for ${videoId}: ${error}`, error.stack);
      await this.updateVideoStatus(videoId, VideoStatus.FAILED);
      await this.updateJobStatus(videoId, JobStatus.FAILED, 0, error.message);
      return { success: false, outputs: [], error: error.message };
    }
  }

  private async updateVideoStatus(videoId: string, status: VideoStatus): Promise<void> {
    await this.prismaService.video.update({
      where: { id: videoId },
      data: {
        status,
        processedAt: status === VideoStatus.READY ? new Date() : undefined,
        updatedAt: new Date(),
      },
    });
  }

  private async updateVideoMetadata(videoId: string, metadata: any): Promise<void> {
    await this.prismaService.video.update({
      where: { id: videoId },
      data: { durationSeconds: Math.round(Number(metadata.duration)), updatedAt: new Date() },
    });
  }

  private async updateJobStatus(
    videoId: string,
    status: JobStatus,
    progress: number,
    errorMessage?: string,
  ): Promise<void> {
    const updateData: any = { status, progressPercentage: progress, updatedAt: new Date() };
    if (errorMessage) updateData.errorMessage = errorMessage;
    if (status === JobStatus.PROCESSING) updateData.startedAt = new Date();
    if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
      updateData.completedAt = new Date();
    }
    await this.prismaService.transcodingJob.updateMany({ where: { videoId }, data: updateData });
  }

  private async updateJobProgress(videoId: string, progress: TranscodingProgress): Promise<void> {
    await this.prismaService.transcodingJob.updateMany({
      where: { videoId },
      data: { progressPercentage: progress.percent, jobData: { ...progress, updatedAt: new Date() } },
    });
  }

  private async saveOutputsToDatabase(
    videoId: string,
    outputs: TranscodingOutput[],
    thumbnailPath: string = '',
    masterPlaylistPath: string,
  ): Promise<void> {
    for (const output of outputs) {
      await this.prismaService.videoOutput.create({
        data: {
          videoId,
          resolution: output.resolution,
          width: output.width,
          height: output.height,
          bitrate: output.bitrate,
          playlistPath: output.playlistPath,
          segmentDirectory: this.storageService.getHLSOutputPath(
            videoId,
            output.resolution,
          ),
          fileSize: BigInt(output.fileSize),
          segmentCount: output.segmentPaths?.length || 0,
          segmentDuration: VIDEO_PROCESSING_CONFIG.segmentDuration,
          status: 'READY',
          completedAt: new Date(),
        },
      });
    }
    await this.prismaService.video.update({
      where: { id: videoId },
      data: { thumbnailPath },
    });
    this.logger.log(`Saved ${outputs.length} outputs to database for video: ${videoId}`);
  }

  private calculateETA(progressPercent: number, startTime: number): number {
    if (progressPercent <= 0) return 0;
    const elapsed = Date.now() - startTime;
    const totalEstimated = (elapsed / progressPercent) * 100;
    const remaining = totalEstimated - elapsed;
    return Math.max(0, Math.round(remaining / 1000));
  }

  private async cleanupOriginalFile(filePath: string): Promise<void> {
    try {
      await this.storageService.deleteFile(filePath);
      this.logger.log(`Cleaned up original file from storage: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup original file from storage: ${error.message}`);
    }
  }
}
