import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsArray,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';

export class CreateVideoDto {
  @ApiProperty({ description: 'Video title', maxLength: 255 })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Video description', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description: 'Video tags',
    type: [String],
    required: false,
    maxItems: 10,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @Transform(({ value }) => {
    if (!value) return [];
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
    }
    return Array.isArray(value) ? value : [];
  })
  tags: string[] = [];
}
