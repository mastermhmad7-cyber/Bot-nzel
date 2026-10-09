import React, { useState, useEffect } from 'react';
import { Radio, Plus, Trash2, CheckCircle2, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { adminApi } from '../services/api';

export const ChannelsView: React.FC = () => {
  const [channels, setChannels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [channelName, setChannelName] = useState('');
  const [channelUsername, setChannelUsername] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [isActive, setIsActive] = useState(true);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getChannels();
      setChannels(data.channels || []);
    } catch (err) {
      console.error('Failed to load channels:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, []);

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      await adminApi.updateChannel(id, { is_active: !currentStatus });
      setChannels((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !currentStatus } : c))
      );
    } catch {
      alert('فشل تحديث حالة القناة');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه القناة من قائمة الاشتراك الإجباري؟')) return;
    try {
      await adminApi.deleteChannel(id);
      setChannels((prev) => prev.filter((c) => c.id !== id));
    } catch {
      alert('فشل حذف القناة');
    }
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelName.trim() || !channelUsername.trim()) {
      alert('يرجى ملء اسم القناة ومعرفها');
      return;
    }

    setSaving(true);
    try {
      const normalizedUsername = channelUsername.trim().startsWith('@')
        ? channelUsername.trim()
        : `@${channelUsername.trim()}`;

      const res = await adminApi.addChannel({
        channel_name: channelName.trim(),
        channel_username: normalizedUsername,
        invite_link: inviteLink.trim() || `https://t.me/${normalizedUsername.replace('@', '')}`,
        is_active: isActive,
        order: channels.length + 1,
      });

      if (res.success && res.channel) {
        setChannels((prev) => [...prev, res.channel]);
        setShowAddModal(false);
        setChannelName('');
        setChannelUsername('');
        setInviteLink('');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة القناة');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400" />
            <span>نظام الاشتراك الإجباري (Required Channels)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            يتحقق البوت تلقائياً من اشتراك المستخدم في القنوات المفعلة أدناه قبل السماح له بالتحميل
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قناة جديدة</span>
          </button>

          <button
            onClick={loadChannels}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Info Notice */}
      <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs text-indigo-200 flex items-start gap-3">
        <span className="text-lg">💡</span>
        <div>
          <div className="font-bold text-white">تنبيه مهم للتشغيل في الإنتاج:</div>
          <p className="mt-0.5 text-indigo-300/90 leading-relaxed">
            للتأكد من قدرة البوت على فحص اشتراك المستخدمين، يجب إضافة البوت كمشرف (Admin) داخل القناة مع إذن دعوة أو رؤية الأعضاء.
          </p>
        </div>
      </div>

      {/* Channels List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && channels.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
            جاري تحميل القنوات...
          </div>
        ) : channels.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
            لا توجد قنوات اشتراك إجباري مضافة حالياً. المستخدمون سيتمكنون من التحميل مباشرة.
          </div>
        ) : (
          channels.map((ch) => (
            <div
              key={ch.id}
              className={`p-4 rounded-2xl bg-slate-900/80 border transition-all ${
                ch.is_active ? 'border-slate-800 hover:border-indigo-500/40' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-base ${
                    ch.is_active ? 'bg-indigo-600/80' : 'bg-slate-800'
                  }`}>
                    📢
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">{ch.channel_name}</h3>
                    <div className="font-mono text-xs text-indigo-400 mt-0.5">{ch.channel_username}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleToggleActive(ch.id, ch.is_active)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                      ch.is_active
                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/60'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    {ch.is_active ? 'مفعلة' : 'معطلة'}
                  </button>
                  <button
                    onClick={() => handleDelete(ch.id)}
                    className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition"
                    title="حذف القناة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                <a
                  href={ch.invite_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{ch.invite_link}</span>
                </a>
                <span className="text-slate-400 font-mono text-[11px]">
                  {new Date(ch.created_at).toLocaleDateString('ar-SA')}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Channel Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-right">
            <h3 className="text-lg font-bold text-white mb-1">إضافة قناة للاشتراك الإجباري</h3>
            <p className="text-xs text-slate-400 mb-4">
              أدخل تفاصيل القناة التي تود إلزام المستخدمين بالانضمام إليها قبل التحميل
            </p>

            <form onSubmit={handleAddChannel} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">اسم القناة الظاهر:</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="مثال: قناة نَزِّل الرسمية"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">معرّف القناة (Username / ID):</label>
                <input
                  type="text"
                  value={channelUsername}
                  onChange={(e) => setChannelUsername(e.target.value)}
                  placeholder="مثال: @NazzilUpdates أو -100123456789"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">رابط الدعوة (Invite Link):</label>
                <input
                  type="url"
                  value={inviteLink}
                  onChange={(e) => setInviteLink(e.target.value)}
                  placeholder="https://t.me/your_channel (اختياري، يملأ تلقائياً)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="isActive" className="text-slate-300 cursor-pointer">
                  تفعيل التحقق من القناة فوراً
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-md shadow-indigo-600/30 cursor-pointer"
                >
                  {saving ? 'جاري الحفظ...' : 'حفظ القناة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
