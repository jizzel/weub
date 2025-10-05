import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import { join } from 'path';
import { FFmpegUtils } from '../../../../shared/utils/ffmpeg.utils';
import { VIDEO_PROCESSING_CONFIG } from '../../../../shared/constants/file-types.constant';
import { TranscodingOutput } from '../../../../shared/interfaces/transcoding-job.interface';
import { VideoMetadata } from '../../../../shared/interfaces/video-metadata.interface';

export interface HLSTranscodeOptions {
  inputPath: string;
  outputDir: string;
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

  constructor(private readonly configService: ConfigService) {
    // Validate FFmpeg installation on service initialization
    if (!FFmpegUtils.validateFFmpegInstallation()) {
      this.logger.error(
        'FFmpeg is not properly installed. Video processing will fail.',
      );
    }
  }

  async transcodeToHLS(
    options: HLSTranscodeOptions,
  ): Promise<TranscodingOutput[]> {
    const {
      inputPath,
      outputDir,
      resolutions,
      metadata: mtd,
      onProgress,
    } = options;

    this.logger.log(`Starting HLS transcoding for: ${inputPath}`);

    // Get video metadata
    const metadata = mtd || (await this.getVideoMetadata(inputPath));
    this.logger.log(`Video metadata: ${JSON.stringify(metadata)}`);

    // Filter resolutions based on source video quality
    const validResolutions = this.getValidResolutions(resolutions, metadata);
    this.logger.log(
      `Valid resolutions for transcoding: ${validResolutions.join(', ')}`,
    );

    const outputs: TranscodingOutput[] = [];

    // Process each resolution
    for (let i = 0; i < validResolutions.length; i++) {
      const resolution = validResolutions[i];

      try {
        // Report progress at start of each resolution
        onProgress?.({
          percent: Math.round((i / validResolutions.length) * 100),
          currentResolution: resolution,
        });

        const output = await this.transcodeResolution(
          inputPath,
          outputDir,
          resolution,
          metadata,
          (progress) => {
            // Report progress for current resolution
            const overallProgress =
              ((i + progress / 100) / validResolutions.length) * 100;
            onProgress?.({
              percent: Math.round(overallProgress),
              currentResolution: resolution,
            });
          },
        );
        outputs.push(output);

        this.logger.log(`Completed transcoding for ${resolution}`);
      } catch (error) {
        this.logger.error(
          `Failed to transcode ${resolution}: ${error.message}`,
        );
        // Continue with other resolutions even if one fails
      }
    }

    // Create master playlist
    if (outputs.length > 0) {
      await this.createMasterPlaylist(outputDir, outputs);
    }

    // Report completion
    onProgress?.({ percent: 100, currentResolution: 'completed' });

    this.logger.log(
      `HLS transcoding completed. Generated ${outputs.length} outputs.`,
    );
    return outputs;
  }

  private async transcodeResolution(
    inputPath: string,
    outputDir: string,
    resolution: string,
    metadata: VideoMetadata,
    onProgress?: (progress: number) => void,
  ): Promise<TranscodingOutput> {
    const config = VIDEO_PROCESSING_CONFIG.resolutions[resolution];
    if (!config) {
      throw new Error(`Unknown resolution: ${resolution}`);
    }

    const resolutionDir = join(outputDir, resolution);
    await fs.mkdir(resolutionDir, { recursive: true });

    const playlistPath = join(resolutionDir, 'playlist.m3u8');
    const segmentPattern = join(resolutionDir, 'segment_%03d.ts');

    return new Promise((resolve, reject) => {
      let segmentPaths: string[] = [];

      const command = ffmpeg(inputPath)
        .outputOptions([
          '-c:v libx264', // Video codec
          '-c:a aac', // Audio codec
          '-strict experimental',
          '-f hls', // HLS format
          `-hls_time ${VIDEO_PROCESSING_CONFIG.segmentDuration}`,
          '-hls_list_size 0', // Keep all segments in playlist
          `-hls_playlist_type ${VIDEO_PROCESSING_CONFIG.hlsPlaylistType}`,

          // // Video settings
          // `-vf scale=${config.width}:${config.height}:force_original_aspect_ratio=decrease`,
          // `-b:v ${config.bitrate}k`,
          // '-maxrate ' + Math.round(config.bitrate * 1.2) + 'k',
          // '-bufsize ' + Math.round(config.bitrate * 2) + 'k',

          // Video settings
          `-vf scale=-2:${config.height}:force_original_aspect_ratio=decrease`,
          '-pix_fmt yuv420p',
          `-b:v ${config.bitrate}k`,
          '-maxrate ' + Math.round(config.bitrate * 1.2) + 'k',
          '-bufsize ' + Math.round(config.bitrate * 2) + 'k',


          // Audio settings
          '-b:a 128k',
          '-ac 2', // Stereo audio
          '-ar 44100', // Sample rate

          // Performance settings
          '-preset fast',
          '-profile:v main',
          '-level 3.1',

          // HLS segment settings
          `-hls_segment_filename ${segmentPattern}`,
        ])
        .output(playlistPath)
        .on('start', (commandLine) => {
          this.logger.debug(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            onProgress?.(progress.percent);
            this.logger.debug(`${resolution} progress: ${progress.percent}%`);
          }
        })
        .on('end', async () => {
          try {
            // Get segment files
            const files = await fs.readdir(resolutionDir);
            segmentPaths = files
              .filter((file) => file.endsWith('.ts'))
              .map((file) => join(resolutionDir, file))
              .sort(); // Sort segments to ensure correct order

            // Calculate total file size
            let totalSize = 0;
            for (const segmentPath of segmentPaths) {
              try {
                const stats = await fs.stat(segmentPath);
                totalSize += stats.size;
              } catch (error) {
                this.logger.warn(
                  `Could not get size for segment: ${segmentPath}`,
                );
              }
            }

            // Also include playlist file size
            try {
              const playlistStats = await fs.stat(playlistPath);
              totalSize += playlistStats.size;
            } catch (error) {
              this.logger.warn(
                `Could not get size for playlist: ${playlistPath}`,
              );
            }

            const output: TranscodingOutput = {
              resolution,
              width: config.width,
              height: config.height,
              bitrate: config.bitrate,
              playlistPath,
              segmentPaths,
              fileSize: totalSize,
              duration: metadata.duration,
            };

            resolve(output);
          } catch (error) {
            this.logger.error(
              `Error processing transcoding result: ${error.message}`,
            );
            reject(error);
          }
        })
        .on('error', (error) => {
          this.logger.error(`FFmpeg error for ${resolution}: ${error.message}`);
          reject(error);
        });

      command.run();
    });
  }

