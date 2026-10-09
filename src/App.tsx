/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, TabId } from './components/Sidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { UsersView } from './components/UsersView';
import { ChannelsView } from './components/ChannelsView';
import { AdsView } from './components/AdsView';
import { QueueView } from './components/QueueView';
import { BotSimulatorView } from './components/BotSimulatorView';
import { SettingsView } from './components/SettingsView';
import { LoginModal } from './components/LoginModal';
import { adminApi, getAdminToken } from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fetchDashboardStats = async () => {
    setIsLoading(true);
    try {
      const data = await adminApi.getStats();
      setStats(data);
    } catch (err) {
      // If unauthorized, prompt for login
      if (!getAdminToken()) {
        setIsAuthModalOpen(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // If no token exists initially, auto-login with default dev password so the user gets straight into testing seamlessly!
    const token = getAdminToken();
    if (!token) {
      adminApi.login('192qow192')
        .catch(() => adminApi.login('admin_secure_password_123'))
        .then(() => {
          fetchDashboardStats();
        })
        .catch(() => {
          setIsAuthModalOpen(true);
        });
    } else {
      fetchDashboardStats();
    }

    const handleAuthRequired = () => {
      setIsAuthModalOpen(true);
    };

    window.addEventListener('auth_required', handleAuthRequired);
    return () => window.removeEventListener('auth_required', handleAuthRequired);
  }, []);

  const activeQueueCount = stats?.queue?.activeCount || 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white font-['Cairo',sans-serif]">
      {/* Top Navbar */}
      <Navbar
        systemStats={stats}
        activeJobsCount={activeQueueCount}
        onRefresh={fetchDashboardStats}
        isLoading={isLoading}
        onLogout={() => setIsAuthModalOpen(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-[1600px] mx-auto">
        {/* Navigation Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            if (tab === 'overview') fetchDashboardStats();
          }}
          queueCount={activeQueueCount}
        />

        {/* Tab Content Viewport */}
        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {activeTab === 'overview' && (
            <DashboardOverview
              stats={stats}
              onNavigateToSimulator={() => setActiveTab('simulator')}
            />
          )}

          {activeTab === 'users' && <UsersView />}

          {activeTab === 'channels' && <ChannelsView />}

          {activeTab === 'ads' && <AdsView />}

          {activeTab === 'queue' && <QueueView />}

          {activeTab === 'simulator' && <BotSimulatorView />}

          {activeTab === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Admin Login Dialog */}
      <LoginModal
        isOpen={isAuthModalOpen}
        onSuccess={() => {
          setIsAuthModalOpen(false);
          fetchDashboardStats();
        }}
      />
    </div>
  );
}
