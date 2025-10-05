export interface IStorageService {
  saveFile(buffer: Buffer, path: string): Promise<string>;
  getFile(path: string): Promise<Buffer>;
  deleteFile(path: string): Promise<void>;
  fileExists(path: string): Promise<boolean>;

  // Directory operations
  createDirectory(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;

  // Path helpers
  getVideoUploadPath(videoId: string, extension: string): string;
  getHLSOutputPath(videoId: string, resolution: string): string;
  getPlaylistPath(videoId: string, resolution: string): string;
  getSegmentPath(videoId: string, resolution: string, segment: string): string;
  getThumbnailPath(videoId: string): string;
}

export const STORAGE_SERVICE = 'STORAGE_SERVICE';
