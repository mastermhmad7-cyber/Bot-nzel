import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Eye, Link, RefreshCw, Sliders } from 'lucide-react';
import { adminApi } from '../services/api';

export const AdsView: React.FC = () => {
  const [ads, setAds] = useState<any[]>([]);
  const [frequency, setFrequency] = useState<string>('every_3');
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updatingFreq, setUpdatingFreq] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [buttonText, setButtonText] = useState('انقر هنا للتفاصيل ↗️');
  const [adType, setAdType] = useState('inline_button');
  const [isActive, setIsActive] = useState(true);

  const loadAds = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAds();
      setAds(data.ads || []);
      if (data.currentFrequency) {
        setFrequency(data.currentFrequency);
      }
    } catch (err) {
      console.error('Failed to load ads:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAds();
  }, []);

  const handleUpdateFrequency = async (newFreq: string) => {
    setFrequency(newFreq);
    setUpdatingFreq(true);
    try {
      await adminApi.updateSettings({ ad_frequency: newFreq });
    } catch {
      alert('فشل حفظ إعداد تكرار الإعلانات');
    } finally {
      setUpdatingFreq(false);
    }
  };

  const handleToggleAdActive = async (id: string, currentStatus: boolean) => {
    try {
      await adminApi.updateAd(id, { is_active: !currentStatus });
      setAds((prev) =>
        prev.map((a) => (a.id === id ? { ...a, is_active: !currentStatus } : a))
      );
    } catch {
      alert('فشل تحديث حالة الإعلان');
    }
  };

  const handleDeleteAd = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الإعلان؟')) return;
    try {
      await adminApi.deleteAd(id);
      setAds((prev) => prev.filter((a) => a.id !== id));
    } catch {
      alert('فشل حذف الإعلان');
    }
  };

  const handleCreateAd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !text.trim()) {
      alert('يرجى ملء عنوان الإعلان ونصه');
      return;
    }

    setSaving(true);
    try {
      const res = await adminApi.addAd({
        title: title.trim(),
        text: text.trim(),
        link_url: linkUrl.trim(),
        button_text: buttonText.trim(),
        ad_type: adType,
        is_active: isActive,
        order: ads.length + 1,
      });

      if (res.success && res.ad) {
        setAds((prev) => [...prev, res.ad]);
        setShowAddModal(false);
        setTitle('');
        setText('');
        setLinkUrl('');
      }
    } catch (err: any) {
      alert(err.message || 'حدث خطأ أثناء إضافة الإعلان');
    } finally {
      setSaving(false);
    }
  };

  const frequencyOptions = [
    { value: 'every_download', label: 'كل عملية تحميل (100%)' },
    { value: 'every_2', label: 'كل عمليتي تحميل (50%)' },
    { value: 'every_3', label: 'كل 3 عمليات تحميل (مستحسن 33%)' },
    { value: 'every_5', label: 'كل 5 عمليات تحميل (20%)' },
    { value: 'once_daily', label: 'مرة واحدة يومياً لكل مستخدم' },
    { value: 'disabled', label: 'تعطيل الإعلانات تماماً' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-indigo-400" />
            <span>نظام إدارة الإعلانات والحملات الترويجية</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            التحكم بالإعلانات المرفقة مع رسائل التنزيل ومعدل ظهورها التلقائي
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إنشاء إعلان جديد</span>
          </button>

          <button
            onClick={loadAds}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="تحديث"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Frequency Control Panel */}
      <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-800/60 flex items-center justify-center text-indigo-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-white text-sm">معدل تكرار ظهور الإعلانات للمستخدمين</div>
            <p className="text-xs text-slate-400">
              حدد عدد المرات التي يظهر فيها الإعلان عند تنزيل ملفات الوسائط
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={frequency}
            onChange={(e) => handleUpdateFrequency(e.target.value)}
            disabled={updatingFreq}
            className="w-full md:w-64 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
          >
            {frequencyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {updatingFreq && <span className="text-[11px] text-cyan-400 animate-pulse font-mono">حفظ...</span>}
        </div>
      </div>

      {/* Ads List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && ads.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
            جاري تحميل الإعلانات...
          </div>
        ) : ads.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-slate-400 text-xs bg-slate-900/60 rounded-xl border border-slate-800">
            لا توجد إعلانات منشأة بعد. اضغط على «إنشاء إعلان جديد» للبدء.
          </div>
        ) : (
          ads.map((ad) => (
            <div
              key={ad.id}
              className={`p-5 rounded-2xl bg-slate-900/80 border transition-all flex flex-col justify-between ${
                ad.is_active ? 'border-slate-800 hover:border-indigo-500/40' : 'border-slate-800/40 opacity-60'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="font-bold text-white text-base">{ad.title}</div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleAdActive(ad.id, ad.is_active)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        ad.is_active
                          ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50 hover:bg-emerald-900/60'
                          : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                      }`}
                    >
                      {ad.is_active ? 'نشط' : 'متوقف'}
                    </button>
                    <button
                      onClick={() => handleDeleteAd(ad.id)}
                      className="p-1.5 rounded-lg bg-rose-950/40 text-rose-400 hover:bg-rose-900/60 border border-rose-800/40 transition"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed mb-4">{ad.text}</p>

                {ad.button_text && ad.link_url && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs flex items-center justify-between">
                    <span className="font-semibold text-indigo-400 flex items-center gap-1">
                      <Link className="w-3.5 h-3.5" />
                      {ad.button_text}
                    </span>
                    <a
                      href={ad.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-400 hover:text-white truncate max-w-[140px] font-mono text-[11px]"
                    >
                      {ad.link_url}
                    </a>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400 font-mono">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>مرات الظهور: {ad.impressions || 0}</span>
                </div>
                <span>{new Date(ad.created_at).toLocaleDateString('ar-SA')}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Ad Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl text-right">
            <h3 className="text-lg font-bold text-white mb-1">إنشاء إعلان جديد</h3>
            <p className="text-xs text-slate-400 mb-4">
              سيتم عرض هذا الإعلان للمستخدمين وفقاً لمعدل التكرار المختار
            </p>

            <form onSubmit={handleCreateAd} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">عنوان الإعلان الداخلي:</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: إعلان قناة التوصيات"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">نص الإعلان الظاهر:</label>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="اكتب الرسالة الإعلانية أو العرض الترويجي..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">نص زر الإعلان:</label>
                <input
                  type="text"
                  value={buttonText}
                  onChange={(e) => setButtonText(e.target.value)}
                  placeholder="مثال: انضم الآن ↗️"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">رابط الإعلان (URL):</label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://t.me/your_ad_target"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="adActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="adActive" className="text-slate-300 cursor-pointer">
                  تفعيل الإعلان فوراً
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
                  {saving ? 'جاري الحفظ...' : 'حفظ الإعلان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
