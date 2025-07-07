import { Module } from '@nestjs/common';
import { VideosService } from './services/videos.service';
import { VideosController } from './controllers/videos.controller';
import { VideoUploadService } from './services/video-upload.service';
import { PrismaModule } from '../../core/config/prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';
import { QueueModule } from '../../infrastructure/queue/queue.module';

@Module({
  imports: [
    PrismaModule,
    QueueModule,
    MulterModule.register({
      limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB
      },
      fileFilter: (req, file, cb) => {
        // Basic file type validation (additional validation in service)
        const allowedMimes = [
          'video/mp4',
          'video/quicktime',
          'video/webm',
          'video/x-msvideo',
        ];
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid file type'), false);
        }
      },
    }),
  ],
  controllers: [VideosController],
  providers: [VideosService, VideoUploadService],
})
export class VideosModule {}
