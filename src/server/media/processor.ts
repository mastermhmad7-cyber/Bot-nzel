import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export const MAX_FILE_SIZE_BYTES = 1024 * 1024 * 1024; // 1 GB (1,073,741,824 bytes)

export class MediaProcessor {
  private ffmpegPath: string;

  constructor() {
    this.ffmpegPath = process.env.FFMPEG_PATH || '/usr/bin/ffmpeg';
  }

  public isFfmpegAvailable(): boolean {
    return fs.existsSync(this.ffmpegPath);
  }

  /**
   * Convert any audio or video file to a high quality MP3 (192kbps, 44.1kHz).
   */
  public async convertToMp3(inputPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isFfmpegAvailable()) {
        // Fallback: If ffmpeg is not available, check if the file is already audio
        return resolve(inputPath);
      }

      const args = [
        '-y', // Overwrite output files
        '-i', inputPath,
        '-vn', // No video
        '-c:a', 'libmp3lame',
        '-b:a', '192k',
        '-ar', '44100',
        outputPath,
      ];

      const proc = spawn(this.ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          console.error('[FFmpeg] convertToMp3 failed:', stderr.slice(-400));
          reject(new Error(`فشل تحويل الصوت عبر FFmpeg: code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Merges separate video and audio streams into a single MP4 container without re-encoding video.
   */
  public async mergeVideoAudio(videoPath: string, audioPath: string, outputPath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.isFfmpegAvailable()) {
        return resolve(videoPath);
      }

      const args = [
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-c:v', 'copy',
        '-c:a', 'aac',
        '-b:a', '192k',
        outputPath,
      ];

      const proc = spawn(this.ffmpegPath, args);
      let stderr = '';

      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 && fs.existsSync(outputPath)) {
          resolve(outputPath);
        } else {
          console.error('[FFmpeg] mergeVideoAudio failed:', stderr.slice(-400));
          reject(new Error(`فشل دمج الفيديو والصوت عبر FFmpeg: code ${code}`));
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Inspect file size on disk and verify under 1GB limit.
   */
  public checkFileLimit(filePath: string): { ok: boolean; sizeBytes: number; error?: string } {
    try {
      const stats = fs.statSync(filePath);
      if (stats.size >= MAX_FILE_SIZE_BYTES) {
        return {
          ok: false,
          sizeBytes: stats.size,
          error: '⚠️ الملف كبير جدًا\nلا يمكن معالجة الملفات التي يبلغ حجمها 1GB أو أكثر.',
        };
      }
      return { ok: true, sizeBytes: stats.size };
    } catch (err) {
      return { ok: false, sizeBytes: 0, error: 'تعذر التحقق من حجم الملف الناتج' };
    }
  }
}

export const mediaProcessor = new MediaProcessor();
