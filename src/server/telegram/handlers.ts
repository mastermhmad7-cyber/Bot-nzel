import { db } from '../database/database.js';
import { validateAndCleanUrl, userRateLimiter } from '../security/validator.js';
import { mediaExtractor } from '../extractors/index.js';
import { telegramBot } from './client.js';
import { jobQueue } from '../queue/queue.js';
import { handleAdminCommand, handleAdminCallback, isUserAdmin } from './admin.js';

// In-memory cache to keep callback_data under Telegram's strict 64-byte limit
const pendingUrlCache = new Map<string, { url: string; time: number }>();

export function storePendingUrl(url: string): string {
  const key = Math.random().toString(36).substring(2, 10);
  pendingUrlCache.set(key, { url, time: Date.now() });

  if (pendingUrlCache.size > 2000) {
    const expired = Date.now() - 4 * 3600 * 1000;
    for (const [k, v] of pendingUrlCache.entries()) {
      if (v.time < expired) pendingUrlCache.delete(k);
    }
  }
  return key;
}

export function resolvePendingUrl(keyOrUrl: string): string {
  if (!keyOrUrl) return '';
  const cached = pendingUrlCache.get(keyOrUrl);
  if (cached) return cached.url;
  return keyOrUrl;
}

export async function checkUserSubscription(userId: number): Promise<{ subscribed: boolean; missingChannels: any[] }> {
  const channels = await db.listRequiredChannels(true);
  if (channels.length === 0) {
    return { subscribed: true, missingChannels: [] };
  }

  // If Bot Token isn't configured yet, bypass to avoid blocking testing
  if (!telegramBot.hasToken()) {
    return { subscribed: true, missingChannels: [] };
  }

  const missing: any[] = [];
  for (const ch of channels) {
    try {
      const chatIdentifier = ch.channel_username.startsWith('@')
        ? ch.channel_username
        : ch.channel_username;

      const res = await telegramBot.getChatMember(chatIdentifier, userId);
      if (res && res.ok && res.result) {
        const status = res.result.status;
        if (status !== 'creator' && status !== 'administrator' && status !== 'member') {
          missing.push(ch);
        }
      } else {
        // If bot cannot verify (e.g. not admin in channel), log warning
        console.warn(`[Subscription] Bot cannot verify channel ${ch.channel_username}:`, res?.description);
      }
    } catch (err) {
      console.error(`[Subscription] Verification error for channel ${ch.channel_username}:`, err);
    }
  }

  return {
    subscribed: missing.length === 0,
    missingChannels: missing,
  };
}

export async function handleTelegramUpdate(update: any) {
  try {
    // 1. Handle incoming message
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat?.id;
      const text = msg.text || '';
      const from = msg.from;

      if (!chatId || !from) return;

      // Register or update user
      const user = await db.upsertUser({
        telegram_id: from.id,
        username: from.username || '',
        first_name: from.first_name || '',
        last_name: from.last_name || '',
        language: from.language_code || 'ar',
      });

      if (user.is_banned) {
        await telegramBot.sendMessage(chatId, '⛔ <b>حسابك محظور من استخدام المنصة حالياً.</b>');
        return;
      }

      // Handle Commands
      if (text.startsWith('/start')) {
        await handleStartCommand(chatId, from.id);
        return;
      }

      if (text.startsWith('/admin')) {
        await handleAdminCommand(chatId, from.id);
        return;
      }

      if (text.startsWith('/cookies')) {
        const isAdmin = await isUserAdmin(from.id);
        if (!isAdmin) {
          await telegramBot.sendMessage(chatId, '⛔ هذا الأمر مخصص لمشرفي النظام فقط.');
          return;
        }
        const cookiesText = text.replace('/cookies', '').trim();
        if (!cookiesText) {
          await telegramBot.sendMessage(
            chatId,
            `🍪 <b>تحديث ملف تعريف الارتباط (YouTube Cookies):</b>\n\nأرسل محتوى ملف الكوكيز بعد الأمر مباشرة:\n<code>/cookies # Netscape HTTP Cookie File...</code>\n\nأو يمكنك حفظه من خلال لوحة الإدارة على الويب.`
          );
          return;
        }
        await db.updateSettings({ cookies_content: cookiesText });
        await telegramBot.sendMessage(chatId, '✅ <b>تم حفظ ملف الكوكيز بنجاح!</b>\nسيتم استخدامه لتخطي حماية YouTube والمنصات المحمية فورياً.');
        return;
      }

      if (text.startsWith('/help')) {
        await handleHelpCommand(chatId);
        return;
      }

      if (text.startsWith('/stats')) {
        await handleStatsCommand(chatId, user);
        return;
      }

      // Check if text contains a URL
      const validation = validateAndCleanUrl(text);
      if (validation.isValid && validation.cleanUrl) {
        await handleMediaUrl(chatId, from.id, validation.cleanUrl);
      } else if (text.trim().startsWith('http://') || text.trim().startsWith('https://')) {
        await telegramBot.sendMessage(chatId, `⚠️ <b>الرابط غير صالح</b>\n${validation.error || 'يرجى إرسال رابط صحيح يبدأ بـ https://'}`);
      } else {
        // Inform user politely to send a link
        await telegramBot.sendMessage(
          chatId,
          '👋 أهلاً بك! يرجى إرسال رابط فيديو مباشر من يوتيوب، تيك توك، إنستغرام، فيسبوك، إكس أو أي منصة أخرى لبدء التحميل فوراً.'
        );
      }
    }

    // 2. Handle Callback Queries (button clicks)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query);
    }
  } catch (err: any) {
    console.error('[Telegram Handler] Unexpected error processing update:', err);
  }
}

