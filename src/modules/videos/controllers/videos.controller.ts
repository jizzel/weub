import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  Body,
  ParseUUIDPipe,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { VideosService } from '../services/videos.service';
import { CreateVideoDto } from '../dto/create-video.dto';
import { VideoSearchDto } from '../dto/video-search.dto';
import {
  VideoUploadResponseDto,
  VideoDetailResponseDto,
  VideoListItemDto,
} from '../dto/video-response.dto';
import { PaginatedResponseDto } from '../../../shared/dto/pagination.dto';
import { BaseResponseDto } from '../../../shared/dto/base-response.dto';
import { VideoStatusResponseDto } from '../dto/video-status.dto';

@ApiTags('videos')
@Controller('api/v1/videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload a new video for processing' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Video upload with metadata',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Video file (MP4, MOV, WEBM, AVI)',
        },
        title: {
          type: 'string',
          description: 'Video title',
          maxLength: 255,
        },
        description: {
          type: 'string',
          description: 'Video description (optional)',
          maxLength: 2000,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Video tags (optional, max 10)',
          maxItems: 10,
        },
      },
      required: ['file', 'title'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Video uploaded successfully',
    type: VideoUploadResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid file format or request data',
  })
  @ApiResponse({
    status: 413,
    description: 'File too large (max 2GB)',
  })
  async uploadVideo(
    @UploadedFile() file: Express.Multer.File,
    @Body() createVideoDto: CreateVideoDto,
  ): Promise<BaseResponseDto<VideoUploadResponseDto>> {
    const result = await this.videosService.uploadVideo(file, createVideoDto);
    return BaseResponseDto.success(result, HttpStatus.CREATED);
  }

  @Get()
  @ApiOperation({ summary: 'List and search videos with filtering options' })
  @ApiResponse({
    status: 200,
    description: 'Videos retrieved successfully',
    type: PaginatedResponseDto<VideoListItemDto>,
  })
  async findVideos(
    @Query() searchDto: VideoSearchDto,
  ): Promise<BaseResponseDto<PaginatedResponseDto<VideoListItemDto>>> {
    const result = await this.videosService.findVideos(searchDto);
    return BaseResponseDto.success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get detailed information about a specific video' })
  @ApiResponse({
    status: 200,
    description: 'Video details retrieved successfully',
    type: VideoDetailResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async findVideoById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BaseResponseDto<VideoDetailResponseDto>> {
    const result = await this.videosService.findVideoById(id);
    return BaseResponseDto.success(result);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get the current processing status of a video' })
  @ApiResponse({
    status: 200,
    description: 'Video status retrieved successfully',
    type: VideoStatusResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Video not found',
  })
  async getVideoStatus(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BaseResponseDto<VideoStatusResponseDto>> {
    const result = await this.videosService.getVideoStatus(id);
    return BaseResponseDto.success(result);
  }
}
