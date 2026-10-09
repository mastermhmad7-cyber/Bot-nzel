import React, { useState, useEffect } from 'react';
import { Search, Ban, CheckCircle, UserCheck, ShieldAlert, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/api';

export const UsersView: React.FC = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getUsers(search);
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers();
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleBanToggle = async (userId: number, currentBanned: boolean) => {
    setActionLoading(userId);
    try {
      await adminApi.setUserBan(userId, !currentBanned);
      setUsers((prev) =>
        prev.map((u) => (u.telegram_id === userId ? { ...u, is_banned: !currentBanned } : u))
      );
    } catch (err) {
      alert('فشل تغيير حالة الحظر');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header and Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">إدارة مستخدمي المنصة</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            عرض وتحكم بحسابات المستخدمين، حالة النشاط وإجراءات الحظر الفوري ({total} مستخدم)
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالمعرّف ID أو اسم المستخدم..."
              className="w-full pl-3 pr-9 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-white placeholder-slate-400 text-xs focus:outline-none focus:border-indigo-500 transition"
            />
          </div>

          <button
            onClick={loadUsers}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="تحديث القائمة"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-800/60 text-slate-400 border-b border-slate-800 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4 font-semibold">المستخدم</th>
                <th className="py-3 px-4 font-semibold">Telegram ID</th>
                <th className="py-3 px-4 font-semibold">عدد التحميلات</th>
                <th className="py-3 px-4 font-semibold">آخر نشاط</th>
                <th className="py-3 px-4 font-semibold">تاريخ الانضمام</th>
                <th className="py-3 px-4 font-semibold">الحالة</th>
                <th className="py-3 px-4 font-semibold text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    جاري تحميل المستخدمين...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لم يتم العثور على مستخدمين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || 'بدون اسم';
                  const isActioning = actionLoading === u.telegram_id;

                  return (
                    <tr key={u.telegram_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-700 to-cyan-600 flex items-center justify-center font-bold text-white text-xs shrink-0">
                            {displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-semibold text-white flex items-center gap-1.5">
                              <span>{displayName}</span>
                              {u.is_admin && (
                                <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold border border-amber-500/30">
                                  مدير
                                </span>
                              )}
                            </div>
                            <div className="text-slate-400 text-[11px] font-mono">
                              {u.username ? `@${u.username}` : 'لا يوجد معرف'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-300">{u.telegram_id}</td>

                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/50">
                          {u.downloads_count || 0}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {u.last_activity ? new Date(u.last_activity).toLocaleString('ar-SA') : '—'}
                      </td>

                      <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                        {u.joined_at ? new Date(u.joined_at).toLocaleDateString('ar-SA') : '—'}
                      </td>

                      <td className="py-3.5 px-4">
                        {u.is_banned ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/30 font-semibold text-[11px]">
                            <Ban className="w-3 h-3" />
                            محظور
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold text-[11px]">
                            <CheckCircle className="w-3 h-3" />
                            نشط
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => handleBanToggle(u.telegram_id, u.is_banned)}
                          disabled={isActioning}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1 mx-auto ${
                            u.is_banned
                              ? 'bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60'
                              : 'bg-rose-950/60 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60'
                          }`}
                        >
                          {u.is_banned ? (
                            <>
                              <UserCheck className="w-3 h-3" />
                              <span>إلغاء الحظر</span>
                            </>
                          ) : (
                            <>
                              <ShieldAlert className="w-3 h-3" />
                              <span>حظر</span>
                            </>
                          )}
                        </button>
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
