import { BadRequestException } from '@nestjs/common';
import { FileUtils } from './file.utils';
import { MAX_FILE_SIZE } from '../constants/file-types.constant';

export class ValidationUtils {
  static validateVideoFile(file: Express.Multer.File): void {
    // is there a file
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'Video file is required',
      });
    }

    // is the mime type supported
    const normalizedMime = FileUtils.normalizeMimeType(file.mimetype);
    if (!FileUtils.isVideoFile(normalizedMime)) {
      throw new BadRequestException({
        code: 'INVALID_FILE_FORMAT',
        message:
          'Unsupported video format. Please upload MP4, MOV, WEBM, or AVI files.',
        details: {
          supportedFormats: ['mp4', 'mov', 'webm', 'avi'],
          receivedFormat: normalizedMime,
        },
      });
    }

    // does meet the size requirement
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'File size exceeds the maximum limit of 2GB',
        details: {
          maxFileSize: '2GB',
          receivedSize: FileUtils.formatFileSize(file.size),
        },
      });
    }
  }

  static validateTitle(title: string): void {
    if (!title || title.trim().length === 0) {
      throw new BadRequestException({
        code: 'TITLE_REQUIRED',
        message: 'Video title is required',
      });
    }

    if (title.length > 255) {
      throw new BadRequestException({
        code: 'TITLE_TOO_LONG',
        message: 'Video title must be less than 255 characters',
      });
    }
  }

  static validateTags(tags: string[]): void {
    if (!Array.isArray(tags)) {
      throw new BadRequestException({
        code: 'INVALID_TAGS_FORMAT',
        message: 'Tags must be an array of strings',
      });
    }

    if (tags.length > 10) {
      throw new BadRequestException({
        code: 'TOO_MANY_TAGS',
        message: 'Maximum of 10 tags allowed',
      });
    }

    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length > 50) {
        throw new BadRequestException({
          code: 'INVALID_TAG',
          message: 'Each tag must be a string with maximum 50 characters',
        });
      }
    }
  }
}
