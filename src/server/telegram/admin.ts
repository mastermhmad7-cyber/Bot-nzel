import { db } from '../database/database.js';
import { telegramBot } from './client.js';
import { jobQueue } from '../queue/queue.js';
import { mediaProcessor } from '../media/processor.js';

export async function isUserAdmin(userId: number): Promise<boolean> {
  const envAdmin = process.env.ADMIN_TELEGRAM_ID;
  if (envAdmin && envAdmin.trim() === userId.toString().trim()) {
    return true;
  }
  const settings = await db.getSettings();
  if (settings.admin_telegram_id && settings.admin_telegram_id.toString().trim() === userId.toString().trim()) {
    return true;
  }
  const user = await db.getUser(userId);
  return !!user?.is_admin;
}

export async function handleAdminCommand(chatId: number, userId: number, messageId?: number) {
  const isAdmin = await isUserAdmin(userId);

  if (!isAdmin) {
    const errorMsg = '⛔ <b>عذرًا، هذه الواجهة مخصصة لمشرفي النظام فقط.</b>\nيمكنك استخدام الأوامر العامة مثل /start أو إرسال الروابط مباشرة.';
    if (messageId) {
      await telegramBot.editMessageText(chatId, messageId, errorMsg);
    } else {
      await telegramBot.sendMessage(chatId, errorMsg);
    }
    return;
  }

  // Fetch real-time system stats
  const userCounts = await db.countUsers();
  const dlStats = await db.getDownloadStats();
  const qStatus = jobQueue.getQueueStatus();
  const totalGB = (dlStats.totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  const ffmpegOk = mediaProcessor.isFfmpegAvailable();

  const text =
    `👑 <b>لوحة تحكم مشرف المنصة («نَزِّل»)</b>\n\n` +
    `📊 <b>إحصائيات النظام الحية:</b>\n` +
    `• إجمالي المستخدمين: <b>${userCounts.total}</b> (نشط اليوم: ${userCounts.activeToday})\n` +
    `• إجمالي التحميلات: <b>${dlStats.total}</b> (ناجح: <b>${dlStats.completed}</b> / فاشل: <b>${dlStats.failed}</b>)\n` +
    `• استهلاك البيانات: <b>${totalGB} GB</b>\n` +
    `• طابور المهام: <b>${qStatus.activeCount} نشطة</b> / <b>${qStatus.queuedCount} بالانتظار</b>\n\n` +
    `⚙️ <b>جاهزية السيرفر:</b>\n` +
    `• محرك FFmpeg: ${ffmpegOk ? '<b>مفعل وجاهز</b> ✅' : '<b>غير متاح</b> ⚠️'}\n` +
    `• وضع الاستقبال: <b>Long Polling فوري</b> ⚡\n` +
    `• الحد الأقصى للملف: <b>1GB (1024 MB)</b> 📦\n\n` +
    `اختر الإجراء المطلوب أدناه:`;

  const keyboard = [
    [
      { text: '👥 إدارة المستخدمين', callback_data: 'admin:users' },
      { text: '⚡ طابور المهام', callback_data: 'admin:queue' },
    ],
    [
      { text: '📢 الاشتراك الإجباري', callback_data: 'admin:channels' },
      { text: '🎯 نظام الإعلانات', callback_data: 'admin:ads' },
    ],
    [
      { text: '🔄 تحديث الإحصائيات', callback_data: 'admin:refresh' },
    ],
  ];

  if (messageId) {
    await telegramBot.editMessageText(chatId, messageId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  } else {
    await telegramBot.sendMessage(chatId, text, {
      reply_markup: { inline_keyboard: keyboard },
    });
  }
}

export async function handleAdminCallback(
  chatId: number,
  messageId: number,
  userId: number,
  data: string
) {
  const isAdmin = await isUserAdmin(userId);
  if (!isAdmin) {
    await telegramBot.sendMessage(chatId, '⛔ غير مصرح.');
    return;
  }

  // 1. Back to Main Admin
  if (data === 'admin:back' || data === 'admin:refresh') {
    await handleAdminCommand(chatId, userId, messageId);
    return;
  }

  // 2. Users View in Telegram
  if (data === 'admin:users') {
    const usersResult = await db.listUsers('', 8, 0);
    const users = usersResult.users || [];

    let usersText = `👥 <b>قائمة آخر المستخدمين المسجلين:</b>\n\n`;
    if (users.length === 0) {
      usersText += `لا يوجد مستخدمون مسجلون بعد.`;
    } else {
      users.forEach((u, i) => {
        const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'بدون اسم';
        const handle = u.username ? `@${u.username}` : `ID: ${u.telegram_id}`;
        const status = u.is_banned ? '🚫 محظور' : '✅ نشط';
        usersText += `${i + 1}. <b>${name}</b> (${handle})\n   تحميلات: ${u.downloads_count || 0} | ${status}\n\n`;
      });
    }

    const keyboard = [
      [{ text: '🔙 العودة للوحة الإدارة', callback_data: 'admin:back' }],
    ];

    await telegramBot.editMessageText(chatId, messageId, usersText, {
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  // 3. Queue Status in Telegram
  if (data === 'admin:queue') {
    const qStatus = jobQueue.getQueueStatus();
    const jobs = await db.listJobs(6);

    let queueText =
      `⚡ <b>حالة طابور التحميل اللحظي:</b>\n\n` +
      `• المهام النشطة: <b>${qStatus.activeCount} / ${qStatus.maxConcurrency}</b>\n` +
      `• مهام الانتظار: <b>${qStatus.queuedCount}</b>\n\n` +
      `<b>آخر المهام المسجلة:</b>\n`;

    if (jobs.length === 0) {
      queueText += `لا توجد مهام حالياً.`;
    } else {
      jobs.forEach((j, i) => {
        const statusEmoji: Record<string, string> = {
          completed: '✅',
          downloading: '⬇️',
          processing: '⚙️',
          queued: '⏳',
          failed: '❌',
        };
        const emoji = statusEmoji[j.status] || '📦';
        queueText += `${i + 1}. ${emoji} <b>${j.platform}</b> (${j.media_type})\n   حالة: ${j.status} | مستخدم: ${j.user_id}\n`;
      });
    }

    const keyboard = [
      [{ text: '🔄 تحديث الطابور', callback_data: 'admin:queue' }],
      [{ text: '🔙 العودة للوحة الإدارة', callback_data: 'admin:back' }],
    ];

    await telegramBot.editMessageText(chatId, messageId, queueText, {
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  // 4. Required Channels in Telegram
  if (data === 'admin:channels') {
    const channels = await db.listRequiredChannels(false);

    let chText = `📢 <b>قنوات الاشتراك الإجباري:</b>\n\n`;
    if (channels.length === 0) {
      chText += `لا توجد قنوات اشتراك إجباري مضافة.\nيمكنك إضافة قنوات عبر لوحة التحكم بالويب.`;
    } else {
      channels.forEach((ch, i) => {
        const state = ch.is_active ? '✅ مفعلة' : '⏸️ معطلة';
        chText += `${i + 1}. <b>${ch.channel_name}</b>\n   المعرف: ${ch.channel_username} | ${state}\n\n`;
      });
    }

    const keyboard = [
      [{ text: '🔙 العودة للوحة الإدارة', callback_data: 'admin:back' }],
    ];

    await telegramBot.editMessageText(chatId, messageId, chText, {
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }

  // 5. Ads System in Telegram
  if (data === 'admin:ads') {
    const ads = await db.listAds(false);
    const settings = await db.getSettings();

    let adsText =
      `🎯 <b>نظام الإعلانات والحملات:</b>\n\n` +
      `• معدل الظهور الحالي: <b>${settings.ad_frequency || 'كل 3 تحميلات'}</b>\n` +
      `• عدد الإعلانات: <b>${ads.length}</b>\n\n`;

    if (ads.length === 0) {
      adsText += `لا توجد إعلانات منشأة بعد.`;
    } else {
      ads.forEach((ad, i) => {
        const state = ad.is_active ? '🟢 نشط' : '⚪ متوقف';
        adsText += `${i + 1}. <b>${ad.title}</b> (${state})\n   مرات الظهور: ${ad.impressions || 0}\n`;
      });
    }

    const keyboard = [
      [{ text: '🔙 العودة للوحة الإدارة', callback_data: 'admin:back' }],
    ];

    await telegramBot.editMessageText(chatId, messageId, adsText, {
      reply_markup: { inline_keyboard: keyboard },
    });
    return;
  }
}
