import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
  JOB_PRIORITIES,
  JOB_TYPES,
  QUEUE_NAMES,
} from '../../../shared/constants/queue-names.constant';

export interface TranscodingJobData {
  videoId: string;
  inputPath: string;
  outputDir: string;
  resolutions: string[];
  generateThumbnail?: boolean;
  onProgress?: (progress: {
    percent: number;
    currentResolution: string;
  }) => void;
}

export interface ThumbnailJobData {
  videoId: string;
  inputPath: string;
  outputPath: string;
  timestamp?: number; // seconds into video
}

@Injectable()
export class ProducerService {
  constructor(
    @InjectQueue(QUEUE_NAMES.TRANSCODING) private transcodingQueue: Queue,
  ) {}
  private readonly logger = new Logger(ProducerService.name);

  async addTranscodingJob(
    jobData: TranscodingJobData,
    priority: number = JOB_PRIORITIES.NORMAL,
  ): Promise<Job> {
    try {
      const job = await this.transcodingQueue.add(
        JOB_TYPES.HLS_TRANSCODE,
        jobData,
        {
          priority,
          delay: 0,
          jobId: `transcode-${jobData.videoId}`,
        },
      );

      // await this.updateJobInDatabase(jobData.videoId, {
      //   status: 'QUEUED',
      //   jobData: jobData,
      // });

      this.logger.log(`Transcoding job queued for video ${jobData.videoId}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to queue transcoding job: ${error.message}`);
      throw error;
    }
  }

  // async addThumbnailJob(
  //   jobData: ThumbnailJobData,
  //   priority: number = JOB_PRIORITIES.NORMAL,
  // ): Promise<Job> {
  //   try {
  //     const job = await this.transcodingQueue.add(
  //       JOB_TYPES.THUMBNAIL_GENERATE,
  //       jobData,
  //       {
  //         priority,
  //         delay: 0,
  //         jobId: `thumbnail-${jobData.videoId}`,
  //       },
  //     );
  //
  //     this.logger.log(`Thumbnail job queued for video ${jobData.videoId}`);
  //     return job;
  //   } catch (error) {
  //     this.logger.error(`Failed to queue thumbnail job: ${error.message}`);
  //     throw error;
  //   }
  // }

  async getJobProgress(videoId: string): Promise<any> {
    try {
      const job = await this.transcodingQueue.getJob(`transcode-${videoId}`);
      if (!job) return null;

      return {
        id: job.id,
        progress: job.progress(),
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        data: job.data,
      };
    } catch (error) {
      this.logger.error(`Failed to get job progress: ${error.message}`);
      return null;
    }
  }

  async retryFailedJob(videoId: string): Promise<Job | null> {
    try {
      const job = await this.transcodingQueue.getJob(`transcode-${videoId}`);
      if (!job) return null;

      await job.retry();

      // await this.updateJobInDatabase(videoId, {
      //   status: 'RETRYING',
      //   attemptCount: job.attemptsMade + 1,
      // });

      this.logger.log(`Retrying job for video ${videoId}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to retry job: ${error.message}`);
      throw error;
    }
  }

  async getQueueStats(): Promise<any> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.transcodingQueue.getWaiting(),
        this.transcodingQueue.getActive(),
        this.transcodingQueue.getCompleted(),
        this.transcodingQueue.getFailed(),
        this.transcodingQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        total: waiting.length + active.length + completed.length + failed.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue stats: ${error.message}`);
      return null;
    }
  }

  // private async updateJobInDatabase(videoId: string, updates: any): Promise<void> {
  //   try {
  //     await this.databaseService.transcodingJob.updateMany({
  //       where: { videoId },
  //       data: updates,
  //     });
  //   } catch (error) {
  //     this.logger.error(`Failed to update job in database: ${error.message}`);
  //   }
  // }
}
