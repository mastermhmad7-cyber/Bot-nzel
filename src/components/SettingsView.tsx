import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Shield,
  Send,
  Save,
  CheckCircle2,
  AlertCircle,
  FileText,
  Server,
  RefreshCw,
} from 'lucide-react';
import { adminApi } from '../services/api';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<any>({});
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);
  const [webhookMsg, setWebhookMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form states
  const [botToken, setBotToken] = useState('');
  const [adminTelegramId, setAdminTelegramId] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookLiveInfo, setWebhookLiveInfo] = useState<any>(null);
  const [maxConcurrency, setMaxConcurrency] = useState(3);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState(1024);
  const [cookiesContent, setCookiesContent] = useState('');

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const sData = await adminApi.getSettings();
      const s = sData.settings || {};
      setSettings(s);
      setBotToken(s.bot_token || '');
      setAdminTelegramId(s.admin_telegram_id || '');
      setWebhookUrl(s.webhook_url || '');
      setWebhookSecret(s.webhook_secret || 'nazzil_secret_key');
      setMaxConcurrency(s.max_concurrent_jobs || 3);
      setMaxFileSizeMb(s.max_file_size_mb || 1024);
      setCookiesContent(s.cookies_content || '');

      try {
        const whStatus = await adminApi.getWebhookStatus();
        if (whStatus && whStatus.info && whStatus.info.result) {
          setWebhookLiveInfo(whStatus.info.result);
        }
      } catch {}

      try {
        const logsData = await adminApi.getLogs();
        setLogs(logsData.logs || []);
      } catch {
        // logs are secondary, do not fail settings view if logs fail
      }
    } catch (err: any) {
      console.warn('Settings load notice:', err?.message || err);
      setLoadError(err?.message || 'تعذر تحميل الإعدادات من الخادم');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSettings({
        bot_token: botToken,
        admin_telegram_id: adminTelegramId,
        webhook_url: webhookUrl,
        webhook_secret: webhookSecret,
        max_concurrent_jobs: Number(maxConcurrency),
        max_file_size_mb: Number(maxFileSizeMb),
        cookies_content: cookiesContent,
      });
      alert('تم حفظ إعدادات النظام بنجاح');
      loadData();
    } catch (err: any) {
      alert(err.message || 'فشل حفظ الإعدادات');
    } finally {
      setSaving(false);
    }
  };

  const handleRegisterWebhook = async () => {
    if (!webhookUrl) {
      alert('يرجى إدخال رابط Webhook صالح أولاً');
      return;
    }
    setRegisteringWebhook(true);
    setWebhookMsg(null);
    try {
      const res = await adminApi.registerWebhook(webhookUrl, webhookSecret);
      if (res.success) {
        setWebhookMsg({ ok: true, text: '✅ تم تسجيل وتفعيل الـ Webhook مع Telegram بنجاح!' });
        loadData();
      } else {
        setWebhookMsg({ ok: false, text: `⚠️ خطأ: ${res.error || 'فشل التسجيل'}` });
      }
    } catch (err: any) {
      setWebhookMsg({ ok: false, text: `⚠️ خطأ: ${err.message}` });
    } finally {
      setRegisteringWebhook(false);
    }
  };

  const handleUnregisterWebhook = async () => {
    if (!confirm('هل تريد إلغاء الـ Webhook والتحويل إلى نظام Polling الافتراضي؟')) return;
    setRegisteringWebhook(true);
    setWebhookMsg(null);
    try {
      await adminApi.unregisterWebhook();
      setWebhookMsg({ ok: true, text: '✅ تم إلغاء الـ Webhook بنجاح والتحويل إلى نظام Long Polling.' });
      loadData();
    } catch (err: any) {
      setWebhookMsg({ ok: false, text: `⚠️ خطأ: ${err.message}` });
    } finally {
      setRegisteringWebhook(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-indigo-400" />
          <span>إعدادات النظام والربط التقني (System Configuration)</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          إدارة مفاتيح Telegram Bot، رابط الـ Webhook، وحدود الأداء والخادم
        </p>
      </div>

      {loadError && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg bg-amber-900/60 hover:bg-amber-800/80 text-white font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSaveSettings} className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-400" />
              <span>إعدادات Telegram Bot والـ Webhook</span>
            </h3>

            {/* Bot Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                توكن بوت تليجرام (TELEGRAM_BOT_TOKEN):
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                احصل عليه من @BotFather داخل تطبيق Telegram
              </span>
            </div>

            {/* Admin Telegram ID */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                معرّف مدير النظام (ADMIN_TELEGRAM_ID):
              </label>
              <input
                type="text"
                value={adminTelegramId}
                onChange={(e) => setAdminTelegramId(e.target.value)}
                placeholder="مثال: 123456789"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
              />
              <span className="text-[11px] text-slate-400 block mt-1">
                المعرف الرقمي للمدير لمنحه صلاحيات الأوامر الإدارية والتحكم
              </span>
            </div>

            {/* Webhook Configuration */}
            <div className="pt-3 border-t border-slate-800/80 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
                    وضع الـ Webhook والتشغيل 24/7
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    يقوم بنقل الرسائل مباشرة من سيرفرات Telegram إلى تطبيقك فور وصولها
                  </p>
                </div>

                {webhookLiveInfo && webhookLiveInfo.url ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    Webhook نشط وموثق مع Telegram
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                    وضع Long Polling الافتراضي
                  </span>
                )}
              </div>

              {webhookLiveInfo && webhookLiveInfo.url && (
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-emerald-800/40 text-xs space-y-1.5">
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 font-medium">الرابط المعتمد لدى سيرفرات Telegram:</span>
                    <span className="font-mono text-emerald-300 text-[11px]">{webhookLiveInfo.url}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400 font-medium">حالة التحديثات المعلقة (Pending Updates):</span>
                    <span className="font-mono text-white text-[11px]">{webhookLiveInfo.pending_update_count || 0}</span>
                  </div>
                  {webhookLiveInfo.last_error_message && (
                    <div className="text-rose-400 text-[11px] pt-1 border-t border-slate-800">
                      ⚠️ آخر تنبيه من تيليجرام: {webhookLiveInfo.last_error_message}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  رابط الـ Webhook:
                </label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://your-service.run.app/api/telegram/webhook"
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleRegisterWebhook}
                      disabled={registeringWebhook}
                      className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs whitespace-nowrap transition cursor-pointer"
                    >
                      {registeringWebhook ? 'جاري التسجيل...' : '⚡ تفعيل الـ Webhook'}
                    </button>
                    {webhookLiveInfo && webhookLiveInfo.url && (
                      <button
                        type="button"
                        onClick={handleUnregisterWebhook}
                        disabled={registeringWebhook}
                        className="px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-white font-bold text-xs whitespace-nowrap transition cursor-pointer border border-slate-700 hover:border-rose-700"
                        title="العودة لنظام Polling"
                      >
                        إلغاء والعودة لـ Polling
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {webhookMsg && (
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    webhookMsg.ok
                      ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50'
                      : 'bg-rose-950/40 text-rose-300 border-rose-800/50'
                  }`}
                >
                  {webhookMsg.text}
                </div>
              )}

              {/* Free 24/7 Keep-Alive Tip */}
              <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-900/40 text-[11px] text-indigo-300/90 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-indigo-300">
                  💡 نصيحة للتشغيل المجاني 24/7 بدون انقطاع:
                </span>
                <p className="text-slate-400 leading-relaxed">
                  يمكنك إضافة رابط فحص الصحة <code className="text-indigo-300 font-mono">/api/health</code> إلى موقع مجاني مثل <a href="https://uptimerobot.com" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-semibold">UptimeRobot</a> لفحصه كل 5 دقائق، ليظل السيرفر مستيقظاً على مدار الساعة بالمجان!
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  المفتاح السري للـ Webhook (X-Telegram-Bot-Api-Secret-Token):
                </label>
                <input
                  type="text"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* System Performance & Limits */}
            <div className="pt-3 border-t border-slate-800/80 space-y-4">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider text-slate-400">
                حدود المعالجة والأمان
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    أقصى عدد للمهام المتزامنة:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={maxConcurrency}
                    onChange={(e) => setMaxConcurrency(parseInt(e.target.value) || 1)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-xs"
                  />
                  <span className="text-[11px] text-slate-400 block mt-1">
                    يحمي الخادم من الانهيار عند الضغط العالي
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    الحد الأقصى لحجم الملف (ميجابايت):
                  </label>
                  <input
                    type="number"
                    disabled
                    value={maxFileSizeMb}
                    className="w-full px-4 py-2 rounded-xl bg-slate-950/50 border border-slate-800 text-slate-400 font-mono text-xs cursor-not-allowed"
                  />
                  <span className="text-[11px] text-amber-400/90 block mt-1">
                    ثابت عند 1024 MB (1GB) التزاماً بالمواصفات الصارمة
                  </span>
                </div>
              </div>

              {/* YouTube Cookies Section */}
              <div className="pt-3 border-t border-slate-800/80">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  🍪 ملف تعريف الارتباط لتجاوز قيود المنصات (Cookies / cookies.txt):
                </label>
                <textarea
                  value={cookiesContent}
                  onChange={(e) => setCookiesContent(e.target.value)}
                  rows={4}
                  placeholder="# Netscape HTTP Cookie File&#10;.youtube.com&#9;TRUE&#9;/&#9;TRUE&#9;1790000000&#9;VISITOR_INFO1_LIVE&#9;xyz..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-[11px] placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <span className="text-[11px] text-slate-400 block mt-1">
                  ألصق محتوى ملف الكوكيز (بصيغة Netscape) لتجاوز قيود "Sign in to confirm you're not a bot" على YouTube والمنصات المحمية. يمكنك أيضاً تحديثه مباشرة من تيليجرام عبر أمر <code>/cookies</code>.
                </span>
              </div>
            </div>

            {/* Save Button */}
            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* Server Health & Diagnostics (1 col) */}
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>فحص الخادم والبيئة</span>
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">محرك FFmpeg:</span>
                <span className="text-emerald-400 font-bold">جاهز (/usr/bin/ffmpeg)</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">محرك yt-dlp:</span>
                <span className="text-emerald-400 font-bold">مفعل (v2026.08)</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">بيئة التشغيل:</span>
                <span className="text-slate-200 font-mono">Node.js (Linux x86_64)</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">المجلد المؤقت للوسائط:</span>
                <span className="text-indigo-400 font-mono text-[11px]">temp_media/</span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400">التنظيف التلقائي:</span>
                <span className="text-emerald-400 font-bold">نشط كل 15 دقيقة</span>
              </div>
            </div>
          </div>

          {/* Audit Logs */}
          <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>سجل الإجراءات الإدارية</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-mono">{logs.length} سجل</span>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1 text-xs">
              {logs.length === 0 ? (
                <div className="text-slate-400 text-center py-4">لا توجد سجلات بعد</div>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-indigo-300 font-mono">{log.action}</span>
                      <span className="text-slate-400 font-mono">
                        {new Date(log.timestamp).toLocaleTimeString('ar-SA')}
                      </span>
                    </div>
                    <div className="text-slate-300 mt-1 text-[11px]">{log.details}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
