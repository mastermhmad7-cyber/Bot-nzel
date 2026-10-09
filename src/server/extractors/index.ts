import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { detectPlatform, formatBytes, formatDuration } from './detector.js';
import { MediaMetadata, DownloadProgress, PlatformId } from './types.js';
import { TEMP_DIR } from '../media/cleanup.js';
import { MAX_FILE_SIZE_BYTES, mediaProcessor } from '../media/processor.js';
import { db } from '../database/database.js';

export interface DownloadResult {
  filePath: string;
  title: string;
  fileSizeBytes: number;
  duration?: number;
  quality?: string;
  ext: string;
  platform: PlatformId;
  platformNameArabic: string;
}

export class MediaExtractorService {
  private ytDlpPath: string;

  constructor() {
    const localBin = path.resolve(process.cwd(), 'bin', 'yt-dlp');
    this.ytDlpPath = fs.existsSync(localBin) ? localBin : 'yt-dlp';
  }

  public getPlatform(url: string) {
    return detectPlatform(url);
  }

  /**
   * Extract comprehensive metadata, thumbnails, qualities, and size estimates.
   */
  public async getMetadata(url: string): Promise<MediaMetadata> {
    const detected = detectPlatform(url);
    const supportsAudio = detected.id === 'youtube' || detected.id === 'youtube_shorts' || detected.id === 'tiktok' || detected.id === 'twitter';

    // Specialized fast TikTok extractor
    if (detected.id === 'tiktok') {
      try {
        const tikData = await this.getTikTokMetadata(url);
        return tikData;
      } catch (err: any) {
        console.warn('[Extractor] TikWM API metadata fallback to yt-dlp:', err?.message || err);
      }
    }

    // Specialized fast Twitter / X extractor
    if (detected.id === 'twitter') {
      try {
        const twitterData = await this.getTwitterMetadata(url);
        return twitterData;
      } catch (err: any) {
        if (err?.message?.includes('لا تحتوي على مقطع فيديو') || err?.message?.includes('تم حذف')) {
          throw err;
        }
        console.warn('[Extractor] Twitter API metadata fallback to yt-dlp:', err?.message || err);
      }
    }

    try {
      const info = await this.runYtDlpDump(url);

      const title = info.title || 'مقطع وسائط بدون عنوان';
      const duration = info.duration || 0;
      const thumbnail = info.thumbnail || (info.thumbnails && info.thumbnails.length > 0 ? info.thumbnails[info.thumbnails.length - 1].url : undefined);

      // Estimate best video quality
      let bestQuality = '1080p';
      if (info.height) {
        bestQuality = `${info.height}p`;
      } else if (info.resolution) {
        bestQuality = info.resolution;
      } else if (info.format_note) {
        bestQuality = info.format_note;
      }

      // Calculate estimated file size
      let estimatedVideoSize = info.filesize || info.filesize_approx;
      if (!estimatedVideoSize && duration > 0) {
        // Estimate ~2.5 MB per minute for standard 720/1080p if not provided
        estimatedVideoSize = Math.floor((duration / 60) * 2.5 * 1024 * 1024);
      }

      let estimatedAudioSize = Math.floor(duration * 24 * 1024); // ~192 kbps = 24 KB/s
      if (estimatedAudioSize <= 0) estimatedAudioSize = 5 * 1024 * 1024;

      const isOverLimit = (estimatedVideoSize || 0) >= MAX_FILE_SIZE_BYTES;

      return {
        platform: detected.id,
        platformNameArabic: detected.nameArabic,
        title,
        url,
        thumbnail,
        duration,
        durationFormatted: formatDuration(duration),
        bestQuality,
        estimatedVideoSizeBytes: estimatedVideoSize,
        estimatedAudioSizeBytes: estimatedAudioSize,
        estimatedSizeFormatted: formatBytes(estimatedVideoSize),
        isOverSizeLimit: isOverLimit,
        supportsAudioExtraction: supportsAudio,
        isLiveStream: !!info.is_live,
      };
    } catch (err: any) {
      console.warn(`[Extractor] yt-dlp metadata failed, attempting fallback:`, err?.message || err);
      // Graceful fallback metadata when yt-dlp faces specific network challenges or fast response needed
      return this.generateFallbackMetadata(url, detected);
    }
  }

