import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CreateVideoDto } from '../dto/create-video.dto';
import { VideoSearchDto } from '../dto/video-search.dto';
import { VideoUploadService } from './video-upload.service';
import { ValidationUtils } from '../../../shared/utils/validation.utils';
import { FileUtils } from '../../../shared/utils/file.utils';
import {
  VideoUploadResponseDto,
  VideoDetailResponseDto,
  VideoListItemDto,
} from '../dto/video-response.dto';
import {
  PaginatedResponseDto,
  PaginationMetaDto,
} from '../../../shared/dto/pagination.dto';
import { VideoStatus } from '../../../shared/enums/video-status.enum';
import { PrismaService } from '../../../core/config/prisma/prisma/prisma.service';
import { VideoStatusResponseDto } from '../dto/video-status.dto';
import {
  ProducerService,
  TranscodingJobData,
} from '../../../infrastructure/queue/producer/producer.service';
import { IStorageService } from '../../../infrastructure/storage/storage.interface';

@Injectable()
export class VideosService {
  private readonly logger = new Logger(VideosService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly videoUploadService: VideoUploadService,
    private readonly queueService: ProducerService,
    @Inject('STORAGE_SERVICE') private readonly storageService: IStorageService,
  ) {}

  async uploadVideo(
    file: Express.Multer.File,
    createVideoDto: CreateVideoDto,
  ): Promise<VideoUploadResponseDto> {
    // Validate input
    ValidationUtils.validateTitle(createVideoDto.title);
    if (createVideoDto.tags) {
      ValidationUtils.validateTags(createVideoDto.tags);
    }

    try {
      // Upload file to storage
      const uploadPath = await this.videoUploadService.uploadVideo(file);

      // Create video record in database
      const video = await this.prismaService.video.create({
        data: {
          title: createVideoDto.title.trim(),
          description: createVideoDto.description?.trim(),
          tags: createVideoDto.tags || [],
          originalFilename: file.originalname,
          fileExtension: FileUtils.getFileExtension(file.originalname),
          fileSize: BigInt(file.size),
          mimeType: file.mimetype,
          uploadPath,
          status: 'PENDING',
        },
      });

      // Create transcoding job (will be implemented with queue system)
      await this.createTranscodingJob(video.id, uploadPath);

      this.logger.log(`Video created successfully: ${video.id}`);

      return {
        id: video.id,
        title: video.title,
        status: VideoStatus.PENDING,
        originalFilename: video.originalFilename,
        fileSize: Number(video.fileSize),
        uploadedAt: video.createdAt,
        estimatedProcessingTime: this.estimateProcessingTime(
          Number(video.fileSize),
        ),
      };
    } catch (error) {
      this.logger.error(`Failed to upload video: ${error.message}`);
      throw error;
    }
  }

  async findVideos(
    searchDto: VideoSearchDto,
  ): Promise<PaginatedResponseDto<VideoListItemDto>> {
    const {
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      search,
      tags,
      dateFrom,
      dateTo,
      resolution,
    } = searchDto;

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status.toUpperCase();
    }

    if (search) {
      where.title = {
        contains: search,
        mode: 'insensitive',
      };
    }

    if (tags && tags.length > 0) {
      where.tags = {
        hasEvery: tags,
      };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }

