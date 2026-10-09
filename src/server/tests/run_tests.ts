import { validateAndCleanUrl } from '../security/validator.js';
import { detectPlatform, formatBytes, formatDuration } from '../extractors/detector.js';
import { generateAdminSessionToken, isValidAdminSession } from '../security/auth.js';
import { db } from '../database/database.js';
import { jobQueue } from '../queue/queue.js';
import { MAX_FILE_SIZE_BYTES } from '../media/processor.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ [PASS] ${testName}`);
  } else {
    failed++;
    console.error(`  ❌ [FAIL] ${testName} ${details ? `(${details})` : ''}`);
  }
}

async function runAllTests() {
  console.log('\n==================================================');
  console.log('       اختبارات منصة «نَزِّل» - UNIT & INTEGRATION TESTS');
  console.log('==================================================\n');

  // Test Group 1: URL Validation & SSRF Protection
  console.log('1. اختبار فحص الروابط والحماية من SSRF:');
  const validUrl = validateAndCleanUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert(validUrl.isValid === true, 'التحقق من رابط يوتيوب صالح');

  const urlWithSpaces = validateAndCleanUrl('   https://youtu.be/dQw4w9WgXcQ  ');
  assert(urlWithSpaces.isValid === true, 'تنظيف الرابط وإزالة المسافات الزائدة');

  const invalidUrl = validateAndCleanUrl('not-a-valid-url');
  assert(invalidUrl.isValid === false, 'رفض النصوص التي لا تمثل روابط');

  const ssrfLocalhost = validateAndCleanUrl('http://localhost:8080/admin');
  assert(ssrfLocalhost.isValid === false, 'منع الوصول لـ localhost (SSRF)');

  const ssrfPrivateIp = validateAndCleanUrl('http://192.168.1.100/secret');
  assert(ssrfPrivateIp.isValid === false, 'منع الوصول لعناوين 192.168.x.x (SSRF)');

  const ssrfCloudMeta = validateAndCleanUrl('http://169.254.169.254/latest/meta-data');
  assert(ssrfCloudMeta.isValid === false, 'منع الوصول لبيانات خوادم السحاب 169.254.x.x (SSRF)');

  // Test Group 2: Platform Detection
  console.log('\n2. اختبار اكتشاف المنصات التلقائي (Platform Detection Layer):');
  const yt = detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert(yt.id === 'youtube', 'اكتشاف منصة يوتيوب العادية');

  const ytShorts = detectPlatform('https://www.youtube.com/shorts/abcdefghijk');
  assert(ytShorts.id === 'youtube_shorts', 'اكتشاف يوتيوب شورتس Shorts');

  const tiktok = detectPlatform('https://www.tiktok.com/@user/video/71234567890');
  assert(tiktok.id === 'tiktok', 'اكتشاف منصة تيك توك TikTok');

  const insta = detectPlatform('https://www.instagram.com/reel/C3xYz1234/');
  assert(insta.id === 'instagram', 'اكتشاف منصة إنستغرام Instagram');

  const twitter = detectPlatform('https://x.com/user/status/1234567890');
  assert(twitter.id === 'twitter', 'اكتشاف منصة إكس X / Twitter');

  const facebook = detectPlatform('https://www.facebook.com/reel/123456789');
  assert(facebook.id === 'facebook', 'اكتشاف منصة فيسبوك Facebook');

  const reddit = detectPlatform('https://www.reddit.com/r/videos/comments/xyz/test');
  assert(reddit.id === 'reddit', 'اكتشاف منصة ريديت Reddit');

  const pinterest = detectPlatform('https://www.pinterest.com/pin/123456789/');
  assert(pinterest.id === 'pinterest', 'اكتشاف منصة بينتيريست Pinterest');

  const generic = detectPlatform('https://example.com/videos/sample.mp4');
  assert(generic.id === 'generic', 'تحويل المواقع غير المعروفة إلى المحرك العام Generic Engine');

  // Test Group 3: File Size Validation & Formatting
  console.log('\n3. اختبار حدود الحجم وتنسيق البيانات:');
  assert(MAX_FILE_SIZE_BYTES === 1073741824, 'الحد الأقصى المطلق هو 1GB تماماً');
  assert(formatBytes(10485760) === '10.0 MB', 'تنسيق حجم 10MB بشكل صحيح');
  assert(formatBytes(1073741824) === '1.0 GB', 'تنسيق حجم 1GB بشكل صحيح');
  assert(formatDuration(185) === '03:05', 'تنسيق المدة 185 ثانية إلى 03:05');
  assert(formatDuration(3665) === '01:01:05', 'تنسيق المدة الطويلة بالساعات');

  // Test Group 4: Admin Authorization & Session Tokens
  console.log('\n4. اختبار أمان لوحة الإدارة ومصادقة الجلسات:');
  const sessionToken = generateAdminSessionToken('admin_user_1');
  assert(typeof sessionToken === 'string' && sessionToken.length > 20, 'توليد توكن إدارة مشفر');
  assert(isValidAdminSession(sessionToken) === true, 'التحقق من صحة توكن الجلسة النشط');
  assert(isValidAdminSession('invalid_fake_token') === false, 'رفض التوكنات المزورة وغير الصالحة');

  // Test Group 5: Database Operations & Subscription/Ads Management
  console.log('\n5. اختبار قاعدة البيانات والعمليات الأساسية:');
  const testUser = await db.upsertUser({
    telegram_id: 11223344,
    username: 'tester_pro',
    first_name: 'أحمد',
  });
  assert(testUser.telegram_id === 11223344, 'إنشاء وتحديث المستخدم في قاعدة البيانات');

  await db.setUserBan(11223344, true);
  const bannedUser = await db.getUser(11223344);
  assert(bannedUser?.is_banned === true, 'حظر المستخدم بنجاح');

  await db.setUserBan(11223344, false);
  const unbannedUser = await db.getUser(11223344);
  assert(unbannedUser?.is_banned === false, 'إلغاء حظر المستخدم بنجاح');

  const channel = await db.addRequiredChannel({
    channel_name: 'قناة تجريبية',
    channel_username: '@TestChannel',
    invite_link: 'https://t.me/TestChannel',
    is_active: true,
    order: 1,
  });
  assert(channel.channel_username === '@TestChannel', 'إضافة قناة اشتراك إجباري');
  await db.deleteRequiredChannel(channel.id);

  // Test Group 6: Job Queue Operations
  console.log('\n6. اختبار طابور المهام (Job Queue):');
  const job = await jobQueue.addJob({
    userId: 11223344,
    chatId: 11223344,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    platform: 'youtube',
    mediaType: 'video',
  });
  assert(job.job_id.startsWith('job_'), 'إنشاء مهمة تنزيل جديدة في الطابور');
  assert(job.status === 'queued' || job.status === 'downloading', 'حالة المهمة الابتدائية في الطابور');

  const cancelled = await jobQueue.cancelJob(job.job_id);
  assert(cancelled === true, 'إلغاء المهمة من الطابور بأمان');

  console.log('\n==================================================');
  console.log(`نتيجة الاختبارات: ${passed} ناجح | ${failed} فاشل`);
  console.log('==================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
