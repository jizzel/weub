import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { PrismaService } from '../../../../core/config/prisma/prisma/prisma.service';
import { StorageService } from '../../../../infrastructure/storage/storage/storage.service';
import { VideoNotFoundException } from '../../../../core/exceptions/custom-exceptions';
import { VideoStatus } from '../../../../shared/enums/video-status.enum';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async getPlaylist(videoId: string, resolution: string): Promise<string> {
    // Verify video exists and is ready
    await this.verifyVideoReady(videoId);

    // Verify resolution exists for this video
    const videoOutput = await this.prismaService.videoOutput.findFirst({
      where: {
        videoId,
        resolution,
        status: 'READY',
      },
    });

    if (!videoOutput) {
      throw new VideoNotFoundException(
        `Resolution ${resolution} not available for video ${videoId}`,
      );
    }

    // Get playlist content from storage
    const playlistPath = this.storageService.getPlaylistPath(
      videoId,
      resolution,
    );

    try {
      const playlistContent = await fs.readFile(playlistPath, 'utf-8');
      return playlistContent;
    } catch (error) {
      this.logger.error(
        `Failed to read playlist file: ${playlistPath} - ${error.message}`,
      );
      throw new Error(`Playlist file not found: ${playlistPath}`);
    }
  }

  async getSegment(
    videoId: string,
    resolution: string,
    segmentName: string,
  ): Promise<Buffer> {
    // Verify video exists and is ready
    await this.verifyVideoReady(videoId);

    // Verify resolution exists for this video
    const videoOutput = await this.prismaService.videoOutput.findFirst({
      where: {
        videoId,
        resolution,
        status: 'READY',
      },
    });

    if (!videoOutput) {
      throw new VideoNotFoundException(
        `Resolution ${resolution} not available for video ${videoId}`,
      );
    }

    // Get segment from storage
    const segmentPath = this.storageService.getSegmentPath(
      videoId,
      resolution,
      segmentName,
    );

    try {
      const segmentBuffer = await fs.readFile(segmentPath);
      return segmentBuffer;
    } catch (error) {
      this.logger.error(
        `Failed to read segment file: ${segmentPath} - ${error.message}`,
      );
      throw new Error(`Segment file not found: ${segmentPath}`);
    }
  }

  async getThumbnail(videoId: string): Promise<Buffer> {
    // Verify video exists and is ready
    await this.verifyVideoReady(videoId);

    // Get thumbnail from storage
    const thumbnailPath = this.storageService.getThumbnailPath(videoId);

    try {
      const thumbnailBuffer = await fs.readFile(thumbnailPath);
      return thumbnailBuffer;
    } catch (error) {
      this.logger.error(
        `Failed to read thumbnail file: ${thumbnailPath} - ${error.message}`,
      );
      throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
    }
  }

  async getMasterPlaylist(videoId: string): Promise<string> {
    // Verify video exists and is ready
    const video = await this.verifyVideoReady(videoId);

    // Get all available resolutions for this video
    const videoOutputs = await this.prismaService.videoOutput.findMany({
      where: {
        videoId,
        status: 'READY',
      },
      orderBy: {
        bitrate: 'asc', // Order by bitrate ascending (lowest quality first)
      },
    });

    if (videoOutputs.length === 0) {
      throw new VideoNotFoundException(
        `No ready outputs found for video ${videoId}`,
      );
    }

    // Generate master playlist content
    const masterPlaylistContent = this.generateMasterPlaylistContent(
      videoId,
      videoOutputs,
    );

    return masterPlaylistContent;
  }

  private generateMasterPlaylistContent(
    videoId: string,
    videoOutputs: any[],
  ): string {
    let playlist = '#EXTM3U\n#EXT-X-VERSION:6\n\n';

    for (const output of videoOutputs) {
      playlist += `#EXT-X-STREAM-INF:BANDWIDTH=${output.bitrate * 1000},RESOLUTION=${output.width}x${output.height}\n`;
      playlist += `${output.resolution}/playlist.m3u8\n`;
    }

    return playlist;
  }

  private async verifyVideoReady(videoId: string) {
    const video = await this.prismaService.video.findUnique({
      where: { id: videoId },
      select: {
        id: true,
        status: true,
        title: true,
      },
    });

    if (!video) {
      throw new VideoNotFoundException(videoId);
    }

    if (video.status !== VideoStatus.READY) {
      throw new VideoNotFoundException(
        `Video ${videoId} is not ready for streaming (status: ${video.status})`,
      );
    }

    return video;
  }

  isValidSegmentName(segmentName: string): boolean {
    // Validate segment name format: segment_0000.ts
    const segmentRegex = /^segment_\d{3}\.ts$/;
    return segmentRegex.test(segmentName);
  }

  async getVideoStreamingInfo(videoId: string) {
    const video = await this.verifyVideoReady(videoId);

    const videoOutputs = await this.prismaService.videoOutput.findMany({
      where: {
        videoId,
        status: 'READY',
      },
      select: {
        resolution: true,
        width: true,
        height: true,
        bitrate: true,
        segmentCount: true,
        fileSize: true,
      },
    });

    return {
      videoId: video.id,
      title: video.title,
      masterPlaylistUrl: `/api/v1/stream/${videoId}/master.m3u8`,
      thumbnailUrl: `/api/v1/videos/${videoId}/thumbnail`,
      resolutions: videoOutputs.map((output) => ({
        resolution: output.resolution,
        width: output.width,
        height: output.height,
        bitrate: output.bitrate,
        segmentCount: output.segmentCount,
        fileSize: output.fileSize,
        playlistUrl: `/api/v1/stream/${videoId}/${output.resolution}/playlist.m3u8`,
      })),
    };
  }
}
