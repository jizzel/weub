import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString } from 'class-validator';
import { Transform } from 'class-transformer';
import { VideoStatus } from '../../../shared/enums/video-status.enum';
import { PaginationQueryDto } from '../../../shared/dto/pagination.dto';

export class VideoSearchDto extends PaginationQueryDto {
  @ApiProperty({
    description: 'Filter by video status',
    enum: VideoStatus,
    required: false,
  })
  @IsOptional()
  @IsEnum(VideoStatus)
  status?: VideoStatus;

  @ApiProperty({ description: 'Search in video titles', required: false })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiProperty({
    description: 'Filter by tags (comma-separated)',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
    return value;
  })
  tags?: string[];

  @ApiProperty({ description: 'Filter from upload date', required: false })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiProperty({ description: 'Filter to upload date', required: false })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiProperty({
    description: 'Filter by available resolution',
    required: false,
  })
  @IsOptional()
  @IsString()
  resolution?: string;
}
