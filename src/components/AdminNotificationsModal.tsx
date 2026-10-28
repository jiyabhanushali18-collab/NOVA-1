import React, { useState, useEffect } from 'react';
import { apiUrl } from '../services/apiClient';

interface AdminNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
}

interface SchedulerConfig {
  enabled: boolean;
  morningTime: { hour: number; minute: number };
  eveningTime: { hour: number; minute: number };
  defaultTimezone: string;
  lastMorningRunDate: string | null;
  lastEveningRunDate: string | null;
}

interface NotificationTemplate {
  id: string;
  slot: 'morning' | 'evening';
  category: string;
  language: 'hinglish' | 'english' | 'hindi';
  title: string;
  body: string;
  deepLink: string;
  tags?: string[];
}

interface MetricsData {
  totalSendAttempts: number;
  totalSuccessfulSends: number;
  totalFailedSends: number;
  totalOptOuts: number;
  totalTaps: number;
  activeOptedInRecipients: number;
  totalRegisteredDevices: number;
  lastMorningCampaignAt: string | null;
  lastEveningCampaignAt: string | null;
  recentCampaignHistory: Array<{
    campaignId: string;
    slot: string;
    eligibleRecipients: number;
    sendAttempts: number;
    successfulSends: number;
    failedSends: number;
    invalidTokensPruned: number;
    skippedDueToCap: number;
    executedAt: string;
  }>;
}

