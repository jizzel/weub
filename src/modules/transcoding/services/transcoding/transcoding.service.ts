import { Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { promises as fs } from 'fs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../core/config/prisma/prisma/prisma.service';
import { FfmpegService } from '../ffmpeg/ffmpeg.service';
import { TranscodingJobData } from '../../../../infrastructure/queue/producer/producer.service';
import {
  TranscodingOutput,
  TranscodingProgress,
  TranscodingResult,
} from '../../../../shared/interfaces/transcoding-job.interface';
import { VideoStatus } from '../../../../shared/enums/video-status.enum';
import { JobStatus } from '../../../../shared/enums/job-status.enum';
import { resolve } from 'path';


@Injectable()
export class TranscodingService {
  private readonly logger = new Logger(TranscodingService.name);
  private readonly hlsOutputDir: string;

  private readonly thumbnailOutputDir: string;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly ffmpegService: FfmpegService,
    private readonly configService: ConfigService,
  ) {
    this.hlsOutputDir =
      this.configService.get<string>('storage.hlsPath') ||
      resolve(process.cwd(), '..', 'storage/hls');
      // join(process.cwd(), 'storage/hls');
    this.thumbnailOutputDir =
      this.configService.get<string>('storage.thumbnailPath') ||
      resolve(process.cwd(), '..', 'storage/thumbnails');
      // join(process.cwd(), 'storage/thumbnails');
  }

  async processVideo(jobData: TranscodingJobData): Promise<TranscodingResult> {
    const { videoId, inputPath, resolutions } = jobData;
    const startTime = Date.now();

    this.logger.log(`Starting video processing for: ${videoId}`);

    try {
      // Update video status to processing
      await this.updateVideoStatus(videoId, VideoStatus.PROCESSING);
      await this.updateJobStatus(videoId, JobStatus.PROCESSING, 0);

      // Create output directories for this video
      const videoOutputDir = join(this.hlsOutputDir, videoId);
      const videoThumbnailDir = join(this.thumbnailOutputDir, videoId);

      // Ensure output directories exist
      await Promise.all([
        fs.mkdir(videoOutputDir, { recursive: true }),
        fs.mkdir(videoThumbnailDir, { recursive: true }),
      ]);

      const currentProgress = 0;
      const totalTasks = resolutions.length; // + 1; // +1 for thumbnail
      const completedResolutions: string[] = [];

      // Progress callback for transcoding
      const onProgress = async (progress: {
        percent: number;
        currentResolution: string;
      }) => {
        const taskProgress =
          ((currentProgress + progress.percent / 100) / totalTasks) * 100;
        await this.updateJobProgress(videoId, {
          percent: Math.round(taskProgress),
          currentResolution: progress.currentResolution,
          completedResolutions: [...completedResolutions],
          currentTask: `Transcoding ${progress.currentResolution}`,
          estimatedTimeRemaining: this.calculateETA(taskProgress, startTime),
        });
      };

      // Get video metadata first
      const metadata = await this.ffmpegService.getVideoMetadata(inputPath);
      this.logger.log(
        `Video metadata: ${metadata.width}x${metadata.height}, duration: ${metadata.duration}s`,
      );

      // Update video with metadata
      await this.updateVideoMetadata(videoId, metadata);

      // Transcode video to HLS using the corrected method
      const outputs = await this.ffmpegService.transcodeToHLS({
        inputPath,
        outputDir: videoOutputDir,
        resolutions,
        metadata,
        onProgress: (progress) => void onProgress(progress),
      });

      if (outputs.length === 0) {
        throw new Error('All transcoding attempts failed');
      }

      // Update progress for completed transcoding
      // currentProgress = resolutions.length;

      // Generate thumbnail
      this.logger.log('Generating thumbnail...');
      await this.updateJobProgress(videoId, {
        percent: Math.round((currentProgress / totalTasks) * 100),
        currentResolution: 'thumbnail',
        completedResolutions: outputs.map((o) => o.resolution),
        currentTask: 'Generating thumbnail',
        estimatedTimeRemaining: this.calculateETA(
          (currentProgress / totalTasks) * 100,
          startTime,
        ),
      });

      const thumbnailPath = await this.ffmpegService.generateThumbnail(
        inputPath,
        videoThumbnailDir,
        Math.min(10, metadata.duration / 2), // 10 seconds or half duration
      );

      // Generate master playlist (this is now handled by FfmpegService)
      const masterPlaylistPath = join(videoOutputDir, 'master.m3u8');

      // Save outputs to database
      await this.saveOutputsToDatabase(
        videoId,
        outputs,
        thumbnailPath,
        masterPlaylistPath,
      );

      // Update video status to ready
      await this.updateVideoStatus(videoId, VideoStatus.READY);
      await this.updateJobStatus(videoId, JobStatus.COMPLETED, 100);

      // Optionally clean up original file
      if (
        this.configService.get<boolean>('transcoding.cleanupOriginal', false)
      ) {
        await this.cleanupOriginalFile(inputPath);
      }

      this.logger.log(
        `Video processing completed successfully for: ${videoId}`,
      );

      return {
        success: true,
        outputs,
        duration: metadata.duration,
        thumbnail: thumbnailPath,
      };
    } catch (error) {
      this.logger.error(
        `Video processing failed for ${videoId}: ${error}`,
        error.stack,
      );

      // Update status as failed
      await this.updateVideoStatus(videoId, VideoStatus.FAILED);
      await this.updateJobStatus(videoId, JobStatus.FAILED, 0, error.message);

      return {
        success: false,
        outputs: [],
        error: error.message,
      };
    }
  }

  private async updateVideoStatus(
    videoId: string,
    status: VideoStatus,
  ): Promise<void> {
    try {
      await this.prismaService.video.update({
        where: { id: videoId },
        data: {
          status,
          processedAt: status === VideoStatus.READY ? new Date() : undefined,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update video status: ${error.message}`);
    }
  }

  private async updateVideoMetadata(
    videoId: string,
    metadata: any,
  ): Promise<void> {
    try {
      await this.prismaService.video.update({
        where: { id: videoId },
        data: {
          durationSeconds: Math.round(Number(metadata.duration)),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update video metadata: ${error.message}`);
    }
  }

  private async updateJobStatus(
    videoId: string,
    status: JobStatus,
    progress: number,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        progressPercentage: progress,
        updatedAt: new Date(),
      };

      if (errorMessage) {
        updateData.errorMessage = errorMessage;
      }

      if (status === JobStatus.PROCESSING) {
        updateData.startedAt = new Date();
      }

      if (status === JobStatus.COMPLETED || status === JobStatus.FAILED) {
        updateData.completedAt = new Date();
      }

      await this.prismaService.transcodingJob.updateMany({
        where: { videoId },
        data: updateData,
      });
    } catch (error) {
      this.logger.error(`Failed to update job status: ${error.message}`);
    }
  }

  private async updateJobProgress(
    videoId: string,
    progress: TranscodingProgress,
  ): Promise<void> {
    try {
      await this.prismaService.transcodingJob.updateMany({
        where: { videoId },
        data: {
          progressPercentage: progress.percent,
          jobData: {
            ...progress,
            updatedAt: new Date(),
          },
          // updatedAt: new Date(),
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update job progress: ${error.message}`);
    }
  }

  private async saveOutputsToDatabase(
    videoId: string,
    outputs: TranscodingOutput[],
    thumbnailPath: string = '',
    masterPlaylistPath: string,
  ): Promise<void> {
    try {
      // Save video outputs
      for (const output of outputs) {
        await this.prismaService.videoOutput.create({
          data: {
            videoId,
            resolution: output.resolution,
            width: output.width,
            height: output.height,
            bitrate: output.bitrate,
            playlistPath: output.playlistPath,
            segmentDirectory: join(
              this.hlsOutputDir,
              videoId,
              output.resolution,
            ),
            fileSize: BigInt(output.fileSize),
            segmentCount: output.segmentPaths?.length || 0,
            segmentDuration: 10.0, // Default HLS segment duration
            status: 'READY',
            completedAt: new Date(),
          },
        });
      }

      // Update video with thumbnail path
      await this.prismaService.video.update({
        where: { id: videoId },
        data: {
          thumbnailPath: thumbnailPath,
          // masterPlaylistPath could also be stored here if needed
        },
      });

      this.logger.log(
        `Saved ${outputs.length} outputs to database for video: ${videoId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to save outputs to database: ${error.message}`);
      throw error;
    }
  }

  private calculateETA(progressPercent: number, startTime: number): number {
    if (progressPercent <= 0) return 0;

    const elapsed = Date.now() - startTime;
    const totalEstimated = (elapsed / progressPercent) * 100;
    const remaining = totalEstimated - elapsed;

    return Math.max(0, Math.round(remaining / 1000)); // Return seconds
  }

  private async cleanupOriginalFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      this.logger.log(`Cleaned up original file: ${filePath}`);
    } catch (error) {
      this.logger.warn(`Failed to cleanup original file: ${error.message}`);
    }
  }

  // Public methods for external use
  // async getJobProgress(videoId: string): Promise<TranscodingProgress | null> {
  //   try {
  //     const job = await this.prismaService.transcodingJob.findFirst({
  //       where: { videoId },
  //       orderBy: { createdAt: 'desc' },
  //     });
  //
  //     if (!job) return null;
  //
  //     return {
  //       percent: job.progressPercentage,
  //       currentResolution: job.jobData?.currentResolution || '',
  //       completedResolutions: job.jobData?.completedResolutions || [],
  //       estimatedTimeRemaining: job.jobData?.estimatedTimeRemaining,
  //       currentTask: job.jobData?.currentTask || 'Processing...',
  //     };
  //   } catch (error) {
  //     this.logger.error(`Failed to get job progress: ${error.message}`);
  //     return null;
  //   }
  // }

  // async retryFailedJob(videoId: string): Promise<boolean> {
  //   try {
  //     const video = await this.prismaService.video.findUnique({
  //       where: { id: videoId },
  //     });
  //
  //     if (!video || video.status !== VideoStatus.FAILED) {
  //       return false;
  //     }
  //
  //     // Reset video status
  //     await this.updateVideoStatus(videoId, VideoStatus.PENDING);
  //
  //     // Create new transcoding job
  //     const jobData: TranscodingJobData = {
  //       videoId,
  //       inputPath: video.uploadPath,
  //       outputDir: join(this.hlsOutputDir, videoId),
  //       resolutions: ['480p', '720p', '1080p'], // Default or get from config
  //     };
  //
  //     await this.queueService.addTranscodingJob(jobData);
  //
  //     this.logger.log(`Retrying failed job for video: ${videoId}`);
  //     return true;
  //   } catch (error) {
  //     this.logger.error(`Failed to retry job: ${error.message}`);
  //     return false;
  //   }
  // }
}
