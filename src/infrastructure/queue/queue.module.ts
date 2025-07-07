import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AppConfigModule } from '../../core/config/app-config/app-config.module';
import { ConfigService } from '@nestjs/config';
import { ProducerService } from './producer/producer.service';
import { ConsumerService } from './consumer/consumer.service';
import { QUEUE_NAMES } from '../../shared/constants/queue-names.constant';
import { TranscodingModule } from '../../modules/transcoding/transcoding.module';
import { PrismaModule } from '../../core/config/prisma/prisma.module';

@Module({
  imports: [
    AppConfigModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.get('queue.redis.host'),
          port: configService.get('queue.redis.port'),
          password: configService.get('queue.redis.password'),
        },
        defaultJobOptions: configService.get('queue.defaultSettings'),
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueue({ name: QUEUE_NAMES.TRANSCODING }),
    TranscodingModule,
    PrismaModule,
  ],
  providers: [ProducerService, ConsumerService],
  exports: [ProducerService],
})
export class QueueModule {}
