export type PlatformId =
  | 'youtube'
  | 'youtube_shorts'
  | 'tiktok'
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'reddit'
  | 'pinterest'
  | 'snapchat'
  | 'threads'
  | 'generic';

export interface MediaFormat {
  formatId: string;
  quality: string;
  ext: string;
  fileSize?: number;
  vcodec?: string;
  acodec?: string;
  hasVideo: boolean;
  hasAudio: boolean;
  directUrl?: string;
}

export interface MediaMetadata {
  platform: PlatformId;
  platformNameArabic: string;
  title: string;
  url: string;
  thumbnail?: string;
  duration?: number; // in seconds
  durationFormatted?: string;
  bestQuality?: string;
  estimatedVideoSizeBytes?: number;
  estimatedAudioSizeBytes?: number;
  estimatedSizeFormatted?: string;
  isOverSizeLimit: boolean;
  supportsAudioExtraction: boolean;
  isLiveStream?: boolean;
}

export interface DownloadProgress {
  percent: number; // 0 - 100
  downloadedBytes: number;
  totalBytes: number;
  speed: string; // e.g. "4.8 MB/s"
  etaSeconds?: number;
}
