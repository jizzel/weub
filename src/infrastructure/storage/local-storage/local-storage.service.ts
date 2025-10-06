import { Injectable, Logger } from '@nestjs/common';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { IStorageService } from '../storage.interface';
import { promises as fs } from 'fs';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class LocalStorageService implements IStorageService {
  private readonly logger = new Logger(LocalStorageService.name);
  private readonly baseStoragePath: string;

  constructor(private readonly configService: ConfigService) {
    this.baseStoragePath =
      this.configService.get<string>('storage.path') ||
      resolve(process.cwd(), '..', 'storage');
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

    if (!existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(fullPath, buffer);
    this.logger.log(`File saved: ${fullPath}`);

    // Return the relative path, not the full path
    return path;
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
      await fs.rm(fullPath, { recursive: true });
      this.logger.log(`Directory deleted: ${fullPath}`);
    }
  }

  // --- Path helpers now return RELATIVE paths ---

  getVideoUploadPath(videoId: string, extension: string): string {
    return join('uploads', 'raw', `${videoId}${extension}`);
  }

  getHLSOutputPath(videoId: string, resolution: string): string {
    return join('hls', videoId, resolution);
  }

  getPlaylistPath(videoId: string, resolution: string): string {
    return join('hls', videoId, resolution, 'playlist.m3u8');
  }

  getSegmentPath(videoId: string, resolution: string, segment: string): string {
    return join('hls', videoId, resolution, segment);
  }

  getThumbnailPath(videoId: string): string {
    return join('thumbnails', videoId, 'thumbnail.jpg');
  }
}
