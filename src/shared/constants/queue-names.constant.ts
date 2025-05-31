export const QUEUE_NAMES = {
  TRANSCODING: 'transcoding',
  THUMBNAIL: 'thumbnail',
} as const;

export const JOB_TYPES = {
  HLS_TRANSCODE: 'hls_transcode',
  THUMBNAIL_GENERATE: 'thumbnail_generate',
} as const;
