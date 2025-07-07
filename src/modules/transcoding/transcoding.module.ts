import { Module } from '@nestjs/common';
import { TranscodingService } from './services/transcoding/transcoding.service';
import { FfmpegService } from './services/ffmpeg/ffmpeg.service';
import { PrismaModule } from '../../core/config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [TranscodingService, FfmpegService],
  exports: [TranscodingService],
})
export class TranscodingModule {}