async function handleStartCommand(chatId: number, userId?: number) {
  const welcomeText = `مرحبًا بك في «نَزِّل» 👋\n\nأرسل رابط الفيديو، وسأحاول تحميله لك بأعلى جودة متاحة.`;

  const inlineKeyboard: any[][] = [
    [
      { text: 'ℹ️ طريقة الاستخدام', callback_data: 'cmd:help' },
      {
        text: '📢 مشاركة البوت',
        url: `https://t.me/share/url?url=https://t.me/Nazelbot&text=${encodeURIComponent('حمل أي فيديو بأعلى جودة مع بوت نَزِّل 🚀')}`,
      },
    ],
  ];

  if (userId) {
    const isAdmin = await isUserAdmin(userId);
    if (isAdmin) {
      inlineKeyboard.push([
        { text: '👑 لوحة تحكم المشرف (Admin)', callback_data: 'admin:back' },
      ]);
    }
  }

  await telegramBot.sendMessage(chatId, welcomeText, {
    reply_markup: { inline_keyboard: inlineKeyboard },
  });
}

async function handleHelpCommand(chatId: number) {
  const helpText = `📖 <b>دليل استخدام «نَزِّل»</b>\n\n` +
    `1️⃣ انسخ رابط الفيديو من أي تطبيق.\n` +
    `2️⃣ ألصق الرابط هنا وأرسله مباشرة.\n` +
    `3️⃣ سيقوم النظام بتحليل الرابط واكتشاف المنصة وحساب الحجم تلقائياً.\n` +
    `4️⃣ اضغط على [🎬 تحميل الفيديو] أو [🎵 استخراج الصوت] للبدء.\n\n` +
    `🚀 <b>المنصات المدعومة:</b>\n` +
    `• YouTube و Shorts\n` +
    `• TikTok (بدون علامة مائية)\n` +
    `• Instagram (Reels & Posts)\n` +
    `• Facebook\n` +
    `• X / Twitter\n` +
    `• Reddit\n` +
    `• Pinterest ومواقع أخرى متعددة\n\n` +
    `⚡ <b>ملاحظة:</b> الحد الأقصى للملفات هو 1GB.`;

  await telegramBot.sendMessage(chatId, helpText);
}

async function handleStatsCommand(chatId: number, user: any) {
  const stats = await db.getDownloadStats();
  const text = `📊 <b>إحصائيات نَزِّل</b>\n\n` +
    `👤 <b>تحميلاتك الشخصية:</b> ${user.downloads_count || 0}\n` +
    `📦 <b>إجمالي التحميلات المكتملة:</b> ${stats.completed}\n` +
    `💾 <b>إجمالي البيانات المعالجة:</b> ${(stats.totalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB\n\n` +
    `نحن سعداء بخدمتك دائماً!`;

  await telegramBot.sendMessage(chatId, text);
}

