import React, { useState } from 'react';
import { Lock, Shield, KeyRound, AlertTriangle } from 'lucide-react';
import { adminApi } from '../services/api';

interface LoginModalProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onSuccess }) => {
  const [password, setPassword] = useState('');
  const [telegramId, setTelegramId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() && !telegramId.trim()) {
      setError('يرجى إدخال كلمة المرور أو معرّف Telegram الخاص بالإدارة');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await adminApi.login(password.trim(), telegramId.trim() || undefined);
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'فشل التحقق من هوية المدير');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-7 shadow-2xl text-right relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white">تسجيل الدخول للوحة الإدارة</h2>
            <p className="text-xs text-slate-400 mt-0.5">منصة «نَزِّل» - منطقة الإدارة المحمية</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              كلمة مرور لوحة الإدارة:
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور..."
                className="w-full pr-10 pl-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-xs"
                autoFocus
              />
            </div>
            <span className="text-[11px] text-slate-400 block mt-1">
              افتراضي: <code className="text-indigo-400">admin_secure_password_123</code> (أو كما هو محدد في .env)
            </span>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              أو المعرف الرقمي لمدير Telegram (ADMIN_TELEGRAM_ID):
            </label>
            <input
              type="text"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              placeholder="مثال: 123456789"
              className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500 text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-sm shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <Shield className="w-4 h-4" />
            <span>{loading ? 'جاري التحقق...' : 'دخول لوحة التحكم'}</span>
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-800 text-center text-[11px] text-slate-400">
          منصة نَزِّل مجهزة بأنظمة الحماية والتحقق ومطابقة الصلاحيات الصارمة.
        </div>
      </div>
    </div>
  );
};
