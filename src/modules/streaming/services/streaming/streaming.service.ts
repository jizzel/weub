import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../core/config/prisma/prisma/prisma.service';
import { VideoNotFoundException } from '../../../../core/exceptions/custom-exceptions';
import { VideoStatus } from '../../../../shared/enums/video-status.enum';
import { IStorageService } from '../../../../infrastructure/storage/storage.interface';

@Injectable()
export class StreamingService {
  private readonly logger = new Logger(StreamingService.name);

  constructor(
    private readonly prismaService: PrismaService,
    @Inject('STORAGE_SERVICE') private readonly storageService: IStorageService,
  ) {}

  async getPlaylist(videoId: string, resolution: string): Promise<string> {
    await this.verifyVideoReady(videoId);
    const videoOutput = await this.prismaService.videoOutput.findFirst({
      where: { videoId, resolution, status: 'READY' },
    });

    if (!videoOutput) {
      throw new VideoNotFoundException(
        `Resolution ${resolution} not available for video ${videoId}`,
      );
    }

    const playlistPath = this.storageService.getPlaylistPath(
      videoId,
      resolution,
    );

    try {
      const playlistBuffer = await this.storageService.getFile(playlistPath);
      return playlistBuffer.toString('utf-8');
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
    await this.verifyVideoReady(videoId);
    const videoOutput = await this.prismaService.videoOutput.findFirst({
      where: { videoId, resolution, status: 'READY' },
    });

    if (!videoOutput) {
      throw new VideoNotFoundException(
        `Resolution ${resolution} not available for video ${videoId}`,
      );
    }

    const segmentPath = this.storageService.getSegmentPath(
      videoId,
      resolution,
      segmentName,
    );

    try {
      return await this.storageService.getFile(segmentPath);
    } catch (error) {
      this.logger.error(
        `Failed to read segment file: ${segmentPath} - ${error.message}`,
      );
      throw new Error(`Segment file not found: ${segmentPath}`);
    }
  }

  async getThumbnail(videoId: string): Promise<Buffer> {
    await this.verifyVideoReady(videoId);
    const thumbnailPath = this.storageService.getThumbnailPath(videoId);

    try {
      return await this.storageService.getFile(thumbnailPath);
    } catch (error) {
      this.logger.error(
        `Failed to read thumbnail file: ${thumbnailPath} - ${error.message}`,
      );
      throw new Error(`Thumbnail file not found: ${thumbnailPath}`);
    }
  }

  async getMasterPlaylist(videoId: string): Promise<string> {
    await this.verifyVideoReady(videoId);
    const videoOutputs = await this.prismaService.videoOutput.findMany({
      where: { videoId, status: 'READY' },
      orderBy: { bitrate: 'asc' },
    });

    if (videoOutputs.length === 0) {
      throw new VideoNotFoundException(
        `No ready outputs found for video ${videoId}`,
      );
    }

    return this.generateMasterPlaylistContent(videoId, videoOutputs);
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
      select: { id: true, status: true, title: true },
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
    const segmentRegex = /^segment_\d{3}\.ts$/;
    return segmentRegex.test(segmentName);
  }

  async getVideoStreamingInfo(videoId: string) {
    const video = await this.verifyVideoReady(videoId);
    const videoOutputs = await this.prismaService.videoOutput.findMany({
      where: { videoId, status: 'READY' },
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