export const AdminNotificationsModal: React.FC<AdminNotificationsModalProps> = ({
  isOpen,
  onClose,
  isDarkMode = false
}) => {
  const [adminKey, setAdminKey] = useState<string>(() => {
    return localStorage.getItem('nova_admin_key') || 'nova-admin-secret-2026';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'scheduler' | 'library' | 'test'>('overview');

  // Config & metrics state
  const [config, setConfig] = useState<SchedulerConfig | null>(null);
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<NotificationTemplate | null>(null);

  // Form states for scheduler
  const [morningHour, setMorningHour] = useState<number>(10);
  const [morningMinute, setMorningMinute] = useState<number>(0);
  const [eveningHour, setEveningHour] = useState<number>(19);
  const [eveningMinute, setEveningMinute] = useState<number>(0);
  const [timezone, setTimezone] = useState<string>('Asia/Kolkata');

  // Form states for test send
  const [testCustomTitle, setTestCustomTitle] = useState<string>('');
  const [testCustomBody, setTestCustomBody] = useState<string>('');
  const [testDeepLink, setTestDeepLink] = useState<'ar-tryon' | 'showroom' | 'wishlist' | 'stylist' | 'home'>('ar-tryon');
  const [testTargetToken, setTestTargetToken] = useState<string>('simulation');

  // UI feedback
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const loadData = async (keyToUse = adminKey) => {
    setLoading(true);
    try {
      const headers = { 'x-admin-key': keyToUse };

      // Config
      const configRes = await fetch(apiUrl('/api/notifications/admin/config'), { headers });
      if (!configRes.ok) throw new Error('Unauthorized or invalid admin key');
      const configData = await configRes.json();
      if (configData.success) {
        setConfig(configData.config);
        setMorningHour(configData.config.morningTime.hour);
        setMorningMinute(configData.config.morningTime.minute);
        setEveningHour(configData.config.eveningTime.hour);
        setEveningMinute(configData.config.eveningTime.minute);
        setTimezone(configData.config.defaultTimezone || 'Asia/Kolkata');
        setIsAuthenticated(true);
        localStorage.setItem('nova_admin_key', keyToUse);
      }

      // Metrics
      const metricsRes = await fetch(apiUrl('/api/notifications/admin/metrics'), { headers });
      const metricsData = await metricsRes.json();
      if (metricsData.success) {
        setMetrics(metricsData.metrics);
      }

      // Library
      const libRes = await fetch(apiUrl('/api/notifications/admin/library'), { headers });
      const libData = await libRes.json();
      if (libData.success) {
        setTemplates(libData.templates || []);
        if (libData.templates?.length > 0 && !selectedTemplate) {
          setSelectedTemplate(libData.templates[0]);
        }
      }
    } catch (err: any) {
      setIsAuthenticated(false);
      showToast(err.message || 'Authentication failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleSaveSchedule = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/notifications/admin/config'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          morningHour,
          morningMinute,
          eveningHour,
          eveningMinute,
          defaultTimezone: timezone
        })
      });
      const data = await res.json();
      if (data.success) {
        setConfig(data.config);
        showToast('Schedule settings saved successfully!');
      } else {
        showToast(data.error || 'Failed to save schedule', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Error updating schedule', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleScheduler = async (pause: boolean) => {
    setLoading(true);
    try {
      const endpoint = pause ? '/api/notifications/admin/pause' : '/api/notifications/admin/resume';
      const res = await fetch(apiUrl(endpoint), {
        method: 'POST',
        headers: { 'x-admin-key': adminKey }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message);
        loadData();
      } else {
        showToast(data.error || 'Failed to toggle scheduler', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Scheduler action failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCampaign = async (slot: 'morning' | 'evening') => {
    if (!window.confirm(`Are you sure you want to trigger the ${slot.toUpperCase()} campaign now?`)) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/notifications/admin/trigger-campaign'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ slot })
      });
      const data = await res.json();
      if (data.success) {
        const r = data.result;
        showToast(`Campaign finished: ${r.successfulSends}/${r.sendAttempts} sent, ${r.skippedDueToCap} capped.`);
        loadData();
      } else {
        showToast(data.error || 'Failed to trigger campaign', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Trigger error', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setLoading(true);
    try {
      const title = testCustomTitle || selectedTemplate?.title || 'NOVA Fit Check 💅';
      const body = testCustomBody || selectedTemplate?.body || 'Crush ka reply aaye na aaye, outfit toh slay karna hai!';
      const deepLink = testDeepLink || selectedTemplate?.deepLink || 'ar-tryon';

      const res = await fetch(apiUrl('/api/notifications/admin/test-send'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          testToken: testTargetToken,
          customTitle: title,
          customBody: body,
          deepLink
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Test notification dispatched successfully!');
      } else {
        showToast(data.error || 'Test send failed', 'error');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to send test notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className={`relative w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl border overflow-hidden ${
        isDarkMode ? 'bg-[#121422] border-slate-800 text-white' : 'bg-white border-[#E4DFF5] text-[#131426]'
      }`}>
        
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDarkMode ? 'border-slate-800 bg-[#16192E]' : 'border-[#E4DFF5] bg-[#F7F5FC]'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#553BE2] to-[#8C76FF] flex items-center justify-center text-white shadow-md shadow-[#553BE2]/30">
              <span className="material-symbols-outlined text-xl">campaign</span>
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                Marketing Push Automation
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#553BE2]/10 text-[#553BE2] border border-[#553BE2]/20">
                  Zomato Style
                </span>
              </h2>
              <p className={`text-xs ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                Scheduled 10 AM & 7 PM campaigns, copy library & push delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${
              isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-[#E4DFF5] text-[#5E667A]'
            }`}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Status Toast */}
        {statusMessage && (
          <div className={`px-4 py-2.5 text-xs font-bold text-center transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-b border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-b border-rose-500/20'
          }`}>
            {statusMessage.text}
          </div>
        )}

        {/* Auth Barrier if not authenticated */}
        {!isAuthenticated ? (
          <div className="p-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-[#553BE2]/10 flex items-center justify-center text-[#553BE2]">
              <span className="material-symbols-outlined text-3xl">lock</span>
            </div>
            <div>
              <h3 className="text-base font-bold">Admin Authentication Required</h3>
              <p className={`text-xs mt-1 ${isDarkMode ? 'text-slate-400' : 'text-[#5E667A]'}`}>
                Enter the administrative secret key to configure marketing push campaigns.
              </p>
            </div>
            <div className="w-full max-w-sm space-y-3">
              <input
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter Admin Secret..."
                className={`w-full px-4 py-2.5 text-sm rounded-xl border outline-none font-mono ${
                  isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-[#F7F5FC] border-[#E4DFF5] text-[#131426]'
                }`}
              />
              <button
                disabled={loading}
                onClick={() => loadData(adminKey)}
                className="w-full py-2.5 bg-[#553BE2] hover:bg-[#472fc9] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                {loading ? 'Authenticating...' : 'Unlock Controls'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Tabs Bar */}
            <div className={`flex border-b px-4 gap-2 ${
              isDarkMode ? 'border-slate-800 bg-[#14172B]' : 'border-[#E4DFF5] bg-[#FAF8FE]'
            }`}>
              {[
                { id: 'overview', label: 'Overview & Metrics', icon: 'analytics' },
                { id: 'scheduler', label: 'Schedule Times', icon: 'schedule' },
                { id: 'library', label: 'Witty Copy Library', icon: 'auto_stories' },
                { id: 'test', label: 'Live Test Send', icon: 'send' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 py-3 px-3 text-xs font-bold border-b-2 transition-all ${
                    activeTab === tab.id
                      ? 'border-[#553BE2] text-[#553BE2]'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* TAB 1: OVERVIEW & METRICS */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Top Stats Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-[#F9F7FD] border-[#E4DFF5]'}`}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Recipients</span>
                        <span className="material-symbols-outlined text-[#553BE2] text-sm">groups</span>
                      </div>
                      <div className="text-xl font-black mt-2 text-[#553BE2]">
                        {metrics?.activeOptedInRecipients ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {metrics?.totalRegisteredDevices ?? 0} total devices
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-[#F9F7FD] border-[#E4DFF5]'}`}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Successful</span>
                        <span className="material-symbols-outlined text-emerald-500 text-sm">check_circle</span>
                      </div>
                      <div className="text-xl font-black mt-2 text-emerald-500">
                        {metrics?.totalSuccessfulSends ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {metrics?.totalSendAttempts ?? 0} attempts
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-[#F9F7FD] border-[#E4DFF5]'}`}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Taps & CTR</span>
                        <span className="material-symbols-outlined text-indigo-400 text-sm">touch_app</span>
                      </div>
                      <div className="text-xl font-black mt-2 text-indigo-400">
                        {metrics?.totalTaps ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        {metrics && metrics.totalSuccessfulSends > 0
                          ? `${Math.round((metrics.totalTaps / metrics.totalSuccessfulSends) * 100)}% CTR`
                          : '0% CTR'}
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-[#F9F7FD] border-[#E4DFF5]'}`}>
                      <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Opt-Outs</span>
                        <span className="material-symbols-outlined text-rose-400 text-sm">person_off</span>
                      </div>
                      <div className="text-xl font-black mt-2 text-rose-400">
                        {metrics?.totalOptOuts ?? 0}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        Users opted out
                      </div>
                    </div>
                  </div>

                  {/* Manual trigger buttons */}
                  <div className={`p-5 rounded-2xl border space-y-3 ${
                    isDarkMode ? 'bg-slate-900/40 border-slate-800' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold">Manual Campaign Dispatch</h4>
                        <p className="text-[11px] text-slate-400">
                          Manually trigger scheduled batch sends to all opted-in recipients.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          disabled={loading}
                          onClick={() => handleTriggerCampaign('morning')}
                          className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl text-xs font-bold hover:brightness-110 flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">wb_sunny</span>
                          Run Morning (10 AM)
                        </button>
                        <button
                          disabled={loading}
                          onClick={() => handleTriggerCampaign('evening')}
                          className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl text-xs font-bold hover:brightness-110 flex items-center gap-1.5 shadow-sm transition-all"
                        >
                          <span className="material-symbols-outlined text-sm">nightlight_round</span>
                          Run Evening (7 PM)
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Recent campaign history */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Recent Campaign Executions
                    </h4>
                    {(!metrics?.recentCampaignHistory || metrics.recentCampaignHistory.length === 0) ? (
                      <div className={`p-6 text-center rounded-2xl border text-xs text-slate-400 ${
                        isDarkMode ? 'bg-slate-900/30 border-slate-800' : 'bg-white border-[#E4DFF5]'
                      }`}>
                        No scheduled campaigns executed yet. The scheduler triggers automatically at 10:00 AM & 7:00 PM.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {metrics.recentCampaignHistory.slice(0, 5).map((camp, idx) => (
                          <div
                            key={idx}
                            className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
                              isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-[#E4DFF5]'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                camp.slot === 'morning' ? 'bg-amber-500/20 text-amber-500' : 'bg-indigo-500/20 text-indigo-400'
                              }`}>
                                {camp.slot === 'morning' ? 'AM' : 'PM'}
                              </span>
                              <div>
                                <div className="font-bold flex items-center gap-2">
                                  {camp.slot.toUpperCase()} Campaign
                                  <span className="text-[10px] text-slate-400 font-normal">
                                    {new Date(camp.executedAt).toLocaleString()}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {camp.successfulSends}/{camp.sendAttempts} delivered • {camp.invalidTokensPruned} invalid pruned • {camp.skippedDueToCap} capped
                                </div>
                              </div>
                            </div>
                            <span className="font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full text-[10px]">
                              Completed
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: SCHEDULER CONFIG */}
              {activeTab === 'scheduler' && (
                <div className="space-y-6">
                  {/* Status Banner */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${
                    config?.enabled
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}>
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-2xl">
                        {config?.enabled ? 'schedule' : 'pause_circle'}
                      </span>
                      <div>
                        <div className="font-bold text-xs">
                          Scheduler Status: {config?.enabled ? 'ACTIVE & RUNNING' : 'PAUSED BY ADMIN'}
                        </div>
                        <div className="text-[10px] opacity-80">
                          {config?.enabled
                            ? 'Delivering campaigns at configured local times independently of app state.'
                            : 'All scheduled push dispatches are currently paused.'}
                        </div>
                      </div>
                    </div>
                    <button
                      disabled={loading}
                      onClick={() => handleToggleScheduler(Boolean(config?.enabled))}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                        config?.enabled
                          ? 'bg-amber-500 hover:bg-amber-600 text-white'
                          : 'bg-emerald-500 hover:bg-emerald-600 text-white'
                      }`}
                    >
                      {config?.enabled ? 'Pause Scheduler' : 'Resume Scheduler'}
                    </button>
                  </div>

                  {/* Times Config Form */}
                  <div className={`p-6 rounded-2xl border space-y-5 ${
                    isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-white border-[#E4DFF5]'
                  }`}>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-[#553BE2]">tune</span>
                      Daily Campaign Timing Configuration
                    </h4>

                    {/* Morning Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="space-y-2">
                        <label className="text-xs font-bold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-amber-500 text-sm">wb_sunny</span>
                          Morning Campaign Time
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={morningHour}
                            onChange={(e) => setMorningHour(parseInt(e.target.value, 10))}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                            }`}
                          >
                            {Array.from({ length: 24 }).map((_, h) => (
                              <option key={h} value={h}>
                                {h.toString().padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-slate-400 font-bold">:</span>
                          <select
                            value={morningMinute}
                            onChange={(e) => setMorningMinute(parseInt(e.target.value, 10))}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                            }`}
                          >
                            {[0, 15, 30, 45].map((m) => (
                              <option key={m} value={m}>
                                {m.toString().padStart(2, '0')} min
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Evening Time */}
                      <div className="space-y-2">
                        <label className="text-xs font-bold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-indigo-400 text-sm">nightlight_round</span>
                          Evening Campaign Time
                        </label>
                        <div className="flex items-center gap-2">
                          <select
                            value={eveningHour}
                            onChange={(e) => setEveningHour(parseInt(e.target.value, 10))}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                            }`}
                          >
                            {Array.from({ length: 24 }).map((_, h) => (
                              <option key={h} value={h}>
                                {h.toString().padStart(2, '0')}:00 {h < 12 ? 'AM' : 'PM'}
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-slate-400 font-bold">:</span>
                          <select
                            value={eveningMinute}
                            onChange={(e) => setEveningMinute(parseInt(e.target.value, 10))}
                            className={`px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                              isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                            }`}
                          >
                            {[0, 15, 30, 45].map((m) => (
                              <option key={m} value={m}>
                                {m.toString().padStart(2, '0')} min
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Timezone */}
                    <div className="space-y-2 pt-2">
                      <label className="text-xs font-bold flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm">public</span>
                        Default Target Timezone
                      </label>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                          isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                        }`}
                      >
                        <option value="Asia/Kolkata">Asia/Kolkata (IST — UTC+05:30)</option>
                        <option value="Asia/Dubai">Asia/Dubai (GST — UTC+04:00)</option>
                        <option value="Europe/London">Europe/London (GMT/BST)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      </select>
                    </div>

                    <div className="pt-3">
                      <button
                        disabled={loading}
                        onClick={handleSaveSchedule}
                        className="px-5 py-2.5 bg-[#553BE2] hover:bg-[#472fc9] text-white font-bold text-xs rounded-xl shadow-md transition-colors"
                      >
                        {loading ? 'Saving...' : 'Save Schedule Settings'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WITTY COPY LIBRARY */}
              {activeTab === 'library' && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                  {/* Left column: Template selector */}
                  <div className="md:col-span-6 space-y-3 max-h-[500px] overflow-y-auto pr-1">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold mb-2">
                      <span>{templates.length} Active Templates</span>
                      <span>Hinglish • English • Hindi</span>
                    </div>
                    {templates.map((tpl) => (
                      <div
                        key={tpl.id}
                        onClick={() => setSelectedTemplate(tpl)}
                        className={`p-3 rounded-2xl border cursor-pointer transition-all ${
                          selectedTemplate?.id === tpl.id
                            ? 'border-[#553BE2] bg-[#553BE2]/10 ring-1 ring-[#553BE2]'
                            : isDarkMode
                            ? 'border-slate-800 bg-slate-900/40 hover:bg-slate-900/80'
                            : 'border-[#E4DFF5] bg-white hover:bg-[#FAF8FE]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            tpl.slot === 'morning' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-400'
                          }`}>
                            {tpl.slot.toUpperCase()} • {tpl.category}
                          </span>
                          <span className="text-[10px] font-mono uppercase text-slate-400">
                            {tpl.language}
                          </span>
                        </div>
                        <div className="text-xs font-black mt-1.5 leading-snug">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {tpl.body}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right column: Android Notification Live Preview */}
                  <div className="md:col-span-6 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Android Lockscreen Notification Preview
                    </h4>
                    
                    {/* Simulated Phone Notification */}
                    <div className="p-4 rounded-3xl bg-[#1C1F2E] text-white shadow-2xl border border-slate-700/60 max-w-sm mx-auto space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5 font-bold">
                          <div className="w-4 h-4 rounded bg-[#553BE2] flex items-center justify-center text-[10px] text-white">
                            N
                          </div>
                          <span>NOVA</span>
                          <span>•</span>
                          <span>now</span>
                        </div>
                        <span className="material-symbols-outlined text-xs">expand_more</span>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs font-black tracking-tight text-white">
                          {selectedTemplate?.title || 'Good morning, stunner 💅'}
                        </div>
                        <div className="text-xs text-slate-300 leading-snug">
                          {selectedTemplate?.body || 'Crush ka reply aaye na aaye, aaj ka outfit toh slay karna hai. Open NOVA & get dressed!'}
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-slate-700/40 text-[10px]">
                        <span className="font-bold text-[#8C76FF] flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">launch</span>
                          Deep link: /{selectedTemplate?.deepLink || 'showroom'}
                        </span>
                        <span className="text-slate-400">Swipe to dismiss</span>
                      </div>
                    </div>

                    {/* Pre-fill for test send */}
                    {selectedTemplate && (
                      <div className="text-center pt-2">
                        <button
                          onClick={() => {
                            setTestCustomTitle(selectedTemplate.title);
                            setTestCustomBody(selectedTemplate.body);
                            setTestDeepLink(selectedTemplate.deepLink as any);
                            setActiveTab('test');
                          }}
                          className="px-4 py-2 bg-[#553BE2]/10 hover:bg-[#553BE2]/20 text-[#553BE2] text-xs font-bold rounded-xl border border-[#553BE2]/20 transition-all inline-flex items-center gap-1.5"
                        >
                          <span className="material-symbols-outlined text-sm">send</span>
                          Use this template in Live Test Send
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: LIVE TEST SEND */}
              {activeTab === 'test' && (
                <div className="max-w-xl mx-auto space-y-5">
                  <div className={`p-4 rounded-2xl border text-xs ${
                    isDarkMode ? 'bg-slate-900/50 border-slate-800' : 'bg-[#FAF8FE] border-[#E4DFF5]'
                  }`}>
                    <div className="font-bold flex items-center gap-2">
                      <span className="material-symbols-outlined text-indigo-400">send</span>
                      Live Multi-Device Push Dispatcher
                    </div>
                    <div className="text-slate-400 mt-1">
                      Test push notifications on your real connected device or verify delivery in dev simulation mode.
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Destination Token */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Target Device Token</label>
                      <select
                        value={testTargetToken}
                        onChange={(e) => setTestTargetToken(e.target.value)}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                        }`}
                      >
                        <option value="simulation">Local Dev Simulation (Instant Response)</option>
                        <option value="first">First Registered Customer Device</option>
                      </select>
                    </div>

                    {/* Notification Title */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Witty Notification Title</label>
                      <input
                        type="text"
                        value={testCustomTitle}
                        onChange={(e) => setTestCustomTitle(e.target.value)}
                        placeholder="e.g. Good morning, stunner 💅"
                        className={`w-full px-3 py-2 text-xs rounded-xl border outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-[#E4DFF5]'
                        }`}
                      />
                    </div>

                    {/* Notification Body */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">Playful Message Body</label>
                      <textarea
                        rows={3}
                        value={testCustomBody}
                        onChange={(e) => setTestCustomBody(e.target.value)}
                        placeholder="e.g. Crush ka reply aaye na aaye, aaj ka outfit toh slay karna hai..."
                        className={`w-full px-3 py-2 text-xs rounded-xl border outline-none resize-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-white border-[#E4DFF5]'
                        }`}
                      />
                    </div>

                    {/* Deep Link Screen */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold">In-App Deep Link Destination</label>
                      <select
                        value={testDeepLink}
                        onChange={(e) => setTestDeepLink(e.target.value as any)}
                        className={`w-full px-3 py-2 text-xs font-bold rounded-xl border outline-none ${
                          isDarkMode ? 'bg-slate-900 border-slate-700' : 'bg-[#F7F5FC] border-[#E4DFF5]'
                        }`}
                      >
                        <option value="ar-tryon">AR Try-On Camera (/ar-tryon)</option>
                        <option value="showroom">Curated Showroom (/showroom)</option>
                        <option value="wishlist">Wishlist & Outfits (/wishlist)</option>
                        <option value="stylist">Stylist AI Chat (/stylist)</option>
                        <option value="home">Home Feed (/home)</option>
                      </select>
                    </div>

                    <button
                      disabled={loading}
                      onClick={handleSendTestNotification}
                      className="w-full py-3 bg-[#553BE2] hover:bg-[#472fc9] text-white font-bold text-xs rounded-xl shadow-lg shadow-[#553BE2]/25 transition-all flex items-center justify-center gap-2"
                    >
                      <span className="material-symbols-outlined text-sm">send</span>
                      {loading ? 'Dispatching...' : 'Dispatch Test Push Notification'}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </>
        )}

      </div>
    </div>
  );
};