    // If filtering by resolution, only include videos that have that resolution
    if (resolution) {
      where.outputs = {
        some: {
          resolution: resolution,
          status: 'READY',
        },
      };
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count and videos
    const [totalItems, videos] = await Promise.all([
      this.prismaService.video.count({ where }),
      this.prismaService.video.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: sortOrder },
        include: {
          outputs: {
            where: { status: 'READY' },
            select: {
              resolution: true,
              playlistPath: true,
            },
          },
        },
      }),
    ]);

    // Transform to DTOs
    const videoList = videos.map((video) => this.transformToListItem(video));

    const pagination = new PaginationMetaDto(page, totalItems, limit);

    return new PaginatedResponseDto(videoList, pagination);
  }

  async findVideoById(id: string): Promise<VideoDetailResponseDto> {
    const video = await this.prismaService.video.findUnique({
      where: { id },
      include: {
        outputs: {
          select: {
            id: true,
            resolution: true,
            width: true,
            height: true,
            bitrate: true,
            fileSize: true,
            status: true,
            playlistPath: true,
          },
        },
        transcodingJobs: {
          select: {
            status: true,
            createdAt: true,
            completedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!video) {
      throw new NotFoundException({
        code: 'VIDEO_NOT_FOUND',
        message: `Video with ID ${id} not found`,
      });
    }

    return this.transformToDetailResponse(video);
  }

  async getVideoStatus(id: string): Promise<VideoStatusResponseDto> {
    const video = await this.prismaService.video.findUnique({
      where: { id },
      include: {
        outputs: {
          select: {
            resolution: true,
            status: true,
          },
        },
        transcodingJobs: {
          select: {
            status: true,
            progressPercentage: true,
            updatedAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!video) {
      throw new NotFoundException({
        code: 'VIDEO_NOT_FOUND',
        message: `Video with ID ${id} not found`,
      });
    }

    const completedResolutions = video.outputs
      .filter((output) => output.status === 'READY')
      .map((output) => output.resolution);

    const failedResolutions = video.outputs
      .filter((output) => output.status === 'FAILED')
      .map((output) => output.resolution);

    const latestJob = video.transcodingJobs[0];

    return {
      id: video.id,
      status: video.status.toLowerCase() as VideoStatus,
      progress: latestJob?.progressPercentage || 0,
      estimatedTimeRemaining: this.calculateTimeRemaining(
        latestJob?.progressPercentage || 0,
      ),
      currentTask: this.getCurrentTask(video.status, completedResolutions),
      completedResolutions,
      failedResolutions,
      lastUpdated: video.updatedAt,
    };
  }

  async deleteVideo(id: string): Promise<string> {
    const video = await this.prismaService.video.findUnique({
      where: { id },
      include: { outputs: true },
    });

    if (!video) {
      throw new NotFoundException(`Video with ID ${id} not found`);
    }

    this.logger.log(`Starting deletion process for video: ${id}`);

    // 1. Collect all file paths to delete
    const pathsToDelete: string[] = [];
    if (video.uploadPath) {
      pathsToDelete.push(video.uploadPath);
    }
    if (video.thumbnailPath) {
      pathsToDelete.push(video.thumbnailPath);
    }

    // HLS files are stored in a directory per video, e.g., hls/<videoId>/
    const hlsDirectory = `hls/${video.id}`;

    // 2. Delete files from storage
    try {
      // Delete individual files
      for (const path of pathsToDelete) {
        if (await this.storageService.fileExists(path)) {
          await this.storageService.deleteFile(path);
          this.logger.log(`Deleted file from storage: ${path}`);
        }
      }

      // Delete the entire HLS directory for the video
      await this.storageService.deleteDirectory(hlsDirectory);
      this.logger.log(`Deleted directory from storage: ${hlsDirectory}`);
    } catch (error) {
      this.logger.error(
        `Error deleting files from storage for video ${id}: ${error.message}`,
      );
      // We can choose to continue and delete the DB record anyway, or throw
      // For now, we log the error and proceed with DB deletion.
    }

    // 3. Delete database records in a transaction
    try {
      await this.prismaService.$transaction([
        // Delete related records first
        this.prismaService.videoOutput.deleteMany({ where: { videoId: id } }),
        this.prismaService.transcodingJob.deleteMany({ where: { videoId: id } }),
        // Finally, delete the main video record
        this.prismaService.video.delete({ where: { id } }),
      ]);
      this.logger.log(
        `Successfully deleted database records for video: ${id}`,
      );
    } catch (error) {
      this.logger.error(
        `Error deleting database records for video ${id}: ${error.message}`,
      );
      // If DB deletion fails, we have an orphaned file situation.
      // This requires a more complex cleanup strategy (e.g., a cron job).
      throw new Error('Failed to delete video from database.');
    }

    return `Successfully deleted video ${id} and all associated files.`;
  }

  private async createTranscodingJob(
    videoId: string,
    path: string,
  ): Promise<void> {
    this.logger.log(`Creating transcoding job for video ${videoId}`);

    await this.prismaService.transcodingJob.create({
      data: {
        videoId,
        jobType: 'HLS_TRANSCODE',
        status: 'QUEUED',
        jobData: {
          resolutions: ['480p', '720p', '1080p'],
        },
      },
    });

    const jobData: TranscodingJobData = {
      videoId,
      resolutions: ['480p', '720p', '1080p'],
      inputPath: path,
      outputDir: '',
    };

    // add the job to the queue
    await this.queueService.addTranscodingJob(jobData, 1);
  }

  private transformToListItem(video: any): VideoListItemDto {
    const availableResolutions = video.outputs.map(
      (output) => output.resolution,
    );
    const streamingUrls = video.outputs.reduce((urls, output) => {
      urls[output.resolution] =
        `/api/v1/stream/${video.id}/${output.resolution}/playlist.m3u8`;
      return urls;
    }, {});

    return {
      id: video.id,
      title: video.title,
      description: video.description,
      status: video.status.toLowerCase() as VideoStatus,
      duration: video.durationSeconds,
      fileSize: Number(video.fileSize),
      tags: video.tags,
      thumbnail: // Use the stored path to generate the URL
        video.status === 'READY' && video.thumbnailPath
          ? `/api/v1/videos/${video.id}/thumbnail.jpg`
          : undefined,
      createdAt: video.createdAt,
      processedAt: video.processedAt,
      availableResolutions,
      streamingUrls,
    };
  }

  private transformToDetailResponse(video: any): VideoDetailResponseDto {
    // ... (existing transformToDetailResponse implementation)
    const outputs = video.outputs.map((output) => ({
      resolution: output.resolution,
      width: output.width,
      height: output.height,
      bitrate: output.bitrate,
      fileSize: Number(output.fileSize || 0),
      status: output.status.toLowerCase(),
      playlistUrl: `/api/v1/stream/${video.id}/${output.resolution}/playlist.m3u8`,
    }));

    const availableResolutions = outputs
      .filter((output) => output.status === 'ready')
      .map((output) => output.resolution);

    const streamingUrls = availableResolutions.reduce((urls, resolution) => {
      urls[resolution] =
        `/api/v1/stream/${video.id}/${resolution}/playlist.m3u8`;
      return urls;
    }, {});

    return {
      id: video.id,
      title: video.title,
      description: video.description,
      status: video.status.toLowerCase() as VideoStatus,
      originalFilename: video.originalFilename,
      fileSize: Number(video.fileSize),
      mimeType: video.mimeType,
      duration: video.durationSeconds,
      tags: video.tags,
      createdAt: video.createdAt,
      processedAt: video.processedAt,
      outputs,
      availableResolutions,
      streamingUrls,
      thumbnail: // Use the stored path to generate the URL
        video.status === 'READY' && video.thumbnailPath
          ? `/api/v1/videos/${video.id}/thumbnail.jpg`
          : undefined,
    };
  }

  private estimateProcessingTime(fileSize: number): string {
    // ... (existing estimateProcessingTime implementation)
    const sizeInGB = fileSize / (1024 * 1024 * 1024);
    const minutes = Math.ceil(sizeInGB * 7.5);

    if (minutes < 60) {
      return `${minutes} minutes`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  private calculateTimeRemaining(progress: number): string | undefined {
    // ... (existing calculateTimeRemaining implementation)
    if (progress === 0) return undefined;

    // Simple estimation based on progress
    const remainingPercent = 100 - progress;
    const estimatedMinutes = Math.ceil((remainingPercent / progress) * 5); // Assume 5 minutes per remaining %

    if (estimatedMinutes < 60) {
      return `${estimatedMinutes} minutes`;
    } else {
      const hours = Math.floor(estimatedMinutes / 60);
      const minutes = estimatedMinutes % 60;
      return `${hours}h ${minutes}m`;
    }
  }

  private getCurrentTask(
    status: string,
    completedResolutions: string[],
  ): string | undefined {
    if (status === 'PROCESSING') {
      const resolutions = ['480p', '720p', '1080p'];
      const nextResolution = resolutions.find(
        (res) => !completedResolutions.includes(res),
      );
      return nextResolution
        ? `Transcoding ${nextResolution} resolution`
        : 'Finalizing transcoding';
    }
    return undefined;
  }
}
