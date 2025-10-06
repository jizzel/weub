import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import queueConfig from './configs/queue.config';
import storageConfig from './configs/storage.config';
// import { validate } from './env/env.validate';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // validate,
      envFilePath: ['.env.local', '.env'],
      load: [queueConfig, storageConfig],
    }),
  ],
})
export class AppConfigModule {}