async function handleMediaUrl(chatId: number, userId: number, cleanUrl: string) {
  // Rate limiting check
  const rateLimit = userRateLimiter.isAllowed(userId.toString());
  if (!rateLimit.allowed) {
    await telegramBot.sendMessage(
      chatId,
      `⏳ <b>تم تجاوز حد الطلبات</b>\nيرجى الانتظار لمدة ${rateLimit.retryAfterSeconds} ثانية قبل إرسال طلب جديد.`
    );
    return;
  }

  // 1. Mandatory subscription check
  const subCheck = await checkUserSubscription(userId);
  if (!subCheck.subscribed && subCheck.missingChannels.length > 0) {
    const channelButtons: any[][] = subCheck.missingChannels.map((ch, idx) => [
      {
        text: `📢 ${ch.channel_name || `القناة ${idx + 1}`}`,
        url: ch.invite_link || `https://t.me/${ch.channel_username.replace('@', '')}`,
      },
    ]);

    channelButtons.push([
      { text: '✅ تحقق من الاشتراك', callback_data: `verify_sub:${encodeURIComponent(cleanUrl)}` },
    ]);

    await telegramBot.sendMessage(
      chatId,
      `اشترك في القنوات التالية أولًا:\n\nلإكمال عملية التحميل، يجب عليك الاشتراك في قنوات المنصة أولاً:`,
      {
        reply_markup: {
          inline_keyboard: channelButtons,
        },
      }
    );
    return;
  }

  // Phase 1: Analyzing
  let sentMsg: any = null;
  try {
    sentMsg = await telegramBot.sendMessage(
      chatId,
      `🔎 <b>جاري تحليل الرابط...</b>\n━━━━━━━━░░░░ 60%`
    );
  } catch (err) {
    console.error('[Handler] Failed to send analyzing message:', err);
  }

  const messageId = sentMsg?.result?.message_id;

  try {
    // 2. Extract Metadata
    const metadata = await mediaExtractor.getMetadata(cleanUrl);

    // 3. Absolute 1GB Size Limit Check
    if (metadata.isOverSizeLimit) {
      const limitText = `⚠️ <b>الملف كبير جدًا</b>\n\nلا يمكن معالجة الملفات التي يبلغ حجمها 1GB أو أكثر.`;
      if (messageId) {
        await telegramBot.editMessageText(chatId, messageId, limitText);
      } else {
        await telegramBot.sendMessage(chatId, limitText);
      }

      await db.createDownload({
        user_id: userId,
        url: cleanUrl,
        platform: metadata.platform,
        media_type: 'video',
        title: metadata.title,
        file_size: metadata.estimatedVideoSizeBytes || 0,
        status: 'rejected_size',
        error_message: 'File size exceeded 1GB limit',
        completed_at: new Date().toISOString(),
      });
      return;
    }

    // Phase 2: Found Video Info
    const infoText =
      `🎬 <b>تم العثور على الفيديو</b>\n\n` +
      `📌 <b>العنوان:</b> ${metadata.title}\n` +
      `🌐 <b>المنصة:</b> ${metadata.platformNameArabic}\n` +
      `⏱️ <b>المدة:</b> ${metadata.durationFormatted}\n` +
      `🎬 <b>الجودة المتاحة:</b> ${metadata.bestQuality}\n` +
      `📦 <b>الحجم المتوقع:</b> ${metadata.estimatedSizeFormatted}\n\n` +
      `اختر الإجراء المناسب أدناه:`;

    // Construct buttons according to strict prompt specs
    const keyboard: any[][] = [];

    // Use short key to strictly adhere to Telegram's 64-byte callback_data limit
    const shortKey = storePendingUrl(cleanUrl);

    // YouTube gets both [تحميل الفيديو] and [استخراج الصوت]
    if (metadata.supportsAudioExtraction) {
      keyboard.push([
        { text: '🎬 تحميل الفيديو', callback_data: `dl:v:${shortKey}` },
        { text: '🎵 استخراج الصوت', callback_data: `dl:a:${shortKey}` },
      ]);
    } else {
      // Other platforms get video only in basic version
      keyboard.push([
        { text: '🎬 تحميل الفيديو', callback_data: `dl:v:${shortKey}` },
      ]);
    }

    // Share button on all
    keyboard.push([
      {
        text: '↗️ مشاركة البوت',
        url: `https://t.me/share/url?url=https://t.me/Nazelbot&text=${encodeURIComponent('جرب بوت نَزِّل لتحميل الفيديوهات بجودة عالية!')}`,
      },
    ]);

    if (messageId) {
      await telegramBot.editMessageText(chatId, messageId, infoText, {
        reply_markup: { inline_keyboard: keyboard },
      }).catch(async (editErr) => {
        console.warn('[Handler] editMessageText failed, sending as new message:', editErr?.message);
        await telegramBot.sendMessage(chatId, infoText, {
          reply_markup: { inline_keyboard: keyboard },
        }).catch(() => {});
      });
    } else {
      await telegramBot.sendMessage(chatId, infoText, {
        reply_markup: { inline_keyboard: keyboard },
      });
    }
  } catch (err: any) {
    console.error('[Handler] Metadata extraction error:', err);
    const errorText = `⚠️ <b>تعذر الوصول إلى هذا المحتوى</b>\nقد يكون خاصًا أو محذوفًا أو غير متاح حاليًا.`;
    if (messageId) {
      await telegramBot.editMessageText(chatId, messageId, errorText).catch(() => {});
    } else {
      await telegramBot.sendMessage(chatId, errorText).catch(() => {});
    }
  }
}

