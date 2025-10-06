import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { PassThrough, Readable } from 'stream';
import { IStorageService } from '../../../../infrastructure/storage/storage.interface';
import { VIDEO_PROCESSING_CONFIG } from '../../../../shared/constants/file-types.constant';
import {
  TranscodingOutput,
} from '../../../../shared/interfaces/transcoding-job.interface';
import { VideoMetadata } from '../../../../shared/interfaces/video-metadata.interface';
import { FFmpegUtils } from '../../../../shared/utils/ffmpeg.utils';

export interface HLSTranscodeOptions {
  inputPath: string; // Storage path
  outputDir: string; // Storage path prefix
  resolutions: string[];
  metadata?: VideoMetadata;
  onProgress?: (progress: {
    percent: number;
    currentResolution: string;
  }) => void;
}

@Injectable()
export class FfmpegService {
  private readonly logger = new Logger(FfmpegService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject('STORAGE_SERVICE') private readonly storageService: IStorageService,
  ) {
    if (!FFmpegUtils.validateFFmpegInstallation()) {
      this.logger.error(
        'FFmpeg is not properly installed. Video processing will fail.',
      );
    }
  }

  async transcodeToHLS(
    options: HLSTranscodeOptions,
  ): Promise<TranscodingOutput[]> {
    const { inputPath, outputDir, resolutions, onProgress } = options;
    this.logger.log(`Starting HLS transcoding for storage path: ${inputPath}`);

    const tempDir = await fs.mkdtemp(join(tmpdir(), 'transcode-'));
    this.logger.debug(`Created temporary directory: ${tempDir}`);

    try {
      // 1. Download source file to temp directory
      const localInputPath = join(tempDir, basename(inputPath));
      const inputFileBuffer = await this.storageService.getFile(inputPath);
      await fs.writeFile(localInputPath, inputFileBuffer);
      this.logger.debug(`Downloaded input file to: ${localInputPath}`);

      // 2. Get metadata and valid resolutions
      const metadata = options.metadata || (await this.getVideoMetadata(inputPath));
      this.logger.log(`Video metadata: ${JSON.stringify(metadata)}`);
      const validResolutions = this.getValidResolutions(resolutions, metadata);
      this.logger.log(
        `Valid resolutions for transcoding: ${validResolutions.join(', ')}`,
      );

      const outputs: TranscodingOutput[] = [];
      const localOutputDir = join(tempDir, 'hls');
      await fs.mkdir(localOutputDir, { recursive: true });

      // 3. Process each resolution
      for (let i = 0; i < validResolutions.length; i++) {
        const resolution = validResolutions[i];
        try {
          onProgress?.({
            percent: Math.round((i / validResolutions.length) * 100),
            currentResolution: resolution,
          });

          const localOutput = await this.transcodeResolution(
            localInputPath,
            localOutputDir,
            resolution,
            metadata,
            (progress) => {
              const overallProgress =
                ((i + progress / 100) / validResolutions.length) * 100;
              onProgress?.({
                percent: Math.round(overallProgress),
                currentResolution: resolution,
              });
            },
          );

          // 4. Upload transcoded files from temp dir to storage
          const finalOutput = await this.uploadTranscodedResolution(
            localOutput,
            outputDir,
          );
          outputs.push(finalOutput);

          this.logger.log(`Completed and uploaded transcoding for ${resolution}`);
        } catch (error) {
          this.logger.error(
            `Failed to transcode ${resolution}: ${error.message}`,
          );
        }
      }

      // 5. Create and upload master playlist
      if (outputs.length > 0) {
        await this.createMasterPlaylist(outputDir, outputs);
      }

      onProgress?.({ percent: 100, currentResolution: 'completed' });
      this.logger.log(
        `HLS transcoding completed. Generated ${outputs.length} outputs.`,
      );
      return outputs;
    } finally {
      // 6. Cleanup temporary directory
      await fs.rm(tempDir, { recursive: true, force: true });
      this.logger.debug(`Cleaned up temporary directory: ${tempDir}`);
    }
  }

