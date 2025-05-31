import { ApiProperty } from '@nestjs/swagger';

export class BaseResponseDto<T = any> {
  @ApiProperty({ description: 'Response data' })
  data: T | null;

  @ApiProperty({ description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ description: 'Error information', required: false })
  error: ErrorDto | null;

  constructor(
    data: T | null,
    statusCode: number,
    error: ErrorDto | null = null,
  ) {
    this.data = data;
    this.statusCode = statusCode;
    this.error = error;
  }

  static success<T>(data: T, statusCode: number = 200): BaseResponseDto<T> {
    return new BaseResponseDto(data, statusCode, null);
  }

  static error(error: ErrorDto, statusCode: number): BaseResponseDto<null> {
    return new BaseResponseDto(null, statusCode, error);
  }
}

export class ErrorDto {
  @ApiProperty({ description: 'Machine-readable error code' })
  code: string;

  @ApiProperty({ description: 'Human-readable error message' })
  message: string;

  @ApiProperty({ description: 'Additional error context', required: false })
  details?: any;

  constructor(code: string, message: string, details?: any) {
    this.code = code;
    this.message = message;
    this.details = details;
  }
}
