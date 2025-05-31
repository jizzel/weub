import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { BaseResponseDto } from '../../../shared/dto/base-response.dto';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {

    return next.handle().pipe(
      map((data) => {
        if (
          data &&
          typeof data === 'object' &&
          'statusCode' in data &&
          'data' in data
        ) {
          return data;
        }

        // Otherwise, wrap the data
        return BaseResponseDto.success(
          data,
          Number(context.switchToHttp().getResponse().statusCode),
        );
      }),
    );
  }
}