  private async uploadTranscodedResolution(
    localOutput: TranscodingOutput,
    storageOutputDir: string,
  ): Promise<TranscodingOutput> {
    const { resolution, segmentPaths, playlistPath } = localOutput;
    const storageResolutionDir = `${storageOutputDir}/${resolution}`;

    // Upload playlist
    const storagePlaylistPath = `${storageResolutionDir}/playlist.m3u8`;
    const playlistBuffer = await fs.readFile(playlistPath);
    await this.storageService.saveFile(playlistBuffer, storagePlaylistPath);

    // Upload segments
    const storageSegmentPaths: string[] = [];
    for (const localSegmentPath of segmentPaths) {
      const segmentFilename = basename(localSegmentPath);
      const storageSegmentPath = `${storageResolutionDir}/${segmentFilename}`;
      const segmentBuffer = await fs.readFile(localSegmentPath);
      await this.storageService.saveFile(segmentBuffer, storageSegmentPath);
      storageSegmentPaths.push(storageSegmentPath);
    }

    return {
      ...localOutput,
      playlistPath: storagePlaylistPath,
      segmentPaths: storageSegmentPaths,
    };
  }

  private async transcodeResolution(
    localInputPath: string,
    localOutputDir: string,
    resolution: string,
    metadata: VideoMetadata,
    onProgress?: (progress: number) => void,
  ): Promise<TranscodingOutput> {
    const config = VIDEO_PROCESSING_CONFIG.resolutions[resolution];
    if (!config) throw new Error(`Unknown resolution: ${resolution}`);

    const resolutionDir = join(localOutputDir, resolution);
    await fs.mkdir(resolutionDir, { recursive: true });

    const playlistPath = join(resolutionDir, 'playlist.m3u8');
    const segmentPattern = join(resolutionDir, 'segment_%03d.ts');

    return new Promise((resolve, reject) => {
      ffmpeg(localInputPath)
        .outputOptions([
          '-c:v libx264', '-c:a aac', '-strict experimental', '-f hls',
          `-hls_time ${VIDEO_PROCESSING_CONFIG.segmentDuration}`,
          '-hls_list_size 0', `-hls_playlist_type ${VIDEO_PROCESSING_CONFIG.hlsPlaylistType}`,
          `-vf scale=-2:${config.height}:force_original_aspect_ratio=decrease`,
          '-pix_fmt yuv420p', `-b:v ${config.bitrate}k`,
          '-maxrate ' + Math.round(config.bitrate * 1.2) + 'k',
          '-bufsize ' + Math.round(config.bitrate * 2) + 'k',
          '-b:a 128k', '-ac 2', '-ar 44100',
          '-preset fast', '-profile:v main', '-level 3.1',
          `-hls_segment_filename ${segmentPattern}`,
        ])
        .output(playlistPath)
        .on('start', (cmd) => this.logger.debug(`FFmpeg command: ${cmd}`))
        .on('progress', (p) => {
          if (p.percent) {
            onProgress?.(p.percent);
            this.logger.debug(`${resolution} progress: ${p.percent}%`);
          }
        })
        .on('end', async () => {
          try {
            const files = await fs.readdir(resolutionDir);
            const segmentPaths = files
              .filter((file) => file.endsWith('.ts'))
              .map((file) => join(resolutionDir, file))
              .sort();

            let totalSize = 0;
            for (const p of [...segmentPaths, playlistPath]) {
              totalSize += (await fs.stat(p)).size;
            }

            resolve({
              resolution, width: config.width, height: config.height,
              bitrate: config.bitrate, playlistPath, segmentPaths,
              fileSize: totalSize, duration: metadata.duration,
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => reject(error))
        .run();
    });
  }

  private getValidResolutions(
    requestedResolutions: string[],
    metadata: VideoMetadata,
  ): string[] {
    const available = Object.keys(VIDEO_PROCESSING_CONFIG.resolutions);
    return requestedResolutions.filter((res) => {
      if (!available.includes(res)) return false;
      const config = VIDEO_PROCESSING_CONFIG.resolutions[res];
      return config.height <= metadata.height;
    });
  }

  private async createMasterPlaylist(
    storageOutputDir: string,
    outputs: TranscodingOutput[],
  ): Promise<void> {
    const masterPlaylistPath = `${storageOutputDir}/master.m3u8`;
    let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    const sortedOutputs = [...outputs].sort((a, b) => b.height - a.height);

    for (const output of sortedOutputs) {
      const bandwidth = output.bitrate * 1000;
      const resolution = `${output.width}x${output.height}`;
      const playlistName = `${output.resolution}/playlist.m3u8`;
      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n`;
      masterContent += `${playlistName}\n\n`;
    }

    await this.storageService.saveFile(
      Buffer.from(masterContent), masterPlaylistPath
    );
    this.logger.log(`Master playlist created in storage: ${masterPlaylistPath}`);
  }

  async generateThumbnail(
    inputPath: string, // Storage path
    outputPath: string, // Full storage path for output
    timestamp = 10,
  ): Promise<string> {
    const inputFileBuffer = await this.storageService.getFile(inputPath);
    const readableStream = Readable.from(inputFileBuffer);
    const outputStream = new PassThrough();
    const chunks: Buffer[] = [];
    outputStream.on('data', (chunk) => chunks.push(chunk));

    return new Promise((resolve, reject) => {
      outputStream.on('end', async () => {
        try {
          const outputBuffer = Buffer.concat(chunks);
          await this.storageService.saveFile(outputBuffer, outputPath);
          this.logger.log(`Thumbnail generated in storage: ${outputPath}`);
          resolve(outputPath);
        } catch (error) {
          reject(error);
        }
      });

      ffmpeg(readableStream)
        .seekInput(timestamp)
        .frames(1)
        .format('image2')
        .size('320x240')
        .outputOptions([
          '-vf scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
          '-q:v 2',
        ])
        .on('error', (err) => reject(err))
        .pipe(outputStream, { end: true });
    });
  }

  async cleanupFiles(paths: string[]): Promise<void> {
    for (const path of paths) {
      try {
        await this.storageService.deleteFile(path);
        this.logger.log(`Cleaned up file from storage: ${path}`);
      } catch (error) {
        this.logger.warn(`Failed to cleanup file ${path} from storage: ${error.message}`);
      }
    }
  }

  private parseFps(fpsString: string): number {
    if (!fpsString || fpsString === '0/0') return 0;
    const [num, den] = fpsString.split('/').map(Number);
    return den ? num / den : 0;
  }

  async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    const fileBuffer = await this.storageService.getFile(inputPath);
    const readableStream = Readable.from(fileBuffer);

    return new Promise((resolve, reject) => {
      ffmpeg(readableStream).ffprobe((err, metadata) => {
        if (err) {
          return reject(
            new Error(`Failed to get video metadata: ${err.message}`),
          );
        }
        if (!metadata?.streams) {
          return reject(new Error('Invalid metadata from ffprobe'));
        }

        const videoStream = metadata.streams.find(
          (s) => s.codec_type === 'video',
        );
        if (!videoStream) {
          return reject(new Error('No video stream found'));
        }

        resolve({
          duration: metadata.format?.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          bitrate: Number(metadata.format?.bit_rate) || 0,
          fps: this.parseFps(videoStream.r_frame_rate || '0/1'),
          codec: videoStream.codec_name || 'unknown',
          size: (videoStream.width || 0) * (videoStream.height || 0),
          aspectRatio: videoStream.display_aspect_ratio || '16:9',
        });
      });
    });
  }
}
