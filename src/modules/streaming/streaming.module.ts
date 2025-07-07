import { Module } from '@nestjs/common';
import { StreamingService } from './services/streaming/streaming.service';
import { StreamingController } from './controller/streaming/streaming.controller';
import { PrismaModule } from '../../core/config/prisma/prisma.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  providers: [StreamingService],
  controllers: [StreamingController],
})
export class StreamingModule {}
