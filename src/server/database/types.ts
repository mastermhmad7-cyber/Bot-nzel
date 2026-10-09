export interface User {
  telegram_id: number;
  username: string;
  first_name: string;
  last_name: string;
  language: string;
  joined_at: string;
  last_activity: string;
  downloads_count: number;
  is_banned: boolean;
  is_admin: boolean;
}

export type JobStatus =
  | 'queued'
  | 'analyzing'
  | 'downloading'
  | 'processing'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface DownloadRecord {
  id: string;
  user_id: number;
  username?: string;
  url: string;
  platform: string;
  media_type: 'video' | 'audio';
  title: string;
  file_size: number; // in bytes
  file_size_formatted?: string;
  duration?: number; // seconds
  quality?: string;
  status: 'completed' | 'failed' | 'rejected_size';
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface RequiredChannel {
  id: string;
  channel_name: string;
  channel_username: string; // e.g. @channel or numeric chat_id
  invite_link: string;
  is_active: boolean;
  order: number;
  created_at: string;
}

export type AdFrequency =
  | 'every_download'
  | 'every_2'
  | 'every_3'
  | 'every_5'
  | 'once_daily'
  | 'disabled';

export interface AdItem {
  id: string;
  title: string;
  text: string;
  link_url?: string;
  button_text?: string;
  ad_type: 'banner_text' | 'inline_button' | 'caption_link';
  impressions: number;
  is_active: boolean;
  order: number;
  created_at: string;
}

export interface SystemSettings {
  bot_token: string;
  admin_telegram_id: string;
  webhook_url: string;
  webhook_secret: string;
  max_file_size_mb: number; // default 1024 (1GB)
  max_concurrent_jobs: number; // default 3
  ad_frequency: AdFrequency;
  cleanup_interval_minutes: number;
  is_maintenance_mode: boolean;
  cookies_content?: string;
}

export interface AdminLog {
  id: string;
  action: string;
  details: string;
  admin_id: string;
  ip_address?: string;
  timestamp: string;
}

export interface JobQueueItem {
  job_id: string;
  user_id: number;
  chat_id: number;
  message_id?: number;
  url: string;
  platform: string;
  media_type: 'video' | 'audio';
  title?: string;
  status: JobStatus;
  progress: number; // 0 - 100
  downloaded_bytes?: number;
  total_bytes?: number;
  speed_formatted?: string;
  error?: string;
  retry_count: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  temp_file_path?: string;
}
