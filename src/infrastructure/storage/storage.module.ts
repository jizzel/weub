import { Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppConfigModule } from '../../core/config/app-config/app-config.module';
import { StorageDriver } from '../../core/config/app-config/env/environment-variables';
import { STORAGE_SERVICE } from './storage.interface';
import { LocalStorageService } from './local-storage/local-storage.service';
import { S3StorageService } from './s3-storage/s3-storage.service';

const storageServiceProvider: Provider = {
  provide: STORAGE_SERVICE,
  useFactory: (configService: ConfigService) => {
    const driver = configService.get<StorageDriver>('storage.driver');
    if (driver === StorageDriver.S3) {
      return new S3StorageService(configService);
    }
    return new LocalStorageService(configService);
  },
  inject: [ConfigService],
};

@Module({
  imports: [AppConfigModule],
  providers: [storageServiceProvider],
  exports: [storageServiceProvider],
})
export class StorageModule {}
