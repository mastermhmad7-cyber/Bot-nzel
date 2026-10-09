import React from 'react';
import {
  Users,
  Download,
  CheckCircle2,
  XCircle,
  HardDrive,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
} from 'lucide-react';

interface OverviewProps {
  stats: any;
  onNavigateToSimulator: () => void;
}

export const DashboardOverview: React.FC<OverviewProps> = ({ stats, onNavigateToSimulator }) => {
  const users = stats?.users || { total: 0, activeToday: 0, banned: 0 };
  const dl = stats?.downloads || {
    total: 0,
    completed: 0,
    failed: 0,
    totalBytes: 0,
    platformBreakdown: {},
    mediaTypeBreakdown: {},
    dailyDownloads: [],
  };

  const totalGB = (dl.totalBytes / (1024 * 1024 * 1024)).toFixed(2);
  const successRate = dl.total > 0 ? Math.round((dl.completed / dl.total) * 100) : 100;

  // Platform names in Arabic
  const platformLabels: Record<string, string> = {
    youtube: 'يوتيوب',
    youtube_shorts: 'شورتس',
    tiktok: 'تيك توك',
    instagram: 'إنستغرام',
    twitter: 'إكس (تويتر)',
    facebook: 'فيسبوك',
    reddit: 'ريديت',
    pinterest: 'بينتيريست',
    generic: 'مواقع عامة',
  };

  const platformColors: Record<string, string> = {
    youtube: 'from-red-500 to-rose-600',
    youtube_shorts: 'from-rose-500 to-pink-600',
    tiktok: 'from-cyan-400 to-slate-900',
    instagram: 'from-pink-500 to-purple-600',
    twitter: 'from-sky-400 to-blue-600',
    facebook: 'from-blue-600 to-indigo-700',
    reddit: 'from-orange-500 to-amber-600',
    pinterest: 'from-red-600 to-rose-700',
    generic: 'from-slate-600 to-slate-700',
  };

  const platforms = Object.entries(dl.platformBreakdown || {}).sort((a: any, b: any) => b[1] - a[1]);

  return (
    <div className="space-y-6">
      {/* Hero Welcome Banner */}
      <div className="rounded-2xl bg-gradient-to-l from-indigo-900/60 via-slate-900 to-slate-900 border border-indigo-500/20 p-6 relative overflow-hidden">
        <div className="absolute -left-12 -top-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>نظام التنزيل الذكي نشط وجاهز</span>
            </div>
            <h2 className="text-2xl font-extrabold text-white">لوحة المراقبة والإحصائيات الحية</h2>
            <p className="text-slate-300 text-sm mt-1 max-w-xl">
              إحصائيات شاملة للأداء، المستخدمين، استهلاك البيانات، وحركة طابور التحميلات اللحظية.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/export-zip"
              download="nazzil-bot-source.zip"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل كود المشروع (ZIP)</span>
            </a>
            <button
              onClick={onNavigateToSimulator}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition cursor-pointer"
            >
              <span>اختبار البوت والروابط الآن</span>
              <span>←</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي المستخدمين</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">{users.total}</div>
          <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
            <span>+{users.activeToday} نشط اليوم</span>
          </div>
        </div>

        {/* Total Downloads */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>إجمالي التحميلات</span>
            <Download className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">{dl.total}</div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <span>مكتمل بنجاح: {dl.completed}</span>
          </div>
        </div>

        {/* Success Rate */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>نسبة النجاح</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">{successRate}%</div>
          <div className="mt-1 text-[11px] text-rose-400">
            <span>{dl.failed} عمليات فاشلة</span>
          </div>
        </div>

        {/* Data Processed */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>البيانات المعالجة</span>
            <HardDrive className="w-4 h-4 text-purple-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">
            {totalGB} <span className="text-xs font-normal text-slate-400">جيجابايت</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            <span>الحد الأقصى للملف: 1GB</span>
          </div>
        </div>
      </div>

      {/* Analytics Charts & Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Downloads Activity Chart */}
        <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-indigo-400" />
                <h3 className="font-bold text-white text-base">نشاط التحميلات اليومية (آخر 7 أيام)</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">تحديث لحظي</span>
            </div>

            {/* Daily Bars */}
            <div className="h-48 flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {(dl.dailyDownloads || []).map((day: any, idx: number) => {
                const maxCount = Math.max(1, ...dl.dailyDownloads.map((d: any) => d.count));
                const heightPercent = Math.max(8, Math.round((day.count / maxCount) * 100));
                const dayLabel = day.date ? day.date.slice(5) : `يوم ${idx + 1}`;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[11px] text-slate-400 font-mono opacity-0 group-hover:opacity-100 transition">
                      {day.count}
                    </div>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[36px] rounded-t-lg bg-gradient-to-t from-indigo-600 to-cyan-400 group-hover:from-indigo-500 group-hover:to-cyan-300 transition-all shadow-md shadow-indigo-500/20"
                    />
                    <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{dayLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 pt-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
              <span>فيديوهات MP4</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-cyan-400 inline-block" />
              <span>صوتيات MP3</span>
            </div>
            <div className="font-mono text-slate-300">
              إجمالي الأسبوع: {dl.dailyDownloads?.reduce((acc: number, curr: any) => acc + curr.count, 0) || 0}
            </div>
          </div>
        </div>

        {/* Platform Breakdown */}
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-white text-base">أكثر المنصات استخداماً</h3>
            </div>
            <span className="text-xs text-slate-400">{platforms.length} منصات</span>
          </div>

          {platforms.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-xs py-8">
              <span>لا توجد بيانات تحميلات مسجلة بعد</span>
            </div>
          ) : (
            <div className="space-y-3 flex-1 overflow-y-auto max-h-64 pr-1">
              {platforms.map(([platform, count]: any) => {
                const total = dl.total || 1;
                const percent = Math.round((count / total) * 100);
                const label = platformLabels[platform] || platform;
                const gradient = platformColors[platform] || 'from-indigo-600 to-cyan-500';

                return (
                  <div key={platform} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">{label}</span>
                      <span className="font-mono text-slate-400">
                        {count} ({percent}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full bg-gradient-to-r ${gradient}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Media Type Breakdown */}
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="text-slate-400">فيديو MP4</div>
              <div className="font-bold text-white text-sm font-mono mt-0.5">
                {dl.mediaTypeBreakdown?.video || 0}
              </div>
            </div>
            <div className="p-2 rounded-xl bg-slate-800/60 border border-slate-700/50">
              <div className="text-slate-400">صوت MP3</div>
              <div className="font-bold text-cyan-400 text-sm font-mono mt-0.5">
                {dl.mediaTypeBreakdown?.audio || 0}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
