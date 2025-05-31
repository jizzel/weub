import { extname } from 'path';
import {
  SUPPORTED_VIDEO_EXTENSIONS,
  SUPPORTED_VIDEO_FORMATS,
} from '../constants/file-types.constant';

export class FileUtils {
  static isVideoFile(mimetype: string): boolean {
    return SUPPORTED_VIDEO_FORMATS.includes(mimetype);
  }

  static isSupportedExtension(filename: string): boolean {
    const ext = extname(filename).toLowerCase();
    if (!ext) return false;
    return SUPPORTED_VIDEO_EXTENSIONS.includes(ext);
  }

  static getFileExtension(filename: string): string {
    return extname(filename).toLowerCase();
  }

  // static formatFileSize(bytes: number): string {
  //   const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  //   if (bytes === 0) return '0 Bytes';
  //   const i = Math.floor(Math.log(bytes) / Math.log(1024));
  //   return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  // }

  static formatFileSize(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const size = parseFloat((bytes / Math.pow(k, i)).toFixed(decimals));
    return `${size} ${['Bytes', 'KB', 'MB', 'GB', 'TB'][i]}`;
  }

  static sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  }

  static normalizeMimeType(mimetype: string): string {
    return mimetype.split(';')[0].trim().toLowerCase();
  }
}
