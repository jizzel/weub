import { Inject, Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { FileUtils } from '../../../shared/utils/file.utils';
import { ValidationUtils } from '../../../shared/utils/validation.utils';
import { IStorageService } from '../../../infrastructure/storage/storage.interface';

@Injectable()
export class VideoUploadService {
  private readonly logger = new Logger(VideoUploadService.name);

  constructor(
    @Inject('STORAGE_SERVICE') private readonly storageService: IStorageService,
  ) {}

  async uploadVideo(file: Express.Multer.File): Promise<string> {
    // 1. Validate the uploaded file
    ValidationUtils.validateVideoFile(file);

    // 2. Generate a unique path for the video
    const videoId = uuidv4();
    const fileExtension = FileUtils.getFileExtension(file.originalname);
    const uploadPath = this.storageService.getVideoUploadPath(
      videoId,
      fileExtension,
    );

    try {
      // 3. Save the file using the storage service
      await this.storageService.saveFile(file.buffer, uploadPath);

      this.logger.log(`Video uploaded successfully: ${uploadPath}`);
      return uploadPath;
    } catch (error) {
      this.logger.error(`Failed to upload video: ${error.message}`);
      // Consider throwing a more specific custom exception
      throw new Error('Failed to save uploaded video');
    }
  }
}
