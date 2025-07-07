import { ApiProperty } from '@nestjs/swagger';
import { VideoStatus } from '../../../shared/enums/video-status.enum';

export class VideoStatusResponseDto {
  @ApiProperty({ description: 'Video ID' })
  id: string;

  @ApiProperty({ description: 'Current status', enum: VideoStatus })
  status: VideoStatus;

  @ApiProperty({ description: 'Processing progress percentage' })
  progress: number;

  @ApiProperty({ description: 'Estimated time remaining' })
  estimatedTimeRemaining?: string;

  @ApiProperty({ description: 'Current processing task' })
  currentTask?: string;

  @ApiProperty({ description: 'Completed resolutions', type: [String] })
  completedResolutions: string[];

  @ApiProperty({ description: 'Failed resolutions', type: [String] })
  failedResolutions: string[];

  @ApiProperty({ description: 'Last update timestamp' })
  lastUpdated: Date;
}
