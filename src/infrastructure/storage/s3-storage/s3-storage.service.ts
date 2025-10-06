import { Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { ConfigService, ConfigType } from '@nestjs/config';
import { IStorageService } from '../storage.interface';
import { posix } from 'path';
import storageConfig from '../../../core/config/app-config/configs/storage.config';

@Injectable()
export class S3StorageService implements IStorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly baseStoragePath: string;

  constructor(private readonly configService: ConfigService) {
    const storageConfiguration: ConfigType<typeof storageConfig> | undefined =
      this.configService.get('storage');
    if (!storageConfiguration) {
      throw new Error(
        'FATAL: Storage configuration not found. Ensure that storage.config.ts is being loaded in AppConfigModule.',
      );
    }

    if (
      !storageConfiguration.r2.endpoint ||
      !storageConfiguration.r2.accessKeyId ||
      !storageConfiguration.r2.secretAccessKey ||
      !storageConfiguration.r2.bucket
    ) {
      throw new Error(
        'FATAL: R2 configuration not found in storage configuration.',
      );
    }

    this.s3 = new S3Client({
      endpoint: storageConfiguration.r2.endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: storageConfiguration.r2.accessKeyId,
        secretAccessKey: storageConfiguration.r2.secretAccessKey,
      },
    });
    this.bucket = storageConfiguration.r2.bucket;
    this.baseStoragePath = storageConfiguration.path;
  }

  private getS3Key(path: string): string {
    return posix.join(this.baseStoragePath, path);
  }

  async saveFile(buffer: Buffer, path: string): Promise<string> {
    const key = this.getS3Key(path);
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
    });

    await this.s3.send(command);
    this.logger.log(`File saved to S3: ${key}`);
    return key;
  }

  async getFile(path: string): Promise<Buffer> {
    const key = this.getS3Key(path);
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const response = await this.s3.send(command);
    if (!response.Body) {
      throw new Error(`File not found or empty at path: ${path}`);
    }

    const byteArray = await response.Body.transformToByteArray();
    return Buffer.from(byteArray);
  }

  async deleteFile(path: string): Promise<void> {
    const key = this.getS3Key(path);
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3.send(command);
    this.logger.log(`File deleted from S3: ${key}`);
  }

  async fileExists(path: string): Promise<boolean> {
    const key = this.getS3Key(path);
    const command = new HeadObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    try {
      await this.s3.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async createDirectory(path: string): Promise<void> {
    const key = this.getS3Key(path) + '/';
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: '',
    });
    await this.s3.send(command);
    this.logger.log(`Directory created in S3: ${key}`);
  }

  async deleteDirectory(path: string): Promise<void> {
    const prefix = this.getS3Key(path) + '/';
    let continuationToken: string | undefined;

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      });

      const listedObjects = await this.s3.send(listCommand);

      if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
        break;
      }

      const deleteCommand = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: listedObjects.Contents.map((obj) => ({ Key: obj.Key })),
        },
      });

      await this.s3.send(deleteCommand);
      this.logger.log(
        `Deleted ${listedObjects.Contents.length} objects from S3 directory: ${prefix}`,
      );
      continuationToken = listedObjects.NextContinuationToken;
    } while (continuationToken);

    this.logger.log(`Directory deleted from S3: ${prefix}`);
  }

  getVideoUploadPath(videoId: string, extension: string): string {
    return posix.join('uploads', 'raw', `${videoId}${extension}`);
  }

  getHLSOutputPath(videoId: string, resolution: string): string {
    return posix.join('hls', videoId, resolution);
  }

  getPlaylistPath(videoId: string, resolution: string): string {
    return posix.join('hls', videoId, resolution, 'playlist.m3u8');
  }

  getSegmentPath(videoId: string, resolution: string, segment: string): string {
    return posix.join('hls', videoId, resolution, segment);
  }

  getThumbnailPath(videoId: string): string {
    return posix.join('thumbnails', videoId, 'thumbnail.jpg');
  }
}