  private async getTikTokMetadata(url: string): Promise<MediaMetadata> {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const json = await res.json();
    if (json.code !== 0 || !json.data) {
      throw new Error(json.msg || 'فشل استخراج بيانات تيك توك');
    }

    const data = json.data;
    const duration = data.duration || 0;
    const title = data.title ? data.title.slice(0, 100).trim() : 'فيديو TikTok بدون عنوان';
    const size = data.size || 5 * 1024 * 1024;

    return {
      platform: 'tiktok',
      platformNameArabic: 'تيك توك',
      title,
      url,
      thumbnail: data.cover,
      duration,
      durationFormatted: formatDuration(duration),
      bestQuality: 'HD (بدون علامة مائية)',
      estimatedVideoSizeBytes: size,
      estimatedAudioSizeBytes: 3 * 1024 * 1024,
      estimatedSizeFormatted: formatBytes(size),
      isOverSizeLimit: size >= MAX_FILE_SIZE_BYTES,
      supportsAudioExtraction: true,
      isLiveStream: false,
    };
  }

  private async downloadTikTokMedia(
    url: string,
    mediaType: 'video' | 'audio',
    onProgress?: (p: DownloadProgress) => void
  ): Promise<DownloadResult> {
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const res = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
    });
    const json = await res.json();
    if (json.code !== 0 || !json.data) {
      throw new Error(json.msg || 'فشل جلب رابط وسائط تيك توك');
    }

    const data = json.data;
    const streamUrl = mediaType === 'audio' ? (data.music || data.play) : data.play;
    if (!streamUrl) {
      throw new Error('رابط وسائط تيك توك غير متوفر');
    }

    const timestamp = Date.now();
    const ext = mediaType === 'audio' ? 'mp3' : 'mp4';
    const fileName = `nazzil_tiktok_${timestamp}_${Math.random().toString(36).substring(2, 6)}.${ext}`;
    const filePath = path.join(TEMP_DIR, fileName);

    const streamRes = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      },
    });

    if (!streamRes.ok || !streamRes.body) {
      throw new Error(`تعذر تنزيل ملف تيك توك (رمز ${streamRes.status})`);
    }

    const totalBytes = parseInt(streamRes.headers.get('content-length') || `${data.size || 5000000}`, 10);
    const writeStream = fs.createWriteStream(filePath);
    const reader = streamRes.body.getReader();
    let downloadedBytes = 0;
    let lastProgressTime = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        downloadedBytes += value.length;
        writeStream.write(Buffer.from(value));

        const now = Date.now();
        if (now - lastProgressTime > 750 && onProgress) {
          lastProgressTime = now;
          const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 50;
          onProgress({
            percent,
            downloadedBytes,
            totalBytes,
            speed: '5.0 MB/s',
          });
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    const limitCheck = mediaProcessor.checkFileLimit(filePath);
    if (!limitCheck.ok) {
      await fs.promises.unlink(filePath).catch(() => {});
      throw new Error(limitCheck.error || 'الملف تجاوز الحد الأقصى');
    }

    const title = data.title ? data.title.slice(0, 100).trim() : 'فيديو TikTok بدون علامة مائية';

    return {
      filePath,
      title,
      fileSizeBytes: limitCheck.sizeBytes,
      ext,
      duration: data.duration,
      quality: 'HD (بدون علامة مائية)',
      platform: 'tiktok',
      platformNameArabic: 'تيك توك',
    };
  }

  private parseTwitterUrl(url: string): { username: string; statusId: string } | null {
    const match = url.match(/(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com)\/(?:#!\/)?([a-zA-Z0-9_]+)\/status(?:es)?\/(\d+)/i) ||
                  url.match(/(?:twitter\.com|x\.com|fxtwitter\.com|vxtwitter\.com)\/i\/status\/(\d+)/i);
    if (!match) return null;
    if (match[2]) {
      return { username: match[1], statusId: match[2] };
    } else {
      return { username: 'i', statusId: match[1] };
    }
  }

  private async fetchTweetData(statusId: string): Promise<any> {
    const endpoints = [
      `https://api.fxtwitter.com/i/status/${statusId}`,
      `https://api.vxtwitter.com/Twitter/status/${statusId}`,
    ];

    for (const ep of endpoints) {
      try {
        const res = await fetch(ep, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          signal: AbortSignal.timeout(9000),
        });
        if (res.ok) {
          const json = await res.json();
          if (json.tweet) return json.tweet;
          if (json.mediaURLs || json.text) return json;
        }
      } catch (err: any) {
        console.warn(`[Twitter] Endpoint ${ep} error:`, err?.message || err);
      }
    }
    throw new Error('تعذر الوصول إلى بيانات التغريدة من خوادم إكس (تويتر)');
  }

  private async getTwitterMetadata(url: string): Promise<MediaMetadata> {
    const parsed = this.parseTwitterUrl(url);
    if (!parsed) {
      throw new Error('رابط إكس (تويتر) غير صالح');
    }

    const { statusId } = parsed;
    const tweet = await this.fetchTweetData(statusId);

    // Look for video in tweet
    let video = tweet.media?.videos?.[0];

    // Check quote tweet if no direct video
    if (!video && tweet.quote?.media?.videos?.[0]) {
      video = tweet.quote.media.videos[0];
    }

    // Check if tweet mentions another status
    if (!video) {
      const matchEmbedded = (tweet.text || '').match(/(?:twitter\.com|x\.com)\/(?:[a-zA-Z0-9_]+)\/status\/(\d+)/i);
      if (matchEmbedded && matchEmbedded[1] && matchEmbedded[1] !== statusId) {
        try {
          return await this.getTwitterMetadata(`https://x.com/i/status/${matchEmbedded[1]}`);
        } catch {}
      }
    }

    if (!video) {
      throw new Error('⚠️ هذه التغريدة لا تحتوي على مقطع فيديو، أو أن صاحب الحساب قام بحذف الفيديو أو جعل الحساب خاصاً.');
    }

    const duration = Math.round(video.duration || 0);
    const title = tweet.text ? tweet.text.slice(0, 100).trim() : 'فيديو من منصة إكس (تويتر)';
    const thumbnail = video.thumbnail_url || tweet.author?.avatar_url;

    let bestQuality = 'HD';
    if (video.height) {
      bestQuality = `${video.height}p`;
    }

    let estimatedSize = 8 * 1024 * 1024;
    if (Array.isArray(video.formats) && video.formats.length > 0) {
      const highest = video.formats
        .filter((f: any) => f.container === 'mp4' || f.url?.includes('.mp4'))
        .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];
      if (highest?.bitrate && duration > 0) {
        estimatedSize = Math.round((highest.bitrate / 8) * duration);
      }
    }

    return {
      platform: 'twitter',
      platformNameArabic: 'إكس (تويتر)',
      title,
      url,
      thumbnail,
      duration,
      durationFormatted: formatDuration(duration),
      bestQuality,
      estimatedVideoSizeBytes: estimatedSize,
      estimatedAudioSizeBytes: Math.round(duration * 24 * 1024) || 2 * 1024 * 1024,
      estimatedSizeFormatted: formatBytes(estimatedSize),
      isOverSizeLimit: estimatedSize >= MAX_FILE_SIZE_BYTES,
      supportsAudioExtraction: true,
      isLiveStream: false,
    };
  }

  private async downloadTwitterMedia(
    url: string,
    mediaType: 'video' | 'audio',
    onProgress?: (p: DownloadProgress) => void
  ): Promise<DownloadResult> {
    const parsed = this.parseTwitterUrl(url);
    if (!parsed) {
      throw new Error('رابط إكس (تويتر) غير صالح');
    }

    const { statusId } = parsed;
    const tweet = await this.fetchTweetData(statusId);

    let video = tweet.media?.videos?.[0];
    let actualTweet = tweet;

    if (!video && tweet.quote?.media?.videos?.[0]) {
      video = tweet.quote.media.videos[0];
      actualTweet = tweet.quote;
    }

    if (!video) {
      const matchEmbedded = (tweet.text || '').match(/(?:twitter\.com|x\.com)\/(?:[a-zA-Z0-9_]+)\/status\/(\d+)/i);
      if (matchEmbedded && matchEmbedded[1] && matchEmbedded[1] !== statusId) {
        return this.downloadTwitterMedia(`https://x.com/i/status/${matchEmbedded[1]}`, mediaType, onProgress);
      }
    }

    if (!video) {
      throw new Error('⚠️ هذه التغريدة لا تحتوي على مقطع فيديو، أو أن صاحب الحساب قام بحذف الفيديو أو جعل الحساب خاصاً.');
    }

    let streamUrl = video.url;
    let quality = 'HD';
    if (Array.isArray(video.formats) && video.formats.length > 0) {
      const mp4Formats = video.formats.filter((f: any) => f.container === 'mp4' || (f.url && f.url.includes('.mp4')));
      mp4Formats.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));
      if (mp4Formats[0]?.url) {
        streamUrl = mp4Formats[0].url;
      }
    }
    if (video.height) {
      quality = `${video.height}p`;
    }

    if (!streamUrl) {
      throw new Error('رابط وسائط تويتر غير متوفر');
    }

    const timestamp = Date.now();
    const tempVideoName = `nazzil_twitter_${timestamp}_${Math.random().toString(36).substring(2, 6)}.mp4`;
    const tempVideoPath = path.join(TEMP_DIR, tempVideoName);

    const streamRes = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Referer': 'https://twitter.com/',
      },
    });

    if (!streamRes.ok || !streamRes.body) {
      throw new Error(`تعذر تنزيل مقطع تويتر (رمز ${streamRes.status})`);
    }

    const totalBytes = parseInt(streamRes.headers.get('content-length') || '5000000', 10);
    const writeStream = fs.createWriteStream(tempVideoPath);
    const reader = streamRes.body.getReader();
    let downloadedBytes = 0;
    let lastProgressTime = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        downloadedBytes += value.length;
        writeStream.write(Buffer.from(value));

        const now = Date.now();
        if (now - lastProgressTime > 750 && onProgress) {
          lastProgressTime = now;
          const percent = totalBytes > 0 ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100)) : 50;
          onProgress({
            percent,
            downloadedBytes,
            totalBytes,
            speed: '6.0 MB/s',
          });
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    let finalFilePath = tempVideoPath;
    let finalExt = 'mp4';

    if (mediaType === 'audio') {
      const audioFileName = `nazzil_twitter_${timestamp}_${Math.random().toString(36).substring(2, 6)}.mp3`;
      const audioFilePath = path.join(TEMP_DIR, audioFileName);
      await mediaProcessor.convertToMp3(tempVideoPath, audioFilePath);
      await fs.promises.unlink(tempVideoPath).catch(() => {});
      finalFilePath = audioFilePath;
      finalExt = 'mp3';
    }

    const limitCheck = mediaProcessor.checkFileLimit(finalFilePath);
    if (!limitCheck.ok) {
      await fs.promises.unlink(finalFilePath).catch(() => {});
      throw new Error(limitCheck.error || 'الملف تجاوز الحد الأقصى');
    }

    const title = actualTweet.text ? actualTweet.text.slice(0, 100).trim() : 'فيديو من منصة إكس (تويتر)';

    return {
      filePath: finalFilePath,
      title,
      fileSizeBytes: limitCheck.sizeBytes,
      ext: finalExt,
      duration: Math.round(video.duration || 0),
      quality,
      platform: 'twitter',
      platformNameArabic: 'إكس (تويتر)',
    };
  }

  private async getCookiesPath(): Promise<string | undefined> {
    const cookiesFilePath = path.join(TEMP_DIR, 'cookies.txt');
    try {
      const settings = await db.getSettings();
      if (settings.cookies_content && settings.cookies_content.trim().length > 10) {
        await fs.promises.writeFile(cookiesFilePath, settings.cookies_content.trim(), 'utf8');
        return cookiesFilePath;
      }
    } catch {}
    if (fs.existsSync(cookiesFilePath)) {
      return cookiesFilePath;
    }
    return undefined;
  }

  private async runYtDlpDump(url: string): Promise<any> {
    const cookiesPath = await this.getCookiesPath();
    const nodePath = process.execPath || '/usr/local/bin/node';
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-single-json',
        '--no-warnings',
        '--no-check-certificates',
        '--skip-download',
        '--no-playlist',
        '--js-runtimes', `node:${nodePath}`,
        '--user-agent',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        '--socket-timeout', '15',
      ];

      if (cookiesPath) {
        args.push('--cookies', cookiesPath);
      }

      args.push(url);

      const proc = spawn(this.ytDlpPath, args, {
        env: {
          ...process.env,
          PATH: `/usr/local/bin:${process.env.PATH || ''}`,
        },
      });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => (stdout += d.toString()));
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          try {
            const firstBrace = stdout.indexOf('{');
            if (firstBrace === -1) {
              throw new Error('لم يتم العثور على كائن JSON');
            }
            const data = JSON.parse(stdout.substring(firstBrace));
            resolve(data);
          } catch (e) {
            reject(new Error('فشل قراءة بيانات الوسائط الناتجة'));
          }
        } else {
          reject(new Error(stderr.slice(-300) || `خطأ استخراج: كود ${code}`));
        }
      });

      proc.on('error', (err) => reject(err));
    });
  }

  private generateFallbackMetadata(url: string, detected: ReturnType<typeof detectPlatform>): MediaMetadata {
    const supportsAudio = detected.id === 'youtube' || detected.id === 'youtube_shorts' || detected.id === 'tiktok';
    return {
      platform: detected.id,
      platformNameArabic: detected.nameArabic,
      title: `مقطع من منصة ${detected.nameArabic}`,
      url,
      thumbnail: undefined,
      duration: 0,
      durationFormatted: 'غير محدد',
      bestQuality: 'أعلى جودة متاحة',
      estimatedVideoSizeBytes: undefined,
      estimatedAudioSizeBytes: undefined,
      estimatedSizeFormatted: 'سيتم تحديده أثناء التحميل',
      isOverSizeLimit: false,
      supportsAudioExtraction: supportsAudio,
    };
  }

  /**
   * Download media file (video or audio) and report progress.
   */
  public async downloadMedia(options: {
    url: string;
    mediaType: 'video' | 'audio';
    onProgress?: (p: DownloadProgress) => void;
  }): Promise<DownloadResult> {
    const { url, mediaType, onProgress } = options;
    const detected = detectPlatform(url);

    // Fast TikTok native direct download
    if (detected.id === 'tiktok') {
      try {
        const result = await this.downloadTikTokMedia(url, mediaType, onProgress);
        return result;
      } catch (err: any) {
        console.warn('[Extractor] Native TikTok download fallback to yt-dlp:', err?.message || err);
      }
    }

    // Fast Twitter / X native direct download
    if (detected.id === 'twitter') {
      try {
        const result = await this.downloadTwitterMedia(url, mediaType, onProgress);
        return result;
      } catch (err: any) {
        if (err?.message?.includes('لا تحتوي على مقطع فيديو') || err?.message?.includes('تم حذف')) {
          throw err;
        }
        console.warn('[Extractor] Native Twitter download fallback to yt-dlp:', err?.message || err);
      }
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 6);
    const baseOutputName = `nazzil_${detected.id}_${timestamp}_${randomSuffix}`;
    const outputTemplate = path.join(TEMP_DIR, `${baseOutputName}.%(ext)s`);

    const cookiesPath = await this.getCookiesPath();
    const nodePath = process.execPath || '/usr/local/bin/node';
    const args: string[] = [
      '--no-warnings',
      '--no-check-certificates',
      '--no-playlist',
      '--js-runtimes', `node:${nodePath}`,
      '--user-agent',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      '--socket-timeout', '30',
      '--newline', // progress on new lines
      '--max-filesize', `${MAX_FILE_SIZE_BYTES}`, // enforce 1GB hard limit
      '-o', outputTemplate,
    ];

    if (cookiesPath) {
      args.push('--cookies', cookiesPath);
    }

    if (mediaType === 'audio') {
      // Audio only: download best audio and convert to MP3 using ffmpeg
      args.push(
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '0',
        '--ffmpeg-location', '/usr/bin/ffmpeg'
      );
    } else {
      // Video: Best video + best audio merged with ffmpeg, preference for mp4
      args.push(
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best[ext=mp4]/best',
        '--merge-output-format', 'mp4',
        '--ffmpeg-location', '/usr/bin/ffmpeg'
      );
    }

    args.push(url);

    return new Promise((resolve, reject) => {
      const proc = spawn(this.ytDlpPath, args, {
        env: {
          ...process.env,
          PATH: `/usr/local/bin:${process.env.PATH || ''}`,
        },
      });
      let stderr = '';
      let lastReportedTime = 0;

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        // Parse yt-dlp progress line: [download]  45.0% of ~30.00MiB at  3.50MiB/s ETA 00:05
        const match = text.match(/\[download\]\s+(\d+\.?\d*)%\s+of\s+~?(\d+\.?\d*)([KMG]iB)?\s+at\s+~?(\d+\.?\d*)([KMG]iB\/s)?/i);
        if (match && onProgress) {
          const now = Date.now();
          // Rate-limit progress events to once every 800ms
          if (now - lastReportedTime > 800) {
            lastReportedTime = now;
            const percent = parseFloat(match[1]);
            const totalVal = parseFloat(match[2]);
            const totalUnit = match[3] || 'MiB';
            const speedVal = match[4] || '2.0';
            const speedUnit = match[5] || 'MB/s';

            let totalBytes = totalVal * 1024 * 1024;
            if (totalUnit === 'KiB') totalBytes = totalVal * 1024;
            if (totalUnit === 'GiB') totalBytes = totalVal * 1024 * 1024 * 1024;

            onProgress({
              percent: Math.min(99, percent),
              downloadedBytes: (totalBytes * percent) / 100,
              totalBytes,
              speed: `${speedVal} ${speedUnit}`,
            });
          }
        }
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString();
      });

      proc.on('close', async (code) => {
        if (code === 0) {
          // Find output file
          try {
            const files = await fs.promises.readdir(TEMP_DIR);
            const matchedFile = files.find((f) => f.startsWith(baseOutputName));

            if (!matchedFile) {
              return reject(new Error('تعذر العثور على الملف المنزّل في المجلد المؤقت'));
            }

            const finalFilePath = path.join(TEMP_DIR, matchedFile);
            const limitCheck = mediaProcessor.checkFileLimit(finalFilePath);
            if (!limitCheck.ok) {
              await fs.promises.unlink(finalFilePath).catch(() => {});
              return reject(new Error(limitCheck.error || 'الملف تجاوز الحد الأقصى'));
            }

            const ext = path.extname(finalFilePath).replace('.', '') || (mediaType === 'audio' ? 'mp3' : 'mp4');

            resolve({
              filePath: finalFilePath,
              title: baseOutputName,
              fileSizeBytes: limitCheck.sizeBytes,
              ext,
              platform: detected.id,
              platformNameArabic: detected.nameArabic,
            });
          } catch (err: any) {
            reject(err);
          }
        } else {
          // Check if failure was due to file size > 1GB
          if (stderr.includes('File is larger than max-filesize') || stderr.includes('exceeds maximum allowed')) {
            reject(new Error('⚠️ الملف كبير جدًا\nلا يمكن معالجة الملفات التي يبلغ حجمها 1GB أو أكثر.'));
          } else if (stderr.includes('Sign in to confirm you’re not a bot') || stderr.includes('HTTP Error 429')) {
            reject(new Error('⚠️ قيود حماية YouTube\nتتطلب منصة YouTube ملف تعريف ارتباط (Cookies) على خوادم السحاب.\nيمكنك تزويد البوت بالكوكيز عبر أمر /cookies أو استخدام روابط TikTok, Instagram, Twitter, أو الروابط المباشرة.'));
          } else {
            console.error('[Extractor] Download failed with code', code, stderr.slice(-400));
            reject(new Error(`⚠️ تعذر تنزيل هذا المحتوى حالياً.\nيرجى التأكد من أن الرابط متاح للعامة وتجربة رابط آخر.`));
          }
        }
      });

      proc.on('error', (err) => {
        reject(err);
      });
    });
  }
}

export const mediaExtractor = new MediaExtractorService();
