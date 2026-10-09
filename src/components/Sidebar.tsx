import React from 'react';
import {
  LayoutDashboard,
  Users,
  Radio,
  Megaphone,
  Layers,
  Bot,
  Settings,
} from 'lucide-react';

export type TabId = 'overview' | 'users' | 'channels' | 'ads' | 'queue' | 'simulator' | 'settings';

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  queueCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, queueCount }) => {
  const tabs = [
    { id: 'overview' as TabId, label: 'نظرة عامة', icon: LayoutDashboard },
    { id: 'users' as TabId, label: 'إدارة المستخدمين', icon: Users },
    { id: 'channels' as TabId, label: 'الاشتراك الإجباري', icon: Radio },
    { id: 'ads' as TabId, label: 'نظام الإعلانات', icon: Megaphone },
    { id: 'queue' as TabId, label: 'طابور المهام', icon: Layers, badge: queueCount },
    { id: 'simulator' as TabId, label: 'مختبر ومحاكي البوت', icon: Bot, isHighlight: true },
    { id: 'settings' as TabId, label: 'إعدادات النظام', icon: Settings },
  ];

  return (
    <aside className="w-full lg:w-64 bg-slate-900/60 border-l border-slate-800 p-3 flex lg:flex-col gap-1.5 overflow-x-auto lg:overflow-y-auto shrink-0">
      <div className="hidden lg:block px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
        القائمة الرئيسية
      </div>

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all shrink-0 ${
              isActive
                ? 'bg-gradient-to-l from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-600/20'
                : tab.isHighlight
                ? 'bg-slate-800/80 text-cyan-300 hover:bg-slate-800 border border-cyan-500/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : tab.isHighlight ? 'text-cyan-400' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
            </div>

            {tab.badge !== undefined && tab.badge > 0 && (
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isActive ? 'bg-white text-indigo-700' : 'bg-indigo-600 text-white'
              }`}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}

      <div className="hidden lg:block mt-auto pt-4 border-t border-slate-800 text-xs text-slate-400 px-3">
        <div className="flex items-center justify-between py-1">
          <span>الإصدار:</span>
          <span className="font-mono text-slate-300">v2.4.0</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span>البيئة:</span>
          <span className="text-emerald-400 font-medium">Cloud Run Ready</span>
        </div>
      </div>
    </aside>
  );
};
