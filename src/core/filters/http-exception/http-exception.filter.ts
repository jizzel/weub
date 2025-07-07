import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import {
  BaseResponseDto,
  ErrorDto,
} from '../../../shared/dto/base-response.dto';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();

    // Log the exception
    this.logger.warn(
      `HTTP Exception: ${exception.message}`,
      `${request.method} ${request.url}`,
    );

    const errorResponse = exception.getResponse();
    let errorCode = 'HTTP_EXCEPTION';
    let message = exception.message;
    let details: Record<string, any> | undefined;

    if (typeof errorResponse === 'object' && errorResponse !== null) {
      const err = errorResponse as Record<string, any>;
      errorCode = typeof err.code === 'string' ? err.code : errorCode;
      message = typeof err.message === 'string' ? err.message : message;
      details = typeof err.details === 'object' ? err.details : undefined;
    } else if (typeof errorResponse === 'string') {
      message = errorResponse;
    }


    const apiResponse = BaseResponseDto.error(
      new ErrorDto(errorCode, message, details),
      status,
    );

    response.status(status).json(apiResponse);
  }
}
