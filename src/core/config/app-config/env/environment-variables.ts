import { IsNumber, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

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
}
