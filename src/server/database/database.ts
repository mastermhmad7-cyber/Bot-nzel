import fs from 'fs';
import path from 'path';
import {
  User,
  DownloadRecord,
  RequiredChannel,
  AdItem,
  SystemSettings,
  AdminLog,
  JobQueueItem,
} from './types.js';

interface DatabaseSchema {
  users: Record<number, User>;
  downloads: DownloadRecord[];
  required_channels: RequiredChannel[];
  ads: AdItem[];
  settings: SystemSettings;
  admin_logs: AdminLog[];
  jobs: Record<string, JobQueueItem>;
}

export interface IDatabaseProvider {
  // Users
  getUser(telegramId: number): Promise<User | null>;
  upsertUser(user: Partial<User> & { telegram_id: number }): Promise<User>;
  listUsers(search?: string, limit?: number, offset?: number): Promise<{ users: User[]; total: number }>;
  setUserBan(telegramId: number, isBanned: boolean): Promise<boolean>;
  countUsers(): Promise<{ total: number; activeToday: number; banned: number }>;

  // Downloads
  createDownload(download: Omit<DownloadRecord, 'id' | 'created_at'>): Promise<DownloadRecord>;
  updateDownload(id: string, updates: Partial<DownloadRecord>): Promise<boolean>;
  listDownloads(limit?: number, offset?: number): Promise<{ downloads: DownloadRecord[]; total: number }>;
  getDownloadStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    totalBytes: number;
    platformBreakdown: Record<string, number>;
    mediaTypeBreakdown: Record<string, number>;
    dailyDownloads: Array<{ date: string; count: number; bytes: number }>;
  }>;

  // Required Channels
  listRequiredChannels(onlyActive?: boolean): Promise<RequiredChannel[]>;
  getRequiredChannel(id: string): Promise<RequiredChannel | null>;
  addRequiredChannel(channel: Omit<RequiredChannel, 'id' | 'created_at'>): Promise<RequiredChannel>;
  updateRequiredChannel(id: string, updates: Partial<RequiredChannel>): Promise<boolean>;
  deleteRequiredChannel(id: string): Promise<boolean>;

  // Ads
  listAds(onlyActive?: boolean): Promise<AdItem[]>;
  getAd(id: string): Promise<AdItem | null>;
  addAd(ad: Omit<AdItem, 'id' | 'impressions' | 'created_at'>): Promise<AdItem>;
  updateAd(id: string, updates: Partial<AdItem>): Promise<boolean>;
  deleteAd(id: string): Promise<boolean>;
  incrementAdImpressions(id: string): Promise<void>;

  // Settings
  getSettings(): Promise<SystemSettings>;
  updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings>;

  // Admin Logs
  addAdminLog(log: Omit<AdminLog, 'id' | 'timestamp'>): Promise<AdminLog>;
  listAdminLogs(limit?: number): Promise<AdminLog[]>;

  // Job Queue
  saveJob(job: JobQueueItem): Promise<void>;
  getJob(jobId: string): Promise<JobQueueItem | null>;
  listJobs(limit?: number): Promise<JobQueueItem[]>;
}

export class JsonFileDatabase implements IDatabaseProvider {
  private dbPath: string;
  private data: DatabaseSchema;
  private saveTimeout: NodeJS.Timeout | null = null;
  private isSaving = false;

  constructor(customPath?: string) {
    const baseDir = path.resolve(process.cwd(), 'data');
    if (!fs.existsSync(baseDir)) {
      fs.mkdirSync(baseDir, { recursive: true });
    }
    this.dbPath = customPath || path.join(baseDir, 'nazzil_db.json');
    this.data = this.loadInitialData();
  }

  private getDefaultSettings(): SystemSettings {
    return {
      bot_token: process.env.TELEGRAM_BOT_TOKEN || '',
      admin_telegram_id: process.env.ADMIN_TELEGRAM_ID || '',
      webhook_url: process.env.WEBHOOK_URL || '',
      webhook_secret: process.env.WEBHOOK_SECRET || 'nazzil_secret_key',
      max_file_size_mb: parseInt(process.env.MAX_FILE_SIZE_MB || '1024', 10),
      max_concurrent_jobs: parseInt(process.env.MAX_CONCURRENT_JOBS || '3', 10),
      ad_frequency: 'every_3',
      cleanup_interval_minutes: 15,
      is_maintenance_mode: false,
    };
  }

