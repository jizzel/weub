import { ApiProperty } from '@nestjs/swagger';

export class ResolutionInfoDto {
  @ApiProperty({ example: '1080p' })
  resolution: string;

  @ApiProperty({ example: 1920 })
  width: number;

  @ApiProperty({ example: 1080 })
  height: number;

  @ApiProperty({ example: 5000 })
  bitrate: number;

  @ApiProperty({ example: 24 })
  segmentCount: number;

  @ApiProperty({ example: 83886080 })
  fileSize: bigint;

  @ApiProperty({ example: '/api/v1/stream/550e8400-e29b-41d4-a716-446655440000/1080p/playlist.m3u8' })
  playlistUrl: string;
}

export class StreamingInfoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  videoId: string;

  @ApiProperty({ example: 'Beautiful Nature Scenery' })
  title: string;

  @ApiProperty({ example: '/api/v1/stream/550e8400-e29b-41d4-a716-446655440000/master.m3u8' })
  masterPlaylistUrl: string;

  @ApiProperty({ example: '/api/v1/videos/550e8400-e29b-41d4-a716-446655440000/thumbnail' })
  thumbnailUrl: string;

  @ApiProperty({ type: [ResolutionInfoDto] })
  resolutions: ResolutionInfoDto[];
}
