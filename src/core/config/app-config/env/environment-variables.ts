import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum StorageDriver {
  LOCAL = 'local',
  S3 = 's3',
}

export enum AppEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsString()
  APP_NAME: string;

  @Transform(({ value }) => parseInt(value, 10))
  @IsNumber()
  PORT: number;

  @IsString()
  DATABASE_URL: string;

  @IsEnum(AppEnv, {
    message: 'APP_ENV must be one of development, production, test',
  })
  APP_ENV: AppEnv = AppEnv.Development;

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
  @ValidateIf((o: EnvironmentVariables) => o.APP_ENV === AppEnv.Production)
  @IsIn(['s3'], {
    message: 'STORAGE_DRIVER must be "s3" in production environment',
  })
  STORAGE_DRIVER: StorageDriver = StorageDriver.LOCAL;

  @IsString()
  @IsOptional()
  STORAGE_PATH = 'storage';

  @ValidateIf(
    (o: EnvironmentVariables) =>
      o.APP_ENV === AppEnv.Production || o.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  R2_ENDPOINT?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  R2_ACCESS_KEY_ID?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  R2_SECRET_ACCESS_KEY?: string;

  @ValidateIf(
    (o: EnvironmentVariables) => o.STORAGE_DRIVER === StorageDriver.S3,
  )
  @IsString()
  R2_BUCKET_NAME?: string;
}
