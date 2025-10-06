import { Module } from '@nestjs/common';
import { TranscodingService } from './services/transcoding/transcoding.service';
import { FfmpegService } from './services/ffmpeg/ffmpeg.service';
import { PrismaModule } from '../../core/config/prisma/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [TranscodingService, FfmpegService],
  exports: [TranscodingService],
})
export class TranscodingModule {}
