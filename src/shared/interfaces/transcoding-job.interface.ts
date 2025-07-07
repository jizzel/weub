export interface TranscodingProgress {
  percent: number;
  currentResolution: string;
  completedResolutions: string[];
  estimatedTimeRemaining?: number;
  currentTask: string;
}

export interface TranscodingResult {
  success: boolean;
  outputs: TranscodingOutput[];
  duration?: number;
  error?: string;
  thumbnail?: string;
}

export interface TranscodingOutput {
  resolution: string;
  width: number;
  height: number;
  bitrate: number;
  playlistPath: string;
  segmentPaths: string[];
  fileSize: number;
  duration: number;
}

export interface JobProgressUpdate {
  jobId: string;
  videoId: string;
  progress: TranscodingProgress;
  updatedAt: Date;
}
