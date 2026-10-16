import React from 'react';
import { PhoneCall, Clock, HardDrive, AlertTriangle, ShieldCheck } from 'lucide-react';
import { formatBytes, formatDuration } from '../utils/formatters';

interface StorageKPIBarProps {
  stats: {
    totalCount: number;
    totalBytes: number;
    totalDurationSeconds: number;
    expiringIn3DaysCount: number;
    protectedCount: number;
    storageUsagePercent: number;
  };
  retentionDays: number;
  onOpenSettings: () => void;
  isPersian: boolean;
}

export const StorageKPIBar: React.FC<StorageKPIBarProps> = ({
  stats,
  retentionDays,
  onOpenSettings,
  isPersian,
}) => {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 w-full"
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      {/* 1. Total Calls */}
      <div className="p-2.5 sm:p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1 overflow-hidden">
        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
          <span className="truncate">{isPersian ? 'تماس‌های ذخیره‌شده' : 'Total Calls'}</span>
          <PhoneCall className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg sm:text-xl font-bold font-mono text-slate-100 tabular-nums">
            {stats.totalCount}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-500 font-mono truncate">
            ({formatDuration(stats.totalDurationSeconds)})
          </span>
        </div>
      </div>

      {/* 2. Retention Policy */}
      <div
        onClick={onOpenSettings}
        className="p-2.5 sm:p-3.5 bg-slate-900/70 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl space-y-1 cursor-pointer transition-colors overflow-hidden"
      >
        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
          <span className="truncate">{isPersian ? 'چرخه نگهداری' : 'Retention'}</span>
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-lg sm:text-xl font-bold font-mono text-amber-400 tabular-nums">
            {retentionDays} {isPersian ? 'روز' : 'd'}
          </span>
          <span className="text-[10px] sm:text-xs text-emerald-400 font-medium truncate">
            {isPersian ? 'حداکثر ۱ ماه' : 'Max 1M'}
          </span>
        </div>
      </div>

      {/* 3. Storage Usage & FIFO */}
      <div className="p-2.5 sm:p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1 overflow-hidden">
        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
          <span className="truncate">{isPersian ? 'حافظه (MP3)' : 'Storage (MP3)'}</span>
          <HardDrive className="w-3.5 h-3.5 text-slate-500 shrink-0" />
        </div>
        <div className="flex items-baseline justify-between gap-1 flex-wrap">
          <span className="text-lg sm:text-xl font-bold font-mono text-slate-100 tabular-nums">
            {formatBytes(stats.totalBytes)}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            {isPersian ? 'FIFO' : 'FIFO'}
          </span>
        </div>
      </div>

      {/* 4. Expiring Soon (<3 days) */}
      <div className="p-2.5 sm:p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl space-y-1 overflow-hidden">
        <div className="flex items-center justify-between text-[11px] sm:text-xs text-slate-400">
          <span className="truncate">{isPersian ? 'نزدیک انقضا (<۳ روز)' : 'Expiring (<3d)'}</span>
          {stats.expiringIn3DaysCount > 0 ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-400 animate-pulse shrink-0" />
          ) : (
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          )}
        </div>
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span
            className={`text-lg sm:text-xl font-bold font-mono tabular-nums ${
              stats.expiringIn3DaysCount > 0 ? 'text-red-400' : 'text-slate-100'
            }`}
          >
            {stats.expiringIn3DaysCount}
          </span>
          <span className="text-[10px] sm:text-xs text-slate-500 font-mono truncate">
            {isPersian
              ? stats.expiringIn3DaysCount > 0
                ? 'فایل در صف'
                : 'همه امن'
              : stats.expiringIn3DaysCount > 0
              ? 'queued'
              : 'safe'}
          </span>
        </div>
      </div>
    </div>
  );
};
