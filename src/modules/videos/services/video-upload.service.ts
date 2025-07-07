import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { FileUtils } from '../../../shared/utils/file.utils';
import { ValidationUtils } from '../../../shared/utils/validation.utils';

@Injectable()
export class VideoUploadService {
  private readonly logger = new Logger(VideoUploadService.name);
  private readonly uploadDir = join(process.cwd(), 'uploads', 'raw');

  constructor() {
    this.ensureUploadDirectory();
  }

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    // Validate the uploaded file
    ValidationUtils.validateVideoFile(file);

    // Generate unique filename
    const videoId = uuidv4();
    const fileExtension = FileUtils.getFileExtension(file.originalname);
    const filename = `${videoId}${fileExtension}`;
    const uploadPath = join(this.uploadDir, filename);

    try {
      // Save file to disk
      await fs.writeFile(uploadPath, file.buffer);

      this.logger.log(`Video uploaded successfully: ${filename}`);
      return uploadPath;
    } catch (error) {
      this.logger.error(`Failed to upload video: ${error.message}`);
      throw new Error('Failed to save uploaded video');
    }
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
    } catch (error) {
      this.logger.error(`Failed to create upload directory: ${error.message}`);
    }
  }
}