async function handleCallbackQuery(cb: any) {
  const data = cb.data || '';
  const chatId = cb.message?.chat?.id;
  const messageId = cb.message?.message_id;
  const userId = cb.from?.id;

  if (!chatId || !userId) return;

  // Acknowledge callback immediately to remove loading spinner in Telegram client
  await telegramBot.answerCallbackQuery(cb.id);

  if (data === 'cmd:help') {
    await handleHelpCommand(chatId);
    return;
  }

  // Handle Admin Dashboard Callbacks
  if (data.startsWith('admin:')) {
    await handleAdminCallback(chatId, messageId, userId, data);
    return;
  }

  // Verification button after subscription
  if (data.startsWith('verify_sub:')) {
    const rawRef = data.replace('verify_sub:', '');
    const rawUrl = resolvePendingUrl(decodeURIComponent(rawRef));
    const subCheck = await checkUserSubscription(userId);
    if (subCheck.subscribed) {
      await telegramBot.sendMessage(chatId, '🎉 <b>شكرًا لاشتراكك!</b> جاري الآن معالجة الرابط...');
      if (rawUrl) {
        await handleMediaUrl(chatId, userId, rawUrl);
      }
    } else {
      await telegramBot.sendMessage(
        chatId,
        '❌ <b>لم يتم التحقق من اشتراكك في جميع القنوات بعد.</b>\nيرجى الانضمام والضغط على تحقق مرة أخرى.'
      );
    }
    return;
  }

  // Handle Download action: dl:v:shortKey or dl:a:shortKey or legacy dl:video:url
  if (data.startsWith('dl:')) {
    const parts = data.split(':');
    const typeIndicator = parts[1];
    const mediaType: 'video' | 'audio' =
      typeIndicator === 'a' || typeIndicator === 'audio' ? 'audio' : 'video';
    const rawRef = parts.slice(2).join(':');
    const targetUrl = resolvePendingUrl(decodeURIComponent(rawRef));

    if (!targetUrl) {
      await telegramBot.sendMessage(chatId, '⚠️ انتهت صلاحية الرابط، يرجى إعادة إرساله مرة أخرى.');
      return;
    }

    // Check if user is banned
    const user = await db.getUser(userId);
    if (user?.is_banned) {
      await telegramBot.sendMessage(chatId, '⛔ حسابك محظور.');
      return;
    }

    const detected = mediaExtractor.getPlatform(targetUrl);

    // Update message to queued status
    await telegramBot.editMessageText(
      chatId,
      messageId,
      `⏳ <b>تمت إضافة طلبك إلى طابور المعالجة...</b>\n━━━━━━━━░░░░ 20%`
    ).catch(() => {});

    // Add to job queue
    await jobQueue.addJob({
      userId,
      chatId,
      messageId,
      url: targetUrl,
      platform: detected.id,
      mediaType,
    });
  }
}
