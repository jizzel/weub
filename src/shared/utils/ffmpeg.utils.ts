import * as ffmpeg from 'fluent-ffmpeg';
import { VideoMetadata } from '../interfaces/video-metadata.interface';
import { Logger } from '@nestjs/common';

export class FFmpegUtils {
  private static readonly logger = new Logger(FFmpegUtils.name);

  static async getVideoMetadata(inputPath: string): Promise<VideoMetadata> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          this.logger.error(`Failed to get video metadata: ${err}`);
          reject(new Error(`Failed to get video metadata: ${err}`));
          return;
        }

        const videoStream = metadata.streams.find(
          (stream) => stream.codec_type === 'video',
        );
        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

        const duration = metadata.format.duration || 0;
        const width = videoStream.width || 0;
        const height = videoStream.height || 0;
        const bitrate = parseInt(String(metadata.format.bit_rate)) || 0;
        const codec = videoStream.codec_name || 'unknown';

        // Calculate FPS
        let fps = 0;
        if (videoStream.r_frame_rate) {
          const [num, den] = videoStream.r_frame_rate.split('/').map(Number);
          fps = den ? num / den : 0;
        }

        const aspectRatio = width && height ? `${width}:${height}` : '16:9';

        resolve({
          duration,
          width,
          height,
          bitrate,
          codec,
          fps,
          size: parseInt(String(metadata.format.size)) || 0,
          aspectRatio,
        });
      });
    });
  }

  // static async extractThumbnail(
  //   inputPath: string,
  //   outputPath: string,
  //   timestamp = 10
  // ): Promise<void> {
  //   return new Promise((resolve, reject) => {
  //     ffmpeg(inputPath)
  //       .screenshots({
  //         timestamps: [timestamp],
  //         filename: 'thumbnail.jpg',
  //         folder: outputPath,
  //         size: '320x240'
  //       })
  //       .on('end', () => {
  //         this.logger.log(`Thumbnail extracted: ${outputPath}`);
  //         resolve();
  //       })
  //       .on('error', (err) => {
  //         this.logger.error(`Thumbnail extraction failed: ${err.message}`);
  //         reject(err);
  //       });
  //   });
  // }

  static validateFFmpegInstallation(): boolean {
    try {
      // This will throw if ffmpeg is not installed
      ffmpeg.getAvailableFormats((err) => {
        if (err) {
          this.logger.error('FFmpeg is not properly installed or configured');
          return false;
        }
      });
      return true;
    } catch (error) {
      this.logger.error('FFmpeg validation failed:', error);
      return false;
    }
  }
}
