import React, { useState, useEffect } from 'react';
import { Layers, RefreshCw, XCircle, Clock, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { adminApi } from '../services/api';

export const QueueView: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [queueStatus, setQueueStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadQueue = async () => {
    try {
      const data = await adminApi.getJobs();
      setJobs(data.jobs || []);
      setQueueStatus(data.status || null);
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
  };

  useEffect(() => {
    loadQueue();
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadQueue();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleCancelJob = async (jobId: string) => {
    try {
      await adminApi.cancelJob(jobId);
      loadQueue();
    } catch {
      alert('فشل إلغاء المهمة');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'queued':
        return (
          <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[11px] font-bold flex items-center gap-1">
            <Clock className="w-3 h-3" />
            في الانتظار
          </span>
        );
      case 'analyzing':
        return (
          <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[11px] font-bold flex items-center gap-1 animate-pulse">
            <Zap className="w-3 h-3" />
            جاري التحليل
          </span>
        );
      case 'downloading':
        return (
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 text-[11px] font-bold flex items-center gap-1 animate-pulse">
            <Zap className="w-3 h-3" />
            جاري التنزيل
          </span>
        );
      case 'processing':
        return (
          <span className="px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-bold flex items-center gap-1">
            <Zap className="w-3 h-3" />
            معالجة FFmpeg
          </span>
        );
      case 'uploading':
        return (
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[11px] font-bold flex items-center gap-1">
            <Zap className="w-3 h-3" />
            إرسال إلى Telegram
          </span>
        );
      case 'completed':
        return (
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            مكتمل
          </span>
        );
      case 'failed':
        return (
          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 text-[11px] font-bold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            فشل
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2.5 py-1 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[11px] font-bold">
            ملغاة
          </span>
        );
      default:
        return <span className="text-slate-400 text-[11px]">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>طابور المهام الحي (Live Job Queue)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            مراقبة حالة معالجة الروابط وعمليات التنزيل المتزامنة في الخادم
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <span>تحديث تلقائي (2s)</span>
          </label>

          <button
            onClick={loadQueue}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="تحديث فوري"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Queue KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400">المهام النشطة قيد المعالجة</div>
          <div className="text-2xl font-black text-indigo-400 font-mono mt-1">
            {queueStatus?.activeCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            الحد الأقصى للتزامن: {queueStatus?.maxConcurrency || 3} مهام
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400">المهام في قائمة الانتظار</div>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {queueStatus?.queuedCount || 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">تنتظر توفر مسار حر</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
          <div className="text-xs text-slate-400">سجل المهام الأخير</div>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {jobs.length}
          </div>
          <div className="text-[11px] text-emerald-400 mt-0.5">
            محفوظة في قاعدة البيانات
          </div>
        </div>
      </div>

      {/* Queue Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">المهمة ID</th>
                <th className="py-3 px-4 font-semibold">المستخدم</th>
                <th className="py-3 px-4 font-semibold">المنصة والنوع</th>
                <th className="py-3 px-4 font-semibold">الحالة والتقدم</th>
                <th className="py-3 px-4 font-semibold">السرعة والحجم</th>
                <th className="py-3 px-4 font-semibold">وقت البدء</th>
                <th className="py-3 px-4 font-semibold text-center">إلغاء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد مهام في الطابور حالياً
                  </td>
                </tr>
              ) : (
                jobs.map((j) => {
                  const isRunning =
                    j.status === 'queued' ||
                    j.status === 'analyzing' ||
                    j.status === 'downloading' ||
                    j.status === 'processing' ||
                    j.status === 'uploading';

                  return (
                    <tr key={j.job_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-mono text-[11px] text-indigo-300 font-semibold">
                        {j.job_id.substring(0, 16)}...
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">
                        {j.user_id}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white capitalize">{j.platform}</div>
                        <div className="text-[11px] text-slate-400">
                          {j.media_type === 'audio' ? '🎵 صوت MP3' : '🎬 فيديو MP4'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div className="flex items-center gap-2 mb-1.5">
                          {getStatusBadge(j.status)}
                          {isRunning && (
                            <span className="font-mono text-[11px] text-slate-300 font-bold">
                              {j.progress || 0}%
                            </span>
                          )}
                        </div>
                        {isRunning && (
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              style={{ width: `${j.progress || 0}%` }}
                              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                            />
                          </div>
                        )}
                        {j.error && (
                          <div className="text-[10px] text-rose-400 mt-1 truncate max-w-[200px]" title={j.error}>
                            {j.error}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {j.speed_formatted ? (
                          <div>⚡ {j.speed_formatted}</div>
                        ) : null}
                        {j.total_bytes ? (
                          <div>📦 {(j.total_bytes / (1024 * 1024)).toFixed(1)} MB</div>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {j.created_at ? new Date(j.created_at).toLocaleTimeString('ar-SA') : '—'}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isRunning && (
                          <button
                            onClick={() => handleCancelJob(j.job_id)}
                            className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition"
                            title="إلغاء المهمة فوراً"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