  private loadInitialData(): DatabaseSchema {
    const defaults: DatabaseSchema = {
      users: {},
      downloads: [],
      required_channels: [
        {
          id: 'ch-default-1',
          channel_name: 'قناة التحديثات الرسمية',
          channel_username: '@NazzilUpdates',
          invite_link: 'https://t.me/telegram',
          is_active: false,
          order: 1,
          created_at: new Date().toISOString(),
        }
      ],
      ads: [
        {
          id: 'ad-default-1',
          title: 'بوت نَزِّل المميز',
          text: '⚡ حمل أي فيديو بسهولة وبأعلى جودة مع بوت نَزِّل!',
          link_url: 'https://t.me/share/url?url=https://t.me/NazzilBot&text=%D8%AD%D9%85%D9%84%20%D8%A3%D9%8A%20%D9%81%D9%8A%D8%AF%D9%8A%D9%88%20%D8%A8%D8%B3%D9%87%D9%88%D9%84%D8%A9',
          button_text: '📢 انشر البوت لأصدقائك',
          ad_type: 'inline_button',
          impressions: 42,
          is_active: true,
          order: 1,
          created_at: new Date().toISOString(),
        }
      ],
      settings: this.getDefaultSettings(),
      admin_logs: [
        {
          id: 'log-init',
          action: 'SYSTEM_INIT',
          details: 'تم بدء تشغيل منصة نَزِّل بنجاح',
          admin_id: 'SYSTEM',
          timestamp: new Date().toISOString(),
        }
      ],
      jobs: {},
    };

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
          ...defaults,
          ...parsed,
          settings: { ...defaults.settings, ...(parsed.settings || {}) },
        };
      } catch (err) {
        console.error('[Database] Failed to read existing db, initializing defaults', err);
        return defaults;
      }
    }

    this.persistSync(defaults);
    return defaults;
  }

  private persistSync(data: DatabaseSchema): void {
    try {
      const tempPath = `${this.dbPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
      fs.renameSync(tempPath, this.dbPath);
    } catch (err) {
      console.error('[Database] Error persisting data synchronously:', err);
    }
  }

  private scheduleSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.persist();
    }, 150);
  }

  private async persist(): Promise<void> {
    if (this.isSaving) return;
    this.isSaving = true;
    try {
      const tempPath = `${this.dbPath}.tmp.${Date.now()}`;
      await fs.promises.writeFile(tempPath, JSON.stringify(this.data, null, 2), 'utf8');
      await fs.promises.rename(tempPath, this.dbPath);
    } catch (err) {
      console.error('[Database] Error persisting data to disk:', err);
    } finally {
      this.isSaving = false;
    }
  }

  // --- Users ---
  async getUser(telegramId: number): Promise<User | null> {
    return this.data.users[telegramId] || null;
  }

  async upsertUser(userData: Partial<User> & { telegram_id: number }): Promise<User> {
    const existing = this.data.users[userData.telegram_id];
    const now = new Date().toISOString();
    const adminId = this.data.settings.admin_telegram_id;
    const isAdmin =
      userData.telegram_id.toString() === adminId ||
      existing?.is_admin ||
      false;

    const updatedUser: User = {
      telegram_id: userData.telegram_id,
      username: userData.username ?? existing?.username ?? '',
      first_name: userData.first_name ?? existing?.first_name ?? '',
      last_name: userData.last_name ?? existing?.last_name ?? '',
      language: userData.language ?? existing?.language ?? 'ar',
      joined_at: existing ? existing.joined_at : now,
      last_activity: now,
      downloads_count: (existing?.downloads_count || 0) + (userData.downloads_count ? userData.downloads_count : 0),
      is_banned: existing ? existing.is_banned : false,
      is_admin: isAdmin,
    };

    this.data.users[userData.telegram_id] = updatedUser;
    this.scheduleSave();
    return updatedUser;
  }

  async listUsers(search?: string, limit = 50, offset = 0): Promise<{ users: User[]; total: number }> {
    let list = Object.values(this.data.users);
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.telegram_id.toString().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.first_name.toLowerCase().includes(q) ||
          u.last_name.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime());
    const total = list.length;
    const paginated = list.slice(offset, offset + limit);
    return { users: paginated, total };
  }

  async setUserBan(telegramId: number, isBanned: boolean): Promise<boolean> {
    if (!this.data.users[telegramId]) return false;
    this.data.users[telegramId].is_banned = isBanned;
    this.scheduleSave();
    return true;
  }

  async countUsers(): Promise<{ total: number; activeToday: number; banned: number }> {
    const users = Object.values(this.data.users);
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeToday = users.filter((u) => u.last_activity.slice(0, 10) === todayStr).length;
    const banned = users.filter((u) => u.is_banned).length;
    return {
      total: users.length,
      activeToday,
      banned,
    };
  }

  // --- Downloads ---
  async createDownload(download: Omit<DownloadRecord, 'id' | 'created_at'>): Promise<DownloadRecord> {
    const id = `dl-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();
    const record: DownloadRecord = {
      ...download,
      id,
      created_at: now,
    };
    this.data.downloads.unshift(record);

    // Keep memory bounded to last 5,000 records
    if (this.data.downloads.length > 5000) {
      this.data.downloads = this.data.downloads.slice(0, 5000);
    }

    // Increment user's download count
    if (download.status === 'completed' && this.data.users[download.user_id]) {
      this.data.users[download.user_id].downloads_count += 1;
      this.data.users[download.user_id].last_activity = now;
    }

    this.scheduleSave();
    return record;
  }

  async updateDownload(id: string, updates: Partial<DownloadRecord>): Promise<boolean> {
    const index = this.data.downloads.findIndex((d) => d.id === id);
    if (index === -1) return false;
    this.data.downloads[index] = { ...this.data.downloads[index], ...updates };
    this.scheduleSave();
    return true;
  }

  async listDownloads(limit = 50, offset = 0): Promise<{ downloads: DownloadRecord[]; total: number }> {
    const total = this.data.downloads.length;
    const paginated = this.data.downloads.slice(offset, offset + limit);
    return { downloads: paginated, total };
  }

  async getDownloadStats(): Promise<{
    total: number;
    completed: number;
    failed: number;
    totalBytes: number;
    platformBreakdown: Record<string, number>;
    mediaTypeBreakdown: Record<string, number>;
    dailyDownloads: Array<{ date: string; count: number; bytes: number }>;
  }> {
    const downloads = this.data.downloads;
    const total = downloads.length;
    let completed = 0;
    let failed = 0;
    let totalBytes = 0;
    const platformBreakdown: Record<string, number> = {};
    const mediaTypeBreakdown: Record<string, number> = { video: 0, audio: 0 };
    const dailyMap: Record<string, { count: number; bytes: number }> = {};

    // Pre-populate last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateKey = d.toISOString().slice(0, 10);
      dailyMap[dateKey] = { count: 0, bytes: 0 };
    }

    for (const d of downloads) {
      if (d.status === 'completed') {
        completed++;
        totalBytes += d.file_size || 0;
      } else {
        failed++;
      }

      const p = d.platform || 'other';
      platformBreakdown[p] = (platformBreakdown[p] || 0) + 1;

      const mt = d.media_type || 'video';
      mediaTypeBreakdown[mt] = (mediaTypeBreakdown[mt] || 0) + 1;

      const day = (d.created_at || '').slice(0, 10);
      if (dailyMap[day]) {
        dailyMap[day].count++;
        if (d.status === 'completed') {
          dailyMap[day].bytes += d.file_size || 0;
        }
      }
    }

    const dailyDownloads = Object.entries(dailyMap).map(([date, val]) => ({
      date,
      count: val.count,
      bytes: val.bytes,
    }));

    return {
      total,
      completed,
      failed,
      totalBytes,
      platformBreakdown,
      mediaTypeBreakdown,
      dailyDownloads,
    };
  }

  // --- Required Channels ---
  async listRequiredChannels(onlyActive = false): Promise<RequiredChannel[]> {
    let channels = [...this.data.required_channels];
    if (onlyActive) {
      channels = channels.filter((c) => c.is_active);
    }
    return channels.sort((a, b) => a.order - b.order);
  }

  async getRequiredChannel(id: string): Promise<RequiredChannel | null> {
    return this.data.required_channels.find((c) => c.id === id) || null;
  }

  async addRequiredChannel(channel: Omit<RequiredChannel, 'id' | 'created_at'>): Promise<RequiredChannel> {
    const id = `ch-${Date.now()}`;
    const newChan: RequiredChannel = {
      ...channel,
      id,
      created_at: new Date().toISOString(),
    };
    this.data.required_channels.push(newChan);
    this.scheduleSave();
    return newChan;
  }

  async updateRequiredChannel(id: string, updates: Partial<RequiredChannel>): Promise<boolean> {
    const idx = this.data.required_channels.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    this.data.required_channels[idx] = { ...this.data.required_channels[idx], ...updates };
    this.scheduleSave();
    return true;
  }

  async deleteRequiredChannel(id: string): Promise<boolean> {
    const initialLen = this.data.required_channels.length;
    this.data.required_channels = this.data.required_channels.filter((c) => c.id !== id);
    const deleted = this.data.required_channels.length < initialLen;
    if (deleted) this.scheduleSave();
    return deleted;
  }

  // --- Ads ---
  async listAds(onlyActive = false): Promise<AdItem[]> {
    let ads = [...this.data.ads];
    if (onlyActive) {
      ads = ads.filter((a) => a.is_active);
    }
    return ads.sort((a, b) => a.order - b.order);
  }

  async getAd(id: string): Promise<AdItem | null> {
    return this.data.ads.find((a) => a.id === id) || null;
  }

  async addAd(ad: Omit<AdItem, 'id' | 'impressions' | 'created_at'>): Promise<AdItem> {
    const id = `ad-${Date.now()}`;
    const newAd: AdItem = {
      ...ad,
      id,
      impressions: 0,
      created_at: new Date().toISOString(),
    };
    this.data.ads.push(newAd);
    this.scheduleSave();
    return newAd;
  }

  async updateAd(id: string, updates: Partial<AdItem>): Promise<boolean> {
    const idx = this.data.ads.findIndex((a) => a.id === id);
    if (idx === -1) return false;
    this.data.ads[idx] = { ...this.data.ads[idx], ...updates };
    this.scheduleSave();
    return true;
  }

  async deleteAd(id: string): Promise<boolean> {
    const initialLen = this.data.ads.length;
    this.data.ads = this.data.ads.filter((a) => a.id !== id);
    const deleted = this.data.ads.length < initialLen;
    if (deleted) this.scheduleSave();
    return deleted;
  }

  async incrementAdImpressions(id: string): Promise<void> {
    const ad = this.data.ads.find((a) => a.id === id);
    if (ad) {
      ad.impressions = (ad.impressions || 0) + 1;
      this.scheduleSave();
    }
  }

  // --- Settings ---
  async getSettings(): Promise<SystemSettings> {
    return { ...this.data.settings };
  }

  async updateSettings(updates: Partial<SystemSettings>): Promise<SystemSettings> {
    this.data.settings = { ...this.data.settings, ...updates };
    this.scheduleSave();
    return { ...this.data.settings };
  }

  // --- Admin Logs ---
  async addAdminLog(log: Omit<AdminLog, 'id' | 'timestamp'>): Promise<AdminLog> {
    const item: AdminLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    this.data.admin_logs.unshift(item);
    if (this.data.admin_logs.length > 1000) {
      this.data.admin_logs = this.data.admin_logs.slice(0, 1000);
    }
    this.scheduleSave();
    return item;
  }

  async listAdminLogs(limit = 100): Promise<AdminLog[]> {
    return this.data.admin_logs.slice(0, limit);
  }

  // --- Jobs ---
  async saveJob(job: JobQueueItem): Promise<void> {
    this.data.jobs[job.job_id] = { ...job };
    this.scheduleSave();
  }

  async getJob(jobId: string): Promise<JobQueueItem | null> {
    return this.data.jobs[jobId] || null;
  }

  async listJobs(limit = 100): Promise<JobQueueItem[]> {
    const list = Object.values(this.data.jobs);
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return list.slice(0, limit);
  }
}

// Global Database Singleton instance
export const db: IDatabaseProvider = new JsonFileDatabase();
