import {
  Controller,
  Get,
  Param,
  Res,
  HttpException,
  HttpStatus,
  Logger,
  Header,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { StreamingService } from '../../services/streaming/streaming.service';
import { VideoNotFoundException } from '../../../../core/exceptions/custom-exceptions';

@ApiTags('Video Streaming')
@Controller('api/v1')
export class StreamingController {
  private readonly logger = new Logger(StreamingController.name);

  constructor(private readonly streamingService: StreamingService) {}

  @Get('stream/:videoId/:resolution/playlist.m3u8')
  @ApiOperation({
    summary: 'Get HLS playlist',
    description:
      'Retrieve the HLS resolution-specific playlist for video streaming',
  })
  @ApiParam({
    name: 'videoId',
    description: 'Unique identifier for the video',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'resolution',
    description: 'Video resolution',
    enum: ['480p', '720p', '1080p'],
    example: '1080p',
  })
  @ApiResponse({
    status: 200,
    description: 'HLS playlist file',
    headers: {
      'Content-Type': {
        description: 'MIME type for HLS playlist',
        schema: { type: 'string', example: 'application/vnd.apple.mpegurl' },
      },
      'Cache-Control': {
        description: 'Cache control header',
        schema: { type: 'string', example: 'public, max-age=300' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Video or resolution not found',
  })
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Headers', 'Range')
  async getHLSPlaylist(
    @Param('videoId') videoId: string,
    @Param('resolution') resolution: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(
        `Serving HLS playlist for video ${videoId} at ${resolution}`,
      );

      const playlistContent = await this.streamingService.getPlaylist(
        videoId,
        resolution,
      );

      res.send(playlistContent);
    } catch (error) {
      this.logger.error(
        `Failed to serve playlist for video ${videoId} at ${resolution}: ${error.message}`,
      );

      if (error instanceof VideoNotFoundException) {
        throw error;
      }

      throw new HttpException(
        {
          code: 'PLAYLIST_NOT_FOUND',
          message: `HLS playlist not found for video ${videoId} at ${resolution}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('stream/:videoId/:resolution/:segment')
  @ApiOperation({
    summary: 'Get HLS video segment',
    description: 'Retrieve individual HLS video segments (.ts files)',
  })
  @ApiParam({
    name: 'videoId',
    description: 'Unique identifier for the video',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiParam({
    name: 'resolution',
    description: 'Video resolution',
    enum: ['480p', '720p', '1080p'],
  })
  @ApiParam({
    name: 'segment',
    description: 'Segment filename',
    example: 'segment_0001.ts',
  })
  @ApiResponse({
    status: 200,
    description: 'Video segment binary data',
    headers: {
      'Content-Type': {
        description: 'MIME type for video segments',
        schema: { type: 'string', example: 'video/mp2t' },
      },
      'Cache-Control': {
        description: 'Cache control header for long-term caching',
        schema: { type: 'string', example: 'public, max-age=31536000' },
      },
      'Accept-Ranges': {
        description: 'Accept ranges header',
        schema: { type: 'string', example: 'bytes' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Video segment not found',
  })
  @Header('Content-Type', 'video/mp2t')
  @Header('Cache-Control', 'public, max-age=31536000')
  @Header('Accept-Ranges', 'bytes')
  @Header('Access-Control-Allow-Origin', '*')
  @Header('Access-Control-Allow-Headers', 'Range')
  async getHLSSegment(
    @Param('videoId') videoId: string,
    @Param('resolution') resolution: string,
    @Param('segment') segment: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(
        `Serving HLS segment ${segment} for video ${videoId} at ${resolution}`,
      );

      // Validate segment filename format
      if (!this.streamingService.isValidSegmentName(segment)) {
        throw new HttpException(
          {
            code: 'INVALID_SEGMENT_NAME',
            message: 'Invalid segment filename format',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      const segmentBuffer = await this.streamingService.getSegment(
        videoId,
        resolution,
        segment,
      );

      // Set content length for better streaming performance
      res.setHeader('Content-Length', segmentBuffer.length);
      res.end(segmentBuffer);
    } catch (error) {
      this.logger.error(
        `Failed to serve segment ${segment} for video ${videoId} at ${resolution}: ${error.message}`,
      );

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        {
          code: 'SEGMENT_NOT_FOUND',
          message: `HLS segment not found: ${segment}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('videos/:id/thumbnail')
  @ApiOperation({
    summary: 'Get video thumbnail',
    description: 'Retrieve the thumbnail image for a video',
  })
  @ApiParam({
    name: 'id',
    description: 'Unique identifier for the video',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Thumbnail image (JPEG)',
    headers: {
      'Content-Type': {
        description: 'MIME type for thumbnail image',
        schema: { type: 'string', example: 'image/jpeg' },
      },
      'Cache-Control': {
        description: 'Cache control header',
        schema: { type: 'string', example: 'public, max-age=86400' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Video or thumbnail not found',
  })
  @Header('Content-Type', 'image/jpeg')
  @Header('Cache-Control', 'public, max-age=86400')
  @Header('Access-Control-Allow-Origin', '*')
  async getVideoThumbnail(
    @Param('id') videoId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(`Serving thumbnail for video ${videoId}`);

      const thumbnailBuffer = await this.streamingService.getThumbnail(videoId);

      res.setHeader('Content-Length', thumbnailBuffer.length);
      res.end(thumbnailBuffer);
    } catch (error) {
      this.logger.error(
        `Failed to serve thumbnail for video ${videoId}: ${error.message}`,
      );

      if (error instanceof VideoNotFoundException) {
        throw error;
      }

      throw new HttpException(
        {
          code: 'THUMBNAIL_NOT_FOUND',
          message: `Thumbnail not found for video ${videoId}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }

  @Get('stream/:videoId/master.m3u8')
  @ApiOperation({
    summary: 'Get HLS master playlist',
    description:
      'Retrieve the HLS master playlist containing all available resolutions',
  })
  @ApiParam({
    name: 'videoId',
    description: 'Unique identifier for the video',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'HLS master playlist file',
  })
  @Header('Content-Type', 'application/vnd.apple.mpegurl')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('Access-Control-Allow-Origin', '*')
  async getMasterPlaylist(
    @Param('videoId') videoId: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      this.logger.log(`Serving master playlist for video ${videoId}`);

      const masterPlaylist =
        await this.streamingService.getMasterPlaylist(videoId);

      res.send(masterPlaylist);
    } catch (error) {
      this.logger.error(
        `Failed to serve master playlist for video ${videoId}: ${error.message}`,
      );

      if (error instanceof VideoNotFoundException) {
        throw error;
      }

      throw new HttpException(
        {
          code: 'MASTER_PLAYLIST_NOT_FOUND',
          message: `Master playlist not found for video ${videoId}`,
        },
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
