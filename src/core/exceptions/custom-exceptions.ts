import { HttpException, HttpStatus } from '@nestjs/common';

export class VideoNotFoundException extends HttpException {
  constructor(videoId: string) {
    super(
      {
        code: 'VIDEO_NOT_FOUND',
        message: `Video with ID ${videoId} not found`,
      },
      HttpStatus.NOT_FOUND,
    );
  }
}

export class InvalidFileFormatException extends HttpException {
  constructor(supportedFormats: string[]) {
    super(
      {
        code: 'INVALID_FILE_FORMAT',
        message: 'Unsupported video format. Please upload MP4, MOV, WEBM, or AVI files.',
        details: {
          supportedFormats,
          maxFileSize: '2GB',
        },
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}

export class FileTooLargeException extends HttpException {
  constructor(maxSize: string) {
    super(
      {
        code: 'FILE_TOO_LARGE',
        message: `File size exceeds the maximum limit of ${maxSize}`,
        details: {
          maxFileSize: maxSize,
        },
      },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}

export class VideoProcessingException extends HttpException {
  constructor(message: string, details?: Record<string, any>) {
    super(
      {
        code: 'VIDEO_PROCESSING_ERROR',
        message,
        details,
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}

export class TranscodingFailedException extends HttpException {
  constructor(videoId: string, reason?: string) {
    super(
      {
        code: 'TRANSCODING_FAILED',
        message: `Video transcoding failed for video ${videoId}`,
        details: {
          videoId,
          reason,
        },
      },
      HttpStatus.UNPROCESSABLE_ENTITY,
    );
  }
}
