import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './core/config/prisma/prisma.module';
import { VideosModule } from './modules/videos/videos.module';
import { AppConfigModule } from './core/config/app-config/app-config.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ResponseInterceptor } from './core/interceptors/response/response.interceptor';
import { AllExceptionsFilter } from './core/filters/all-exceptions/all-exceptions.filter';
import { TranscodingModule } from './modules/transcoding/transcoding.module';
import { TranscodingService } from './modules/transcoding/services/transcoding/transcoding.service';
import { FfmpegService } from './modules/transcoding/services/ffmpeg/ffmpeg.service';
import { StorageModule } from './infrastructure/storage/storage.module';
import { StreamingModule } from './modules/streaming/streaming.module';

@Module({
  imports: [
    PrismaModule,
    VideosModule,
    AppConfigModule,
    QueueModule,
    TranscodingModule,
    StorageModule,
    StreamingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    TranscodingService,
    FfmpegService,
  ],
})
export class AppModule {}
