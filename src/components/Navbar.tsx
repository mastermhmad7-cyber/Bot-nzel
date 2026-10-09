import React from 'react';
import { Download, RefreshCw, LogOut, ShieldCheck, Cpu, Bot, Layers } from 'lucide-react';
import { removeAdminToken } from '../services/api';

interface NavbarProps {
  systemStats?: any;
  activeJobsCount: number;
  onRefresh: () => void;
  isLoading: boolean;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  systemStats,
  activeJobsCount,
  onRefresh,
  isLoading,
  onLogout,
}) => {
  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 lg:px-6 py-3">
      <div className="flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-black text-xl">
            نَ
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                <span>نَزِّل</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 font-medium border border-indigo-500/30">
                  لوحة الإدارة
                </span>
              </h1>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              منصة Telegram الاحترافية لتنزيل الوسائط المتعددة
            </p>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3">
          {/* FFmpeg Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-slate-400">FFmpeg:</span>
            <span className="font-semibold text-emerald-400">جاهز ومفعل</span>
          </div>

          {/* Bot Status Indicator */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">البوت:</span>
            <span className={`font-semibold ${systemStats?.system?.botConfigured ? 'text-emerald-400' : 'text-amber-400'}`}>
              {systemStats?.system?.botConfigured ? 'متصل' : 'بانتظار التوكن'}
            </span>
          </div>

          {/* Active Queue Count */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-xs text-indigo-300">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span>الطابور:</span>
            <span className="font-bold text-white px-1.5 py-0.2 rounded bg-indigo-600 text-[11px]">
              {activeJobsCount}
            </span>
          </div>

          {/* Export Project ZIP Button */}
          <a
            href="/api/export-zip"
            download="nazzil-bot-source.zip"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/30 transition transform active:scale-95"
            title="تنزيل كود المشروع كاملاً بصيغة ZIP"
          >
            <Download className="w-3.5 h-3.5" />
            <span>تحميل الكود (ZIP)</span>
          </a>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>

          {/* Logout */}
          <button
            onClick={() => {
              removeAdminToken();
              onLogout();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 hover:text-rose-100 border border-rose-800/50 text-xs font-medium transition"
            title="تسجيل الخروج"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">خروج</span>
          </button>
        </div>
      </div>
    </header>
  );
};
