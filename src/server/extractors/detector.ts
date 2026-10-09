import { PlatformId } from './types.js';

export interface DetectedPlatform {
  id: PlatformId;
  nameArabic: string;
  nameEnglish: string;
  isPriority: boolean;
}

interface PlatformRule {
  id: PlatformId;
  nameArabic: string;
  nameEnglish: string;
  domains: string[];
  patterns?: RegExp[];
  isPriority: boolean;
}

const PLATFORM_REGISTRY: PlatformRule[] = [
  {
    id: 'youtube',
    nameArabic: 'يوتيوب',
    nameEnglish: 'YouTube',
    domains: ['youtube.com', 'youtu.be', 'm.youtube.com', 'music.youtube.com'],
    patterns: [
      /(?:v=|embed\/|watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    ],
    isPriority: true,
  },
  {
    id: 'tiktok',
    nameArabic: 'تيك توك',
    nameEnglish: 'TikTok',
    domains: ['tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com', 'm.tiktok.com'],
    patterns: [
      /\/video\/(\d+)/i,
      /\/v\/(\d+)/i,
      /\/t\/([a-zA-Z0-9_-]+)/i,
      /\/@[^/]+\/video\/(\d+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'instagram',
    nameArabic: 'إنستغرام',
    nameEnglish: 'Instagram',
    domains: ['instagram.com', 'instagr.am', 'ddinstagram.com'],
    patterns: [
      /\/(?:p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'twitter',
    nameArabic: 'إكس (تويتر)',
    nameEnglish: 'X / Twitter',
    domains: ['twitter.com', 'x.com', 'fxtwitter.com', 'vxtwitter.com', 't.co'],
    patterns: [
      /\/status\/(\d+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'facebook',
    nameArabic: 'فيسبوك',
    nameEnglish: 'Facebook',
    domains: ['facebook.com', 'fb.watch', 'm.facebook.com', 'fb.com'],
    patterns: [
      /\/reel\/(\d+)/i,
      /\/watch\/?\?v=(\d+)/i,
      /\/videos\/(\d+)/i,
      /\/share\/[rv]\/([a-zA-Z0-9_-]+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'reddit',
    nameArabic: 'ريديت',
    nameEnglish: 'Reddit',
    domains: ['reddit.com', 'redd.it', 'v.redd.it', 'old.reddit.com'],
    patterns: [
      /\/r\/[^\/]+\/comments\/([a-zA-Z0-9]+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'pinterest',
    nameArabic: 'بينتيريست',
    nameEnglish: 'Pinterest',
    domains: ['pinterest.com', 'pin.it', 'pinterest.co.uk'],
    patterns: [
      /\/pin\/(\d+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'threads',
    nameArabic: 'ثريدز',
    nameEnglish: 'Threads',
    domains: ['threads.net'],
    patterns: [
      /\/post\/([a-zA-Z0-9_-]+)/i,
    ],
    isPriority: true,
  },
  {
    id: 'snapchat',
    nameArabic: 'سناب شات',
    nameEnglish: 'Snapchat',
    domains: ['snapchat.com', 'story.snapchat.com'],
    patterns: [
      /\/p\/([a-zA-Z0-9_-]+)/i,
    ],
    isPriority: false,
  },
];

export function detectPlatform(urlStr: string): DetectedPlatform {
  let hostname = '';
  let pathname = '';

  try {
    const parsed = new URL(urlStr);
    hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    pathname = parsed.pathname;
  } catch {
    return {
      id: 'generic',
      nameArabic: 'موقع عام',
      nameEnglish: 'Generic Web',
      isPriority: false,
    };
  }

  // 1. Check Shorts first specifically
  if (
    (hostname === 'youtube.com' || hostname === 'm.youtube.com') &&
    (pathname.includes('/shorts/') || pathname.startsWith('/shorts'))
  ) {
    return {
      id: 'youtube_shorts',
      nameArabic: 'يوتيوب شورتس',
      nameEnglish: 'YouTube Shorts',
      isPriority: true,
    };
  }

  // 2. Match known platforms by domain and regex
  for (const rule of PLATFORM_REGISTRY) {
    const domainMatch = rule.domains.some(
      (d) => hostname === d || hostname.endsWith(`.${d}`)
    );
    if (domainMatch) {
      return {
        id: rule.id,
        nameArabic: rule.nameArabic,
        nameEnglish: rule.nameEnglish,
        isPriority: rule.isPriority,
      };
    }
  }

  // 3. Fallback to Generic Web Engine
  return {
    id: 'generic',
    nameArabic: 'موقع عام (محرك شامل)',
    nameEnglish: 'Generic Web Platform',
    isPriority: false,
  };
}

export function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return 'غير محدد';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const h = Math.floor(m / 60);
  const remM = m % 60;

  if (h > 0) {
    return `${h.toString().padStart(2, '0')}:${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${remM.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return 'سيتم تحديده أثناء التحميل';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let unitIndex = 0;
  while (val >= 1024 && unitIndex < units.length - 1) {
    val /= 1024;
    unitIndex++;
  }
  return `${val.toFixed(1)} ${units[unitIndex]}`;
}
