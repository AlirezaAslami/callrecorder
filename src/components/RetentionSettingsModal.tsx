import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Trash2,
  HardDrive,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  X,
  History,
  FileAudio
} from 'lucide-react';
import {
  StorageSettings,
  loadSettings,
  saveSettings,
  performAutoPurge,
  getPurgeLogs,
  clearAllPurgeLogs,
  PurgeLogItem
} from '../services/storageService';
import { formatBytes, formatCallDate } from '../utils/formatters';

interface RetentionSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsUpdated: () => void;
  isPersian: boolean;
}

export const RetentionSettingsModal: React.FC<RetentionSettingsModalProps> = ({
  isOpen,
  onClose,
  onSettingsUpdated,
  isPersian,
}) => {
  const [settings, setSettings] = useState<StorageSettings>(loadSettings());
  const [purgeLogs, setPurgeLogs] = useState<PurgeLogItem[]>([]);
  const [isPurging, setIsPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'policy' | 'logs'>('policy');

  useEffect(() => {
    if (isOpen) {
      setSettings(loadSettings());
      loadLogs();
      setPurgeResult(null);
    }
  }, [isOpen]);

  const loadLogs = async () => {
    const logs = await getPurgeLogs();
    setPurgeLogs(logs);
  };

  if (!isOpen) return null;

  const handleSave = () => {
    saveSettings(settings);
    onSettingsUpdated();
    onClose();
  };

  const handleRunPurgeNow = async () => {
    setIsPurging(true);
    setPurgeResult(null);
    try {
      const res = await performAutoPurge();
      await loadLogs();
      onSettingsUpdated();
      setPurgeResult(
        isPersian
          ? `عملیات پاک‌سازی پایان یافت: ${res.purged30DaysCount} فایل منقضی ۳۰ روزه و ${res.purgedFifoCount} فایل قدیمی به دلیل سهمیه حافظه پاک شدند (${formatBytes(res.freedBytes)} فضا آزاد شد).`
          : `Purge complete: ${res.purged30DaysCount} 30-day expired and ${res.purgedFifoCount} FIFO files cleaned up (${formatBytes(res.freedBytes)} freed).`
      );
    } catch (e) {
      console.error(e);
      setPurgeResult(isPersian ? 'خطا در اجرای پاک‌سازی خودکار' : 'Error executing auto-purge');
    } finally {
      setIsPurging(false);
    }
  };

  const handleClearLogs = async () => {
    await clearAllPurgeLogs();
    setPurgeLogs([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        dir={isPersian ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                {isPersian
                  ? 'سیاست نگهداری ۳۰ روزه و FIFO'
                  : '30-Day Retention Policy'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isPersian
                  ? 'ذخیره حداکثر یک ماه و حذف خودکار از انتها'
                  : 'Store max 1 month, auto-purge oldest first'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 sm:p-1.5 gap-1 sm:gap-1.5">
          <button
            onClick={() => setActiveTab('policy')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'policy'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'تنظیمات نگهداری' : 'Rules & Quota'}</span>
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'logs'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? `گزارش پاک‌سازی (${purgeLogs.length})` : `Audit Logs (${purgeLogs.length})`}</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'policy' ? (
            <>
              {/* Highlight card explaining the exact mechanism requested */}
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-300">
                  <ShieldAlert className="w-4 h-4" />
                  <span>
                    {isPersian
                      ? 'مکانیزم پاک‌سازی هوشمند (درخواست شما)'
                      : 'Smart Retention Mechanism'}
                  </span>
                </div>
                <p className="text-slate-300 leading-relaxed">
                  {isPersian
                    ? 'طبق درخواست شما، تمامی فایل‌های تماس به صورت MP3 با نرخ فشرده‌سازی استاندارد در حافظه مرورگر شما ذخیره می‌شوند. هر فایل حداکثر تا ۳۰ روز (یک ماه) نگهداری شده و پس از انقضا یا رسیدن به سقف حافظه، سیستم به صورت خودکار قدیمی‌ترین فایل‌ها (FIFO) را از انتهای صف پاک می‌کند تا فضای ذخیره‌سازی آزاد بماند.'
                    : 'Per your requirement, all call files are stored as MP3 for a maximum of 30 days. When files reach the 30-day mark or storage limits, the oldest recordings are automatically purged (FIFO) to ensure optimal operation.'}
                </p>
              </div>

              {/* Form Controls */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">
                      {isPersian ? 'دوره نگهداری مکالمات (حداکثر ۳۰ روز)' : 'Retention Period (Max 30 Days)'}
                    </label>
                    <span className="font-mono text-xs font-bold text-amber-400">
                      {settings.retentionDays} {isPersian ? 'روز (یک ماه)' : 'days (1 month)'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={30}
                    value={settings.retentionDays}
                    onChange={(e) => setSettings({ ...settings, retentionDays: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                    <span>۱ روز</span>
                    <span>۷ روز</span>
                    <span>۱۵ روز</span>
                    <span className="text-amber-400 font-semibold">۳۰ روز (حداکثر یک ماه)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {isPersian ? 'حداکثر سهمیه حافظه مجاز (مگابایت)' : 'Storage Quota Limit (MB)'}
                    </label>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      value={settings.maxStorageMB}
                      onChange={(e) => setSettings({ ...settings, maxStorageMB: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isPersian
                        ? 'در صورت پر شدن این سقف، قدیمی‌ترین تماس‌ها پاک می‌شوند'
                        : 'If reached, oldest calls are purged first'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      {isPersian ? 'حداکثر تعداد مجاز مکالمات' : 'Max Recordings Limit'}
                    </label>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={settings.maxRecordingsCount}
                      onChange={(e) => setSettings({ ...settings, maxRecordingsCount: Number(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500/50"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isPersian ? 'سقف فایل‌های همزمان نگهداری شده' : 'Max concurrent call files retained'}
                    </p>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2 pt-2">
                  <label className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.autoPurgeEnabled}
                      onChange={(e) => setSettings({ ...settings, autoPurgeEnabled: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <div>
                      <div className="text-xs font-medium text-slate-200">
                        {isPersian ? 'فعال بودن پاک‌سازی خودکار در هر بار ورود و ضبط' : 'Enable Automatic Purge on Load & Record'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isPersian
                          ? 'بررسی تاریخ انقضا و سهمیه به شکل خودکار در پس‌زمینه'
                          : 'Checks 30-day limits and storage capacity automatically'}
                      </div>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 bg-slate-950/40 rounded-xl border border-slate-800/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.exemptProtectedCalls}
                      onChange={(e) => setSettings({ ...settings, exemptProtectedCalls: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded"
                    />
                    <div>
                      <div className="text-xs font-medium text-slate-200">
                        {isPersian ? 'معافیت مکالمات سنجاق‌شده / محافظت‌شده' : 'Exempt Pinned & Protected Calls from Auto-Purge'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isPersian
                          ? 'تماس‌هایی که آیکون سنجاق دارند هرگز به شکل خودکار پاک نخواهند شد'
                          : 'Calls with the pin icon will never be deleted automatically'}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Purge Result Notification */}
                {purgeResult && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl flex items-center gap-3 text-emerald-300 text-xs">
                    <CheckCircle className="w-4 h-4 shrink-0" />
                    <span>{purgeResult}</span>
                  </div>
                )}

                {/* Manual Purge Trigger */}
                <div className="pt-2 flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">
                      {isPersian ? 'بررسی و اجرای دستی پاک‌سازی' : 'Manual Cleanup Trigger'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isPersian
                        ? 'بررسی فوریت فایل‌های بالای ۳۰ روز و صف FIFO'
                        : 'Immediate scan of >30 days files and FIFO prune'}
                    </div>
                  </div>
                  <button
                    onClick={handleRunPurgeNow}
                    disabled={isPurging}
                    className="flex items-center gap-2 px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isPurging
                      ? (isPersian ? 'در حال پاک‌سازی...' : 'Purging...')
                      : (isPersian ? 'اجرای پاک‌سازی هم‌اکنون' : 'Run Purge Now')}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Logs Tab */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {isPersian
                    ? 'تاریخچه فایل‌هایی که به صورت خودکار یا دستی از انتهای صف پاک شده‌اند'
                    : 'History of call recordings automatically pruned'}
                </span>
                {purgeLogs.length > 0 && (
                  <button
                    onClick={handleClearLogs}
                    className="text-[11px] text-red-400 hover:text-red-300 transition-colors"
                  >
                    {isPersian ? 'پاک کردن تاریخچه' : 'Clear Log History'}
                  </button>
                )}
              </div>

              {purgeLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs">
                  {isPersian
                    ? 'هنوز هیچ فایلی پاک‌سازی نشده است. کلیه فایل‌ها در بازه ۳۰ روزه امن هستند.'
                    : 'No files purged yet. All recordings are within safe retention window.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {purgeLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="font-medium text-slate-200">{log.contactName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {log.phoneNumber} · {formatCallDate(log.callDate, isPersian)}
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded ${
                          log.reason === 'expired_30_days'
                            ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                            : log.reason === 'fifo_storage_limit'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.reason === 'expired_30_days'
                            ? (isPersian ? 'انقضای ۳۰ روز' : '30-Day Expired')
                            : log.reason === 'fifo_storage_limit'
                            ? (isPersian ? 'حذف صف FIFO' : 'FIFO Purge')
                            : (isPersian ? 'دستی' : 'Manual')}
                        </span>
                        <div className="text-[11px] font-mono text-emerald-400">
                          +{formatBytes(log.freedBytes)} {isPersian ? 'آزاد شد' : 'freed'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            {isPersian ? 'بستن' : 'Close'}
          </button>
          {activeTab === 'policy' && (
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors shadow-sm"
            >
              {isPersian ? 'ذخیره تنظیمات' : 'Save Settings'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
