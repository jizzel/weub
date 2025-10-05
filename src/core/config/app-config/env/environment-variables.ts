import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export enum StorageDriver {
  LOCAL = 'local',
  S3 = 's3',
}

export class EnvironmentVariables {
  @IsString()
  APP_NAME: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsString()
  RESET_DB: string;

  @IsString()
  QUEUE_RETRY_ATTEMPTS: string;

  @IsString()
  QUEUE_RETRY_DELAY: string;

  @IsString()
  REDIS_HOST: string;

  @IsString()
  REDIS_PORT: string;

  @IsString()
  REDIS_PASSWORD: string;

  @IsString()
  UPLOAD_DIR: string = './uploads';

  @IsString()
  PUBLIC_ROOT: string = '/static';

  @IsEnum(StorageDriver)
  @IsOptional()
  STORAGE_DRIVER: StorageDriver = StorageDriver.LOCAL;

  @IsString()
  @IsOptional()
  STORAGE_PATH = 'storage';

  @IsString()
  @IsOptional()
  R2_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET_NAME?: string;
}
