import { EventEmitter } from 'events';
import { JobQueueItem, JobStatus } from '../database/types.js';
import { db } from '../database/database.js';
import { mediaExtractor } from '../extractors/index.js';
import { telegramBot } from '../telegram/client.js';
import { cleanupFile } from '../media/cleanup.js';
import { storePendingUrl } from '../telegram/handlers.js';

export interface CreateJobOptions {
  userId: number;
  chatId: number;
  messageId?: number;
  url: string;
  platform: string;
  mediaType: 'video' | 'audio';
  title?: string;
  telegramShareUrl?: string;
}

export class JobQueueManager extends EventEmitter {
  private queue: JobQueueItem[] = [];
  private activeJobs: Map<string, JobQueueItem> = new Map();
  private maxConcurrency = 3;
  private isProcessing = false;

  constructor() {
    super();
    // Refresh maxConcurrency from database settings
    this.refreshSettings();
  }

  public async refreshSettings() {
    try {
      const s = await db.getSettings();
      if (s.max_concurrent_jobs) {
        this.maxConcurrency = s.max_concurrent_jobs;
      }
    } catch {
      // Ignore
    }
  }

  /**
   * Enqueue a new download/processing task.
   */
  public async addJob(options: CreateJobOptions): Promise<JobQueueItem> {
    await this.refreshSettings();

    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const jobItem: JobQueueItem = {
      job_id: jobId,
      user_id: options.userId,
      chat_id: options.chatId,
      message_id: options.messageId,
      url: options.url,
      platform: options.platform,
      media_type: options.mediaType,
      title: options.title || 'جاري التحميل...',
      status: 'queued',
      progress: 0,
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    this.queue.push(jobItem);
    await db.saveJob(jobItem);

    this.emit('jobAdded', jobItem);
    this.processNext();
    return jobItem;
  }

  public getQueueStatus() {
    return {
      queuedCount: this.queue.length,
      activeCount: this.activeJobs.size,
      maxConcurrency: this.maxConcurrency,
      activeJobIds: Array.from(this.activeJobs.keys()),
    };
  }

  public async cancelJob(jobId: string): Promise<boolean> {
    const queueIndex = this.queue.findIndex((j) => j.job_id === jobId);
    if (queueIndex !== -1) {
      const [removed] = this.queue.splice(queueIndex, 1);
      removed.status = 'cancelled';
      await db.saveJob(removed);
      this.emit('jobCancelled', removed);
      return true;
    }

    const active = this.activeJobs.get(jobId);
    if (active) {
      active.status = 'cancelled';
      await db.saveJob(active);
      this.emit('jobCancelled', active);
      return true;
    }

    return false;
  }

  private async processNext() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      while (this.activeJobs.size < this.maxConcurrency && this.queue.length > 0) {
        const nextJob = this.queue.shift();
        if (!nextJob) break;

        this.activeJobs.set(nextJob.job_id, nextJob);
        this.executeJob(nextJob).catch((err) => {
          console.error(`[Queue] Unhandled job execution error for ${nextJob.job_id}:`, err);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private async updateJobStatus(
    job: JobQueueItem,
    status: JobStatus,
    updates: Partial<JobQueueItem> = {}
  ) {
    job.status = status;
    Object.assign(job, updates);
    await db.saveJob(job);
    this.emit('jobProgress', job);
  }

  private buildProgressBar(percent: number): string {
    const totalBlocks = 12;
    const filled = Math.min(totalBlocks, Math.max(0, Math.round((percent / 100) * totalBlocks)));
    const empty = totalBlocks - filled;
    return '━'.repeat(filled) + '░'.repeat(empty);
  }

  private async executeJob(job: JobQueueItem) {
    job.started_at = new Date().toISOString();
    let tempFilePath: string | undefined;

    try {
      // 1. Status: Downloading
      await this.updateJobStatus(job, 'downloading', { progress: 5 });

      // Update Telegram message if exists
      if (job.message_id && telegramBot.hasToken()) {
        const bar = this.buildProgressBar(10);
        await telegramBot.editMessageText(
          job.chat_id,
          job.message_id,
          `⬇️ <b>جاري تنزيل ${job.media_type === 'audio' ? 'الصوت' : 'الفيديو'}</b>\n${bar} 10%\n\n⚡ جاري الاتصال بالخادم...`
        ).catch(() => {});
      }

      // Download with progress callback
      let lastPercent = 0;
      const downloadResult = await mediaExtractor.downloadMedia({
        url: job.url,
        mediaType: job.media_type,
        onProgress: async (p) => {
          job.progress = Math.round(p.percent);
          job.downloaded_bytes = p.downloadedBytes;
          job.total_bytes = p.totalBytes;
          job.speed_formatted = p.speed;

          if (Math.abs(p.percent - lastPercent) >= 8) {
            lastPercent = p.percent;
            await this.updateJobStatus(job, 'downloading');

            if (job.message_id && telegramBot.hasToken()) {
              const bar = this.buildProgressBar(p.percent);
              const downloadedMB = (p.downloadedBytes / (1024 * 1024)).toFixed(1);
              const totalMB = (p.totalBytes / (1024 * 1024)).toFixed(1);
              const msg = `⬇️ <b>جاري تنزيل ${job.media_type === 'audio' ? 'الصوت' : 'الفيديو'}</b>\n${bar} ${Math.round(p.percent)}%\n\n📦 ${downloadedMB} MB / ${totalMB} MB\n⚡ ${p.speed}`;
              await telegramBot.editMessageText(job.chat_id, job.message_id, msg).catch(() => {});
            }
          }
        },
      });

      tempFilePath = downloadResult.filePath;
      job.temp_file_path = tempFilePath;
      job.title = downloadResult.title || job.title;

      // 2. Status: Processing / Preparing
      await this.updateJobStatus(job, 'processing', { progress: 85 });
      if (job.message_id && telegramBot.hasToken()) {
        await telegramBot.editMessageText(
          job.chat_id,
          job.message_id,
          `⚙️ <b>جاري تجهيز الملف...</b>\n━━━━━━━━━━░░ 85%\n\n📦 الحجم النهائي: ${(downloadResult.fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
        ).catch(() => {});
      }

      // 3. Status: Uploading to Telegram
      await this.updateJobStatus(job, 'uploading', { progress: 95 });
      if (job.message_id && telegramBot.hasToken()) {
        await telegramBot.editMessageText(
          job.chat_id,
          job.message_id,
          `📤 <b>جاري إرسال الملف إلى Telegram...</b>\n━━━━━━━━━━━━ 95%\n\nيرجى الانتظار لحظات.`
        ).catch(() => {});
      }

      // Send to Telegram if real Bot Token is configured
      if (telegramBot.hasToken()) {
        const caption = `🎬 <b>${job.title || 'تم التنزيل بنجاح'}</b>\n\nبواسطة: @NazzilBot`;

        // Check if there is an active advertisement to attach
        const activeAds = await db.listAds(true);
        let adMarkup: any = undefined;
        if (activeAds.length > 0) {
          const ad = activeAds[0];
          await db.incrementAdImpressions(ad.id);
          if (ad.link_url && ad.button_text) {
            adMarkup = {
              inline_keyboard: [
                [{ text: ad.button_text, url: ad.link_url }]
              ]
            };
          }
        }

        if (job.media_type === 'audio') {
          await telegramBot.sendAudio(job.chat_id, tempFilePath, {
            caption,
            title: job.title,
            reply_markup: adMarkup,
          });
        } else {
          await telegramBot.sendVideo(job.chat_id, tempFilePath, {
            caption,
            reply_markup: adMarkup,
          });
        }

        // Send Final Completion confirmation message with Share button & Audio option if YouTube
        const completionButtons: any[][] = [];
        if (job.platform === 'youtube' && job.media_type === 'video') {
          completionButtons.push([
            { text: '🎵 استخراج الصوت MP3', callback_data: `dl:a:${storePendingUrl(job.url)}` }
          ]);
        }
        completionButtons.push([
          {
            text: '↗️ مشاركة البوت',
            url: `https://t.me/share/url?url=https://t.me/NazzilBot&text=${encodeURIComponent('حمل فيديوهات وصوتيات بجودة عالية عبر بوت نَزِّل')}`,
          }
        ]);

        if (job.message_id) {
          await telegramBot.editMessageText(
            job.chat_id,
            job.message_id,
            `✅ <b>تم التحميل بنجاح.</b>\n\nنتمنى لك مشاهدة ممتعة!`,
            {
              reply_markup: {
                inline_keyboard: completionButtons,
              },
            }
          ).catch(() => {});
        }
      }

      // 4. Record successful download in database
      await db.createDownload({
        user_id: job.user_id,
        url: job.url,
        platform: job.platform,
        media_type: job.media_type,
        title: job.title || 'مقطع وسائط',
        file_size: downloadResult.fileSizeBytes,
        duration: downloadResult.duration,
        quality: downloadResult.quality,
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // 5. Status: Completed
      await this.updateJobStatus(job, 'completed', {
        progress: 100,
        completed_at: new Date().toISOString(),
      });
      this.emit('jobCompleted', job);
    } catch (err: any) {
      console.error(`[Queue] Job ${job.job_id} failed:`, err);

      // Retry mechanism: up to 3 tries for transient errors
      if (job.retry_count < 2 && !err?.message?.includes('الملف كبير جدًا')) {
        job.retry_count += 1;
        console.log(`[Queue] Retrying job ${job.job_id}, attempt #${job.retry_count + 1}`);
        this.activeJobs.delete(job.job_id);
        this.queue.unshift(job);
        this.processNext();
        return;
      }

      // Final failure
      const userFacingError =
        err?.message && err.message.startsWith('⚠️')
          ? err.message
          : '⚠️ حدث خطأ أثناء تنزيل الملف.\nيرجى التأكد من أن الرابط متاح للعامة والمحاولة لاحقًا.';

      await this.updateJobStatus(job, 'failed', {
        error: err?.message || 'خطأ غير معروف',
        completed_at: new Date().toISOString(),
      });

      await db.createDownload({
        user_id: job.user_id,
        url: job.url,
        platform: job.platform,
        media_type: job.media_type,
        title: job.title || 'فشل التنزيل',
        file_size: 0,
        status: 'failed',
        error_message: err?.message || 'خطأ أثناء المعالجة',
        completed_at: new Date().toISOString(),
      });

      if (telegramBot.hasToken()) {
        if (job.message_id) {
          await telegramBot.editMessageText(
            job.chat_id,
            job.message_id,
            userFacingError
          ).catch(async () => {
            await telegramBot.sendMessage(job.chat_id, userFacingError).catch(() => {});
          });
        } else {
          await telegramBot.sendMessage(job.chat_id, userFacingError).catch(() => {});
        }
      }

      this.emit('jobFailed', job);
    } finally {
      // Crucial requirement: Clean up temporary files immediately!
      if (tempFilePath) {
        await cleanupFile(tempFilePath);
      }
      this.activeJobs.delete(job.job_id);
      this.processNext();
    }
  }
}

export const jobQueue = new JobQueueManager();