  private getValidResolutions(
    requestedResolutions: string[],
    metadata: VideoMetadata,
  ): string[] {
    const availableResolutions = Object.keys(
      VIDEO_PROCESSING_CONFIG.resolutions,
    );

    return requestedResolutions.filter((resolution) => {
      if (!availableResolutions.includes(resolution)) {
        this.logger.warn(`Unknown resolution requested: ${resolution}`);
        return false;
      }

      const config = VIDEO_PROCESSING_CONFIG.resolutions[resolution];

      // Don't upscale - only include resolutions smaller than or equal to source
      if (config.height > metadata.height) {
        this.logger.log(
          `Skipping ${resolution} - would upscale (source: ${metadata.height}p)`,
        );
        return false;
      }

      return true;
    });
  }

  private async createMasterPlaylist(
    outputDir: string,
    outputs: TranscodingOutput[],
  ): Promise<void> {
    const masterPlaylistPath = join(outputDir, 'master.m3u8');

    let masterContent = '#EXTM3U\n#EXT-X-VERSION:3\n\n';

    // Sort outputs by resolution (highest first)
    const sortedOutputs = outputs.sort((a, b) => {
      const aHeight = parseInt(a.resolution.replace('p', ''));
      const bHeight = parseInt(b.resolution.replace('p', ''));
      return bHeight - aHeight;
    });

    for (const output of sortedOutputs) {
      const bandwidth = output.bitrate * 1000; // Convert to bps
      const resolution = `${output.width}x${output.height}`;
      const playlistName = `${output.resolution}/playlist.m3u8`;

      masterContent += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution}\n`;
      masterContent += `${playlistName}\n\n`;
    }

    await fs.writeFile(masterPlaylistPath, masterContent);
    this.logger.log(`Master playlist created: ${masterPlaylistPath}`);
  }

  async generateThumbnail(
    inputPath: string,
    outputDir: string,
    timestamp = 10,
  ): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });

    const thumbnailPath = join(outputDir, 'thumbnail.jpg');

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .seekInput(timestamp)
        .frames(1)
        .size('320x240')
        .outputOptions([
          '-vf scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2',
          '-q:v 2', // High quality JPEG
        ])
        .output(thumbnailPath)
        .on('start', (commandLine) => {
          this.logger.debug(`Thumbnail FFmpeg command: ${commandLine}`);
        })
        .on('end', () => {
          this.logger.log(`Thumbnail generated: ${thumbnailPath}`);
          resolve(thumbnailPath);
        })
        .on('error', (error) => {
          this.logger.error(`Thumbnail generation failed: ${error.message}`);
          reject(error);
        })
        .run();
    });
  }

  async cleanupFiles(paths: string[]): Promise<void> {
    const cleanupPromises = paths.map(async (path) => {
      try {
        await fs.unlink(path);
        this.logger.log(`Cleaned up file: ${path}`);
      } catch (error) {
        this.logger.warn(`Failed to cleanup file ${path}: ${error.message}`);
      }
    });

    await Promise.all(cleanupPromises);
  }

  private parseFps(fpsString: string): number {
    if (!fpsString || fpsString === '0/0') return 0;

    const [num, den] = fpsString.split('/').map(Number);
    return den && den !== 0 ? num / den : num || 0;
  }

  async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(
        inputPath,
        (err: Error | null, metadata: ffmpeg.FfprobeData) => {
          if (err) {
            this.logger.error(
              `Failed to get video metadata: ${err?.message || 'Unknown error'}`,
            );
            reject(
              new Error(
                `Failed to get video metadata: ${err?.message || 'Unknown error'}`,
              ),
            );
            return;
          }

          if (!metadata || !metadata.streams) {
            reject(new Error('Invalid metadata received from ffprobe'));
            return;
          }

          const videoStream = metadata.streams.find(
            (stream) => stream.codec_type === 'video',
          );

          if (!videoStream) {
            reject(new Error('No video stream found'));
            return;
          }

          const duration = metadata.format?.duration || 0;
          const width = videoStream.width || 0;
          const height = videoStream.height || 0;
          const bitrate = parseInt(
            String(metadata.format?.bit_rate || '0'),
            10,
          );
          const fps = this.parseFps(videoStream.r_frame_rate || '0/1');
          const codec = videoStream.codec_name || 'unknown';

          resolve({
            duration,
            width,
            height,
            bitrate,
            fps,
            codec,
            size: width * height,
            aspectRatio: height > 0 ? `${width}:${height}` : '16:9',
          });
        },
      );
    });
  }
}
