import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VideoStatus } from '../../../shared/enums/video-status.enum';
import { VideoResolution } from '../../../shared/enums/video-resolution.enum';

export class VideoUploadResponseDto {
  @ApiProperty({
    description: 'Unique video identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Video title',
    example: 'My Video Title',
  })
  title: string;

  @ApiProperty({
    description: 'Video processing status',
    enum: VideoStatus,
    example: VideoStatus.PENDING,
  })
  status: VideoStatus;

  @ApiProperty({
    description: 'Original uploaded filename',
    example: 'sample.mp4',
  })
  originalFilename: string;

  @ApiProperty({
    description: 'File size in bytes',
    format: 'int64',
    example: 104857600,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Upload timestamp',
    format: 'date-time',
    example: '2025-05-28T10:30:00Z',
  })
  uploadedAt: Date;

  @ApiProperty({
    description: 'Estimated processing time',
    example: '5-10 minutes',
  })
  estimatedProcessingTime: string;
}

export class VideoOutputDto {
  @ApiProperty({
    description: 'Video resolution',
    enum: VideoResolution,
    example: VideoResolution.P1080,
  })
  resolution: VideoResolution;

  @ApiProperty({
    description: 'Video width in pixels',
    example: 1920,
  })
  width: number;

  @ApiProperty({
    description: 'Video height in pixels',
    example: 1080,
  })
  height: number;

  @ApiProperty({
    description: 'Video bitrate in kbps',
    example: 5000,
  })
  bitrate: number;

  @ApiPropertyOptional({
    description: 'Total size of segments and playlist in bytes',
    format: 'int64',
    example: 83886080,
  })
  fileSize?: number;

  @ApiProperty({
    description: 'Output processing status',
    enum: VideoStatus,
    example: VideoStatus.READY,
  })
  status: VideoStatus;

  @ApiProperty({
    description: 'URL to HLS playlist for this resolution',
    example:
      '/api/v1/stream/550e8400-e29b-41d4-a716-446655440000/1080p/playlist.m3u8',
  })
  playlistUrl: string;
}

export class VideoDetailResponseDto {
  @ApiProperty({ description: 'Video ID' })
  id: string;

  @ApiProperty({ description: 'Video title' })
  title: string;

  @ApiProperty({ description: 'Video description' })
  description?: string;

  @ApiProperty({ description: 'Video status', enum: VideoStatus })
  status: VideoStatus;

  @ApiProperty({ description: 'Original filename' })
  originalFilename: string;

  @ApiProperty({ description: 'File size in bytes' })
  fileSize: number;

  @ApiProperty({ description: 'MIME type' })
  mimeType: string;

  @ApiProperty({ description: 'Duration in seconds' })
  duration?: number;

  @ApiProperty({ description: 'Video tags', type: [String] })
  tags: string[];

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;

  @ApiProperty({ description: 'Processing completion timestamp' })
  processedAt?: Date;

  @ApiProperty({
    description: 'Available video outputs',
    type: [VideoOutputDto],
  })
  outputs: VideoOutputDto[];

  @ApiProperty({ description: 'Available resolutions', type: [String] })
  availableResolutions: string[];

  @ApiProperty({ description: 'Streaming URLs by resolution' })
  streamingUrls: Record<string, string>;

  @ApiProperty({ description: 'Thumbnail URL' })
  thumbnail?: string;
}

export class VideoListItemDto {
  @ApiProperty({
    description: 'Unique video identifier',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Video title',
    example: 'Beautiful Nature Scenery',
  })
  title: string;

  @ApiPropertyOptional({
    description: 'Video description',
    example: 'Stunning landscapes from around the world',
  })
  description?: string;

  @ApiProperty({
    description: 'Current processing status',
    enum: VideoStatus,
    example: VideoStatus.READY,
  })
  status: VideoStatus;

  @ApiPropertyOptional({
    description: 'Video duration in seconds',
    example: 245,
  })
  duration?: number;

  @ApiProperty({
    description: 'Original file size in bytes',
    format: 'int64',
    example: 104857600,
  })
  fileSize: number;

  @ApiProperty({
    description: 'Video tags',
    type: [String],
    example: ['nature', 'landscape', '4k'],
  })
  tags: string[];

  @ApiPropertyOptional({
    description: 'Thumbnail URL',
    example: '/api/v1/videos/550e8400-e29b-41d4-a716-446655440000/thumbnail',
  })
  thumbnail?: string;

  @ApiProperty({
    description: 'Upload timestamp',
    format: 'date-time',
    example: '2025-05-28T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Processing completion timestamp',
    format: 'date-time',
    example: '2025-05-28T10:35:00Z',
  })
  processedAt?: Date;

  @ApiProperty({
    description: 'Available streaming resolutions',
    type: [String],
    enum: VideoResolution,
    example: [
      VideoResolution.P480,
      VideoResolution.P720,
      VideoResolution.P1080,
    ],
  })
  availableResolutions: string[];

  @ApiProperty({
    description: 'HLS streaming URLs for each resolution',
    example: {
      '480p':
        '/api/v1/stream/550e8400-e29b-41d4-a716-446655440000/480p/playlist.m3u8',
      '720p':
        '/api/v1/stream/550e8400-e29b-41d4-a716-446655440000/720p/playlist.m3u8',
      '1080p':
        '/api/v1/stream/550e8400-e29b-41d4-a716-446655440000/1080p/playlist.m3u8',
    },
  })
  streamingUrls: Record<string, string>;
}
