import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Sparkles,
  RefreshCw,
  Share2,
  Download,
  Music,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { adminApi } from '../services/api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  buttons?: Array<Array<{ text: string; action: string; url?: string }>>;
  metadata?: any;
  timestamp: string;
  isStreaming?: boolean;
}

export const BotSimulatorView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm1',
      sender: 'bot',
      text: 'مرحبًا بك في «نَزِّل» 👋\n\nأرسل رابط الفيديو، وسأحاول تحميله لك بأعلى جودة متاحة.',
      buttons: [
        [
          { text: 'ℹ️ طريقة الاستخدام', action: 'cmd:help' },
          { text: '📢 مشاركة البوت', action: 'share', url: 'https://t.me/NazzilBot' },
        ],
      ],
      timestamp: 'الآن',
    },
  ]);

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inspectedData, setInspectedData] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sampleLinks = [
    { label: 'YouTube ريل/مقطع', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    { label: 'YouTube Shorts', url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' },
    { label: 'TikTok فيديو', url: 'https://www.tiktok.com/@tiktok/video/71234567890' },
    { label: 'Instagram Reels', url: 'https://www.instagram.com/reel/C3xYz1234/' },
    { label: 'X / Twitter', url: 'https://x.com/Twitter/status/1234567890' },
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || isProcessing) return;

    const userMsgId = `usr_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsProcessing(true);

    // Check if command
    if (text.startsWith('/start')) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: 'مرحبًا بك في «نَزِّل» 👋\n\nأرسل رابط الفيديو، وسأحاول تحميله لك بأعلى جودة متاحة.',
            buttons: [
              [
                { text: 'ℹ️ طريقة الاستخدام', action: 'cmd:help' },
                { text: '📢 مشاركة البوت', action: 'share', url: 'https://t.me/NazzilBot' },
              ],
            ],
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsProcessing(false);
      }, 500);
      return;
    }

    if (text.startsWith('/help')) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: `📖 <b>دليل استخدام «نَزِّل»</b>\n\n` +
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
              `⚡ <b>ملاحظة:</b> الحد الأقصى للملفات هو 1GB.`,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsProcessing(false);
      }, 500);
      return;
    }

    if (text.startsWith('/stats')) {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot_${Date.now()}`,
            sender: 'bot',
            text: `📊 <b>إحصائيات نَزِّل</b>\n\n` +
              `👤 <b>تحميلاتك:</b> 12 عملية\n` +
              `📦 <b>إجمالي التحميلات المكتملة في النظام:</b> 1,420\n` +
              `💾 <b>البيانات المعالجة:</b> 84.5 GB\n\n` +
              `المنصة تعمل بكفاءة عالية على Google Cloud!`,
            timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
        setIsProcessing(false);
      }, 500);
      return;
    }

    // Step 1: Send Analyzing Phase message
    const botMsgId = `bot_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: botMsgId,
        sender: 'bot',
        text: `🔎 <b>جاري تحليل الرابط...</b>\n━━━━━━━━░░░░ 60%`,
        timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
        isStreaming: true,
      },
    ]);

    try {
      // Real backend extraction call
      const extractRes = await adminApi.testExtract(text);
      const meta = extractRes.metadata;
      setInspectedData(extractRes);

      if (meta.isOverSizeLimit) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === botMsgId
              ? {
                  ...m,
                  text: `⚠️ <b>الملف كبير جدًا</b>\n\nلا يمكن معالجة الملفات التي يبلغ حجمها 1GB أو أكثر.`,
                  isStreaming: false,
                }
              : m
          )
        );
        setIsProcessing(false);
        return;
      }

      // Format phase 2 message
      const infoText =
        `🎬 <b>تم العثور على الفيديو</b>\n\n` +
        `📌 <b>العنوان:</b> ${meta.title}\n` +
        `🌐 <b>المنصة:</b> ${meta.platformNameArabic}\n` +
        `⏱️ <b>المدة:</b> ${meta.durationFormatted || 'غير محدد'}\n` +
        `🎬 <b>الجودة المتاحة:</b> ${meta.bestQuality || '1080p'}\n` +
        `📦 <b>الحجم المتوقع:</b> ${meta.estimatedSizeFormatted || 'سيتم تحديده أثناء التحميل'}\n\n` +
        `اختر الإجراء المناسب:`;

      const buttons: Array<Array<{ text: string; action: string; url?: string }>> = [];

      if (meta.supportsAudioExtraction) {
        buttons.push([
          { text: '🎬 تحميل الفيديو', action: `dl:video:${meta.url}` },
          { text: '🎵 استخراج الصوت MP3', action: `dl:audio:${meta.url}` },
        ]);
      } else {
        buttons.push([{ text: '🎬 تحميل الفيديو', action: `dl:video:${meta.url}` }]);
      }

      buttons.push([
        {
          text: '↗️ مشاركة البوت',
          action: 'share',
          url: `https://t.me/share/url?url=https://t.me/NazzilBot&text=${encodeURIComponent('حمل فيديوهات وصوتيات بجودة عالية عبر بوت نَزِّل')}`,
        },
      ]);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: infoText,
                buttons,
                metadata: meta,
                isStreaming: false,
              }
            : m
        )
      );
    } catch (err: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                text: `⚠️ <b>تعذر الوصول إلى هذا المحتوى</b>\n${err.message || 'قد يكون الرابط خاصاً أو غير متاح.'}`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleButtonClick = async (btn: { text: string; action: string; url?: string }) => {
    if (btn.url) {
      window.open(btn.url, '_blank');
      return;
    }

    if (btn.action === 'cmd:help') {
      handleSendMessage('/help');
      return;
    }

    if (btn.action.startsWith('dl:')) {
      const parts = btn.action.split(':');
      const mediaType = parts[1] as 'video' | 'audio';
      const targetUrl = parts.slice(2).join(':');

      // Trigger download simulation with animated progress bar!
      const dlMsgId = `dl_${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: dlMsgId,
          sender: 'bot',
          text: `⬇️ <b>جاري تنزيل ${mediaType === 'audio' ? 'الصوت MP3' : 'الفيديو'}</b>\n━━━━━━━━░░░░ 40%\n\n📦 18.4 MB / 42.0 MB\n⚡ 4.8 MB/s`,
          timestamp: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }),
          isStreaming: true,
        },
      ]);

      // Progress animation
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === dlMsgId
              ? {
                  ...m,
                  text: `⬇️ <b>جاري تنزيل ${mediaType === 'audio' ? 'الصوت MP3' : 'الفيديو'}</b>\n━━━━━━━━━━░░ 78%\n\n📦 32.8 MB / 42.0 MB\n⚡ 5.2 MB/s`,
                }
              : m
          )
        );
      }, 900);

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === dlMsgId
              ? {
                  ...m,
                  text: `⚙️ <b>جاري تجهيز الملف عبر FFmpeg...</b>\n━━━━━━━━━━━━ 95%\n\nدمج وتجهيز الحاوية...`,
                }
              : m
          )
        );
      }, 1800);

      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === dlMsgId
              ? {
                  ...m,
                  text: `📤 <b>جاري إرسال الملف إلى Telegram...</b>\n━━━━━━━━━━━━ 100%`,
                }
              : m
          )
        );
      }, 2600);

      setTimeout(() => {
        const finalButtons: Array<Array<{ text: string; action: string; url?: string }>> = [];
        if (mediaType === 'video') {
          finalButtons.push([
            { text: '🎵 استخراج الصوت MP3', action: `dl:audio:${targetUrl}` },
          ]);
        }
        finalButtons.push([
          {
            text: '↗️ مشاركة البوت',
            action: 'share',
            url: 'https://t.me/NazzilBot',
          },
        ]);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === dlMsgId
              ? {
                  ...m,
                  text: `✅ <b>تم التحميل بنجاح.</b>\n\nنتمنى لك مشاهدة ممتعة عبر «نَزِّل»!`,
                  buttons: finalButtons,
                  isStreaming: false,
                }
              : m
          )
        );

        // Also trigger real server job in background if user wants
        adminApi.triggerSimulatorDownload(targetUrl, mediaType).catch(() => {});
      }, 3400);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Telegram Chat Mockup (2 Cols) */}
      <div className="lg:col-span-2 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col h-[700px] overflow-hidden shadow-2xl">
        {/* Chat Header */}
        <div className="bg-slate-800/90 px-5 py-3.5 border-b border-slate-700/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center font-bold text-white shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-white text-sm flex items-center gap-1.5">
                <span>بوت نَزِّل</span>
                <span className="text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.2 rounded border border-cyan-800/50">
                  bot
                </span>
              </div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>متصل بالخادم (Live Engine)</span>
              </div>
            </div>
          </div>

          <button
            onClick={() =>
              setMessages([
                {
                  id: 'm1',
                  sender: 'bot',
                  text: 'مرحبًا بك في «نَزِّل» 👋\n\nأرسل رابط الفيديو، وسأحاول تحميله لك بأعلى جودة متاحة.',
                  buttons: [
                    [
                      { text: 'ℹ️ طريقة الاستخدام', action: 'cmd:help' },
                      { text: '📢 مشاركة البوت', action: 'share', url: 'https://t.me/NazzilBot' },
                    ],
                  ],
                  timestamp: 'الآن',
                },
              ])
            }
            className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 transition"
          >
            مسح المحادثة
          </button>
        </div>

        {/* Quick Sample Links Bar */}
        <div className="px-4 py-2 bg-slate-950/80 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-400 whitespace-nowrap text-[11px]">روابط سريعة:</span>
          {sampleLinks.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(s.url)}
              disabled={isProcessing}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 text-[11px] whitespace-nowrap transition cursor-pointer"
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Chat Messages Body */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs shadow-md ${
                  msg.sender === 'user'
                    ? 'bg-gradient-to-l from-indigo-600 to-indigo-700 text-white rounded-br-xs'
                    : 'bg-slate-800/90 text-slate-100 rounded-bl-xs border border-slate-700/60'
                }`}
              >
                <div
                  className="whitespace-pre-wrap leading-relaxed font-sans"
                  dangerouslySetInnerHTML={{ __html: msg.text }}
                />

                {/* Inline Buttons */}
                {msg.buttons && msg.buttons.length > 0 && (
                  <div className="mt-3 space-y-1.5 pt-2 border-t border-slate-700/60">
                    {msg.buttons.map((row, rIdx) => (
                      <div key={rIdx} className="grid grid-flow-col gap-1.5">
                        {row.map((btn, bIdx) => (
                          <button
                            key={bIdx}
                            onClick={() => handleButtonClick(btn)}
                            className="w-full py-2 px-3 rounded-xl bg-slate-700/80 hover:bg-indigo-600 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm active:scale-98 cursor-pointer"
                          >
                            <span>{btn.text}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                <div className="text-[10px] text-slate-400 mt-2 text-left font-mono">
                  {msg.timestamp}
                </div>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-slate-800/80 border-t border-slate-700/60 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="أرسل رابط فيديو أو أمر /start أو /help..."
            disabled={isProcessing}
            className="flex-1 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={!inputText.trim() || isProcessing}
            className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white transition shadow-md shadow-indigo-600/30 cursor-pointer"
          >
            <Send className={`w-4 h-4 ${isProcessing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Side Inspector: Platform & Metadata live diagnostics */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col space-y-4">
        <div>
          <h3 className="font-bold text-white text-base flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>فاحص الرابط والمنصة (Live Inspector)</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            تحليل تقني لحظي للرابط وحالة طبقة الاستخراج
          </p>
        </div>

        {inspectedData ? (
          <div className="space-y-3 text-xs flex-1">
            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">المنصة المكتشفة:</span>
              <span className="font-bold text-white text-sm">
                {inspectedData.detected?.nameArabic} ({inspectedData.detected?.id})
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">العنوان المستخرج:</span>
              <span className="font-semibold text-slate-200">
                {inspectedData.metadata?.title}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">المدة:</span>
                <span className="font-bold text-indigo-400 font-mono">
                  {inspectedData.metadata?.durationFormatted}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-slate-400 block text-[11px]">أعلى جودة:</span>
                <span className="font-bold text-cyan-400 font-mono">
                  {inspectedData.metadata?.bestQuality}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">الحجم التقديري:</span>
              <span className="font-bold text-emerald-400 font-mono text-sm">
                {inspectedData.metadata?.estimatedSizeFormatted}
              </span>
              <div className="text-[11px] text-slate-400 mt-1">
                التحقق الأمني من حد 1GB:{' '}
                {inspectedData.metadata?.isOverSizeLimit ? (
                  <span className="text-rose-400 font-bold">مرفوض (تجاوز 1GB)</span>
                ) : (
                  <span className="text-emerald-400 font-bold">مسموح (&lt; 1GB)</span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
              <span className="text-slate-400 block text-[11px]">دعم استخراج الصوت MP3:</span>
              <span className="font-bold text-slate-200">
                {inspectedData.metadata?.supportsAudioExtraction ? 'متاح (YouTube)' : 'فيديو فقط'}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/80">
            <Sparkles className="w-8 h-8 text-indigo-500/40 mb-2" />
            <p>أرسل أي رابط في المحادثة لعرض تفاصيل التحليل واستخراج الوسائط المباشرة هنا.</p>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/40 text-[11px] text-slate-300">
          <div className="font-bold text-white mb-1">💡 ميزة حصرية:</div>
          هذا المحاكي يعمل بنفس المحرك والمنطق البرمجي لخادم Telegram الفعلي تماماً، مما يتيح لك تجربة التنزيل فورياً.
        </div>
      </div>
    </div>
  );
};
