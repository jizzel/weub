import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { IStorageService } from '../storage.interface';
import { promises as fs } from 'fs';
import { resolve } from 'path';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseStoragePath: string;

  constructor() {
    this.baseStoragePath =
      process.env.STORAGE_PATH || resolve(process.cwd(), '..', 'storage'); // join(process.cwd(), 'storage');
    this.ensureDirectoriesExist();
  }

  private ensureDirectoriesExist(): void {
    const directories = [
      join(this.baseStoragePath, 'uploads', 'raw'),
      join(this.baseStoragePath, 'hls'),
      join(this.baseStoragePath, 'thumbnails'),
    ];

    directories.forEach((dir) => {
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        this.logger.log(`Created directory: ${dir}`);
      }
    });
  }

  async saveFile(buffer: Buffer, path: string): Promise<string> {
    const fullPath = join(this.baseStoragePath, path);
    const dir = dirname(fullPath);

    // Ensure directory exists
    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(fullPath, buffer);
    this.logger.log(`File saved: ${fullPath}`);

    return fullPath;
  }

  async getFile(path: string): Promise<Buffer> {
    const fullPath = join(this.baseStoragePath, path);
    return await fs.readFile(fullPath);
  }

  async deleteFile(path: string): Promise<void> {
    const fullPath = join(this.baseStoragePath, path);
    if (existsSync(fullPath)) {
      await fs.unlink(fullPath);
      this.logger.log(`File deleted: ${fullPath}`);
    }
  }

  async fileExists(path: string): Promise<boolean> {
    const fullPath = join(this.baseStoragePath, path);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async createDirectory(path: string): Promise<void> {
    const fullPath = join(this.baseStoragePath, path);
    await fs.mkdir(fullPath, { recursive: true });
  }

  async deleteDirectory(path: string): Promise<void> {
    const fullPath = join(this.baseStoragePath, path);
    if (existsSync(fullPath)) {
      await fs.rmdir(fullPath, { recursive: true });
      this.logger.log(`Directory deleted: ${fullPath}`);
    }
  }

  getVideoUploadPath(videoId: string, extension: string): string {
    return join(
      this.baseStoragePath,
      'uploads',
      'raw',
      `${videoId}${extension}`,
    );
  }

  getHLSOutputPath(videoId: string, resolution: string): string {
    return join(this.baseStoragePath, 'hls', videoId, resolution);
  }

  getPlaylistPath(videoId: string, resolution: string): string {
    return join(
      this.baseStoragePath,
      'hls',
      videoId,
      resolution,
      'playlist.m3u8',
    );
  }

  getSegmentPath(videoId: string, resolution: string, segment: string): string {
    return join(this.baseStoragePath, 'hls', videoId, resolution, segment);
  }

  getThumbnailPath(videoId: string): string {
    return join(this.baseStoragePath, 'thumbnails', videoId, 'thumbnail.jpg');
  }

  getMasterPlaylistPath(videoId: string): string {
    return join(this.baseStoragePath, 'hls', videoId, 'master.m3u8');
  }
}
