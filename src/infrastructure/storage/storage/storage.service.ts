import { Injectable } from '@nestjs/common';
import { LocalStorageService } from '../local-storage/local-storage.service';

@Injectable()
export class StorageService extends LocalStorageService {}
