import { Module } from '@nestjs/common';
import { StorageService } from './storage/storage.service';
import { LocalStorageService } from './local-storage/local-storage.service';

@Module({
  providers: [StorageService, LocalStorageService],
  exports: [StorageService],
})
export class StorageModule {}
