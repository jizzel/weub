export interface StreamingOptions {
  enableCors?: boolean;
  cacheMaxAge?: number;
  segmentCacheMaxAge?: number;
  supportByteRanges?: boolean;
}

export interface HLSSegmentInfo {
  segmentName: string;
  duration: number;
  size: number;
  sequence: number;
}

export interface HLSPlaylistInfo {
  version: number;
  targetDuration: number;
  mediaSequence: number;
  segments: HLSSegmentInfo[];
  isEndList: boolean;
}

