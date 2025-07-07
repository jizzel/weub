import { Logger } from '@nestjs/common';
import { QUEUE_NAMES } from '../../../shared/constants/queue-names.constant';
import { JobStatus } from '../../../shared/enums/job-status.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { TranscodingService } from '../../../modules/transcoding/services/transcoding/transcoding.service';
import { PrismaService } from '../../../core/config/prisma/prisma/prisma.service';
import { TranscodingJobData } from '../producer/producer.service';

@Processor(QUEUE_NAMES.TRANSCODING)
export class ConsumerService extends WorkerHost {
  private readonly logger = new Logger(ConsumerService.name);

  constructor(
    private readonly transcodingService: TranscodingService,
    private readonly prismaService: PrismaService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<void> {
    const { videoId, inputPath, title, originalFilename } = job.data;

    this.logger.log(
      `Processing transcoding job ${job.id} for video: ${videoId}`,
    );

    try {
      // Update job status in database
      await this.updateJobStatus(
        videoId as string,
        job.id as string,
        JobStatus.PROCESSING,
      );

      // Set up progress reporting
      let lastReportedProgress = 0;
      const reportProgress = (percent: number) => {
        // Only report progress if it changed by at least 1%
        if (Math.abs(percent - lastReportedProgress) >= 1) {
          // await job.progress(percent); Todo: Uncomment if you want to use Bull's built-in progress reporting
          lastReportedProgress = percent;
          this.logger.debug(`Job ${job.id} progress: ${percent}%`);
        }
      };

      // Add progress callback to job data
      const jobDataWithProgress = {
        ...job.data,
        onProgress: reportProgress,
      };

      // Process the video
      const result = await this.transcodingService.processVideo(
        jobDataWithProgress as TranscodingJobData,
      );

      if (result.success) {
        // await job.progress(100);
        await this.updateJobStatus(
          videoId as string,
          job.id as string,
          JobStatus.COMPLETED,
          result,
        );
        this.logger.log(`Transcoding job ${job.id} completed successfully`);
      } else {
        throw new Error(result.error || 'Transcoding failed');
      }
    } catch (error) {
      this.logger.error(
        `Transcoding job ${job.id} failed: ${error.message}`,
        error.stack,
      );

      // Update job status as failed
      await this.updateJobStatus(
        videoId as string,
        job.id as string,
        JobStatus.FAILED,
        null,
        error.message,
      );

      // Re-throw error to let Bull handle retry logic
      throw error;
    }
  }

  private async updateJobStatus(
    videoId: string,
    jobId: string,
    status: JobStatus,
    result?: any,
    errorMessage?: string,
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date(),
      };

      if (status === JobStatus.PROCESSING) {
        updateData.startedAt = new Date();
        updateData.workerId = jobId; // process.pid.toString(); // Use process ID as worker ID
      }

      if (status === JobStatus.COMPLETED) {
        updateData.completedAt = new Date();
        updateData.resultData = result;
        updateData.progressPercentage = 100;
      }

      if (status === JobStatus.FAILED) {
        updateData.completedAt = new Date();
        updateData.errorMessage = errorMessage;
      }

      await this.prismaService.transcodingJob.updateMany({
        where: { videoId },
        data: updateData,
      });

      // Also increment attempt count
      if (status === JobStatus.FAILED) {
        await this.prismaService.transcodingJob.updateMany({
          where: { videoId },
          data: {
            attemptCount: {
              increment: 1,
            },
          },
        });
      }
    } catch (dbError) {
      this.logger.error(
        `Failed to update job status in database: ${dbError.message}`,
      );
    }
  }
}
