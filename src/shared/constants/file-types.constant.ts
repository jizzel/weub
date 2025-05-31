export const SUPPORTED_VIDEO_FORMATS: ReadonlyArray<string> = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
] as const;

export const SUPPORTED_VIDEO_EXTENSIONS: ReadonlyArray<string> = [
  '.mp4',
  '.mov',
  '.webm',
  '.avi',
] as const;

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2GB in bytes

export const VIDEO_PROCESSING_CONFIG = {
  resolutions: {
    '480p': { width: 854, height: 480, bitrate: 1200 },
    '720p': { width: 1280, height: 720, bitrate: 2500 },
    '1080p': { width: 1920, height: 1080, bitrate: 5000 },
  },
  segmentDuration: 10, // seconds
  hlsPlaylistType: 'vod',
} as const;
