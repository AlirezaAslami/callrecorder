import React, { useState, useEffect, useMemo } from 'react';
import {
  PhoneCall,
  Mic,
  Settings,
  Search,
  Filter,
  Download,
  Trash2,
  Clock,
  HardDrive,
  Shield,
  AlertTriangle,
  ArrowUpDown,
  Calendar,
  Languages,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  PhoneIncoming,
  PhoneOutgoing
} from 'lucide-react';
import {
  CallRecording,
  getAllRecordings,
  deleteRecording,
  toggleProtectRecording,
  updateRecordingMeta,
  getStorageStats,
  loadSettings,
  performAutoPurge,
  DEFAULT_SETTINGS
} from './services/storageService';
import { checkAndSeedInitialData } from './services/sampleDataLoader';
import { CallRecorderModal } from './components/CallRecorderModal';
import { AudioPlayerBar } from './components/AudioPlayerBar';
import { RetentionSettingsModal } from './components/RetentionSettingsModal';
import { CallCard } from './components/CallCard';
import { StorageKPIBar } from './components/StorageKPIBar';
import { AndroidCapacitorModal } from './components/AndroidCapacitorModal';
import { capacitorCallService } from './services/capacitorCallRecorder';
import { Smartphone } from 'lucide-react';

type FilterType = 'all' | 'incoming' | 'outgoing' | 'protected' | 'expiring_soon';
type SortType = 'newest' | 'oldest' | 'expiring_soonest' | 'duration' | 'size';

export default function App() {
  const [isPersian, setIsPersian] = useState<boolean>(true);
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [stats, setStats] = useState({
    totalCount: 0,
    totalBytes: 0,
    totalDurationSeconds: 0,
    expiringIn3DaysCount: 0,
    protectedCount: 0,
    storageUsagePercent: 0,
  });

  // Active playing recording
  const [currentPlaying, setCurrentPlaying] = useState<CallRecording | null>(null);

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isAndroidModalOpen, setIsAndroidModalOpen] = useState(false);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('newest');

  // Auto-purge notice toast
  const [autoPurgeNotice, setAutoPurgeNotice] = useState<string | null>(null);

  useEffect(() => {
    initApp();

    const unsubCallSaved = capacitorCallService.onCallSaved((newCall) => {
      refreshData();
      setCurrentPlaying(newCall);
      setAutoPurgeNotice(
        isPersian
          ? `مکالمه با ${newCall.contactName} به صورت خودکار ضبط و به عنوان MP3 ذخیره شد.`
          : `Call with ${newCall.contactName} automatically recorded & saved as MP3.`
      );
      setTimeout(() => setAutoPurgeNotice(null), 5000);
    });

    return () => {
      unsubCallSaved();
    };
  }, [isPersian]);

  const initApp = async () => {
    setIsLoading(true);
    try {
      // 1. Seed sample calls if first run
      await checkAndSeedInitialData();

      // 2. Perform 30-day & FIFO auto-purge check
      const purgeResult = await performAutoPurge();
      if (purgeResult.purged30DaysCount > 0 || purgeResult.purgedFifoCount > 0) {
        setAutoPurgeNotice(
          isPersian
            ? `پاک‌سازی خودکار: ${purgeResult.purged30DaysCount + purgeResult.purgedFifoCount} فایل قدیمی طبق سیاست نگهداری پاک شدند.`
            : `Auto-purge: ${purgeResult.purged30DaysCount + purgeResult.purgedFifoCount} old files purged.`
        );
        setTimeout(() => setAutoPurgeNotice(null), 6000);
      }

      // 3. Load recordings and stats
      await refreshData();
    } catch (e) {
      console.error('Failed to initialize app:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshData = async () => {
    const list = await getAllRecordings();
    const st = await getStorageStats();
    setRecordings(list);
    setStats(st);
  };

  const handlePlayRecording = (rec: CallRecording) => {
    if (currentPlaying?.id === rec.id) {
      setCurrentPlaying(null);
    } else {
      setCurrentPlaying(rec);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmMsg = isPersian
      ? 'آیا از حذف این فایل ضبط مکالمه اطمینان دارید؟'
      : 'Are you sure you want to delete this call recording?';
    if (!window.confirm(confirmMsg)) return;

    if (currentPlaying?.id === id) {
      setCurrentPlaying(null);
    }

    await deleteRecording(id, 'manual');
    await refreshData();
  };

  const handleToggleProtect = async (id: string) => {
    await toggleProtectRecording(id);
    await refreshData();
  };

  const handleUpdateNotes = async (id: string, notes: string, contactName: string) => {
    await updateRecordingMeta(id, { notes, contactName });
    await refreshData();
  };

  const handleRecordingSaved = (newRec: CallRecording) => {
    setCurrentPlaying(newRec);
    refreshData();
  };

  // Filter & Sort Logic
  const filteredRecordings = useMemo(() => {
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    let result = recordings.filter((r) => {
      // Search
      const matchesSearch =
        r.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phoneNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.notes && r.notes.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter
      if (activeFilter === 'incoming') return r.direction === 'incoming';
      if (activeFilter === 'outgoing') return r.direction === 'outgoing';
      if (activeFilter === 'protected') return r.isProtected;
      if (activeFilter === 'expiring_soon') {
        return !r.isProtected && r.expiresAt - now > 0 && r.expiresAt - now <= threeDaysMs;
      }
      return true;
    });

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'newest') return b.timestamp - a.timestamp;
      if (sortBy === 'oldest') return a.timestamp - b.timestamp;
      if (sortBy === 'duration') return b.duration - a.duration;
      if (sortBy === 'size') return b.sizeBytes - a.sizeBytes;
      if (sortBy === 'expiring_soonest') {
        if (a.isProtected && !b.isProtected) return 1;
        if (!a.isProtected && b.isProtected) return -1;
        return a.expiresAt - b.expiresAt;
      }
      return 0;
    });

    return result;
  }, [recordings, searchQuery, activeFilter, sortBy]);

  // Export all as MP3s
  const handleBatchDownload = () => {
    if (filteredRecordings.length === 0) return;
    filteredRecordings.forEach((rec, idx) => {
      setTimeout(() => {
        if (!rec.mp3Blob) return;
        const url = URL.createObjectURL(rec.mp3Blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = (rec.contactName || 'call').replace(/[/\\?%*:|"<>]/g, '_');
        const dateStr = new Date(rec.timestamp).toISOString().slice(0, 10);
        a.download = `${cleanName}_${dateStr}.mp3`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 400);
    });
  };

  const settings = loadSettings();

  return (
    <div
      className={`min-h-screen bg-slate-950 text-slate-100 pb-28 font-sans w-full max-w-full overflow-x-clip ${
        isPersian ? 'font-sans' : ''
      }`}
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      {/* Top Bar Contract (1 line brand, nav links, 1 primary action) */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 w-full max-w-full overflow-hidden">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-8 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 sm:gap-4 md:gap-8">
          {/* Brand Wordmark Zone */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div>
              <span className="text-sm sm:text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                {isPersian ? 'صداگیر' : 'SadaGir'}
                <span className="hidden md:inline font-normal text-xs text-slate-400 mr-2 ml-2">
                  · {isPersian ? 'کال رکوردر MP3' : 'Call Recorder'}
                </span>
              </span>
            </div>
          </div>

          {/* Navigation Links (desktop only) */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-slate-400">
            <button
              onClick={() => setActiveFilter('all')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
                activeFilter === 'all' ? 'text-amber-400 font-semibold' : ''
              }`}
            >
              {isPersian ? 'همه مکالمات' : 'All Calls'}
            </button>
            <button
              onClick={() => setActiveFilter('incoming')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
                activeFilter === 'incoming' ? 'text-amber-400 font-semibold' : ''
              }`}
            >
              {isPersian ? 'تماس‌های ورودی' : 'Incoming'}
            </button>
            <button
              onClick={() => setActiveFilter('outgoing')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
                activeFilter === 'outgoing' ? 'text-amber-400 font-semibold' : ''
              }`}
            >
              {isPersian ? 'تماس‌های خروجی' : 'Outgoing'}
            </button>
            <button
              onClick={() => setActiveFilter('expiring_soon')}
              className={`hover:text-slate-100 transition-colors whitespace-nowrap ${
                activeFilter === 'expiring_soon' ? 'text-red-400 font-semibold' : ''
              }`}
            >
              {isPersian ? 'در آستانه پاک‌سازی' : 'Expiring Soon'}
            </button>
          </nav>

          {/* Right Action Zone (fits completely on mobile without protruding) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Language toggle */}
            <button
              onClick={() => setIsPersian(!isPersian)}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs text-slate-300 hover:text-white bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-1 shrink-0"
              title="Toggle Language"
            >
              <Languages className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="hidden sm:inline font-mono">{isPersian ? 'EN' : 'فا'}</span>
            </button>

            {/* Android Capacitor Background Service Button */}
            <button
              onClick={() => setIsAndroidModalOpen(true)}
              className="flex items-center gap-1.5 p-1.5 sm:px-3 sm:py-1.5 text-xs text-emerald-300 bg-emerald-950/50 hover:bg-emerald-900/50 border border-emerald-600/30 rounded-lg transition-colors shrink-0"
              title={isPersian ? 'تنظیمات و تست ضبط خودکار پس‌زمینه اندروید' : 'Android Background Call Recording'}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="hidden sm:inline font-medium">
                {isPersian ? 'اندروید' : 'Android'}
              </span>
            </button>

            {/* Retention Settings Button */}
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors shrink-0"
              title={isPersian ? 'تنظیمات نگهداری ۳۰ روزه و FIFO' : 'Retention Settings'}
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Primary Action CTA */}
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95 whitespace-nowrap shrink-0"
            >
              <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="hidden sm:inline">{isPersian ? 'ضبط مکالمه جدید' : 'Record Call'}</span>
              <span className="sm:hidden">{isPersian ? 'ضبط' : 'Record'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 md:px-8 py-4 sm:py-6 space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        {/* Auto Purge Notice Toast if triggered */}
        {autoPurgeNotice && (
          <div className="p-3 bg-amber-950/40 border border-amber-800/60 rounded-xl flex items-center justify-between text-xs text-amber-300 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{autoPurgeNotice}</span>
            </div>
            <button
              onClick={() => setAutoPurgeNotice(null)}
              className="text-slate-400 hover:text-slate-200"
            >
              ×
            </button>
          </div>
        )}

        {/* Hero & Policy Banner */}
        <div className="p-4 sm:p-6 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/60 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 w-full overflow-hidden">
          <div className="space-y-1.5 max-w-2xl min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 text-amber-400 text-xs font-medium flex-wrap">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{isPersian ? 'سامانه ضبط تماس MP3' : 'Smart MP3 Call Recorder'}</span>
              <span>·</span>
              <span className="text-slate-400">{isPersian ? 'سیاست نگهداری ۳۰ روزه' : 'Max 1 Month Storage'}</span>
            </div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-100 tracking-tight break-words">
              {isPersian
                ? 'مدیریت و ضبط مکالمات تلفنی با پاک‌سازی خودکار ۳۰ روزه'
                : 'Phone Call Recording with 30-Day FIFO Auto-Purge'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed break-words">
              {isPersian
                ? 'فایل‌های تماس به صورت مستقیم به فرمت MP3 تبدیل شده و در سیستم محلی ذخیره می‌شوند. سیستم حداکثر تا یک ماه داده‌ها را نگهداری کرده و فایل‌های قدیمی‌تر به صورت خودکار از انتهای صف (FIFO) پاک خواهند شد.'
                : 'Calls are converted directly to standard MP3 and stored locally. Recordings are kept for up to 30 days, after which the oldest records are automatically pruned from the end of the queue (FIFO).'}
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Mic className="w-4 h-4 shrink-0" />
              <span>{isPersian ? 'شروع ضبط جدید' : 'New Recording'}</span>
            </button>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="flex-1 sm:flex-initial px-3 sm:px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 transition-colors text-center"
            >
              {isPersian ? 'تنظیمات پاک‌سازی' : 'Retention Rules'}
            </button>
          </div>
        </div>

        {/* Android Background Auto-Record Banner */}
        <div className="p-3.5 sm:p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full overflow-hidden">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5 flex-wrap">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">
                  {isPersian
                    ? 'سرویس پس‌زمینه ضبط خودکار تماس اندروید (Capacitor JS)'
                    : 'Android Background Auto-Call Recorder Active'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 break-words">
                {isPersian
                  ? 'وقتی کسی زنگ زد و پاسخ دادید، ضبط خودکار شروع می‌شود و با قطع تماس پایان می‌یابد'
                  : 'Automatically records calls upon answer & saves MP3 on hangup'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              onClick={() => setIsAndroidModalOpen(true)}
              className="w-full sm:w-auto px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-lg transition-all shadow-sm active:scale-95 text-center"
            >
              {isPersian ? 'تست زنده و راهنمای بیلد' : 'Test & Build Guide'}
            </button>
          </div>
        </div>

        {/* Storage & Retention KPI Metrics Strip */}
        <StorageKPIBar
          stats={stats}
          retentionDays={settings.retentionDays}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
          isPersian={isPersian}
        />

        {/* Filter, Search & Batch Actions Bar */}
        <div className="space-y-2.5 w-full">
          {/* Search Box */}
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute top-1/2 -translate-y-1/2 right-3 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isPersian
                  ? 'جستجو بر اساس نام مخاطب، شماره، یادداشت...'
                  : 'Search contact, number, notes...'
              }
              className="w-full pl-3 pr-9 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute top-1/2 -translate-y-1/2 left-3 text-slate-500 hover:text-slate-300 text-xs p-1"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter Tabs - Horizontal Touch Scroll without page expansion */}
          <div className="w-full max-w-full overflow-x-auto no-scrollbar py-1">
            <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl gap-1 text-xs shrink-0 w-max">
              <button
                onClick={() => setActiveFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap ${
                  activeFilter === 'all'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isPersian ? 'همه' : 'All'} ({recordings.length})
              </button>
              <button
                onClick={() => setActiveFilter('incoming')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap ${
                  activeFilter === 'incoming'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isPersian ? 'ورودی' : 'In'}
              </button>
              <button
                onClick={() => setActiveFilter('outgoing')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap ${
                  activeFilter === 'outgoing'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isPersian ? 'خروجی' : 'Out'}
              </button>
              <button
                onClick={() => setActiveFilter('expiring_soon')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap ${
                  activeFilter === 'expiring_soon'
                    ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isPersian ? 'نزدیک انقضا (<۳ روز)' : 'Expiring (<3d)'}
              </button>
              <button
                onClick={() => setActiveFilter('protected')}
                className={`px-3 py-1.5 rounded-lg transition-colors font-medium whitespace-nowrap ${
                  activeFilter === 'protected'
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isPersian ? 'محافظت‌شده' : 'Pinned'}
              </button>
            </div>
          </div>

          {/* Sort Selector & Batch Export */}
          <div className="flex items-center justify-between gap-2 w-full flex-wrap sm:flex-nowrap">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs flex-1 sm:max-w-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer w-full"
              >
                <option value="newest" className="bg-slate-900">
                  {isPersian ? 'جدیدترین تماس' : 'Newest First'}
                </option>
                <option value="oldest" className="bg-slate-900">
                  {isPersian ? 'قدیمی‌ترین تماس (FIFO)' : 'Oldest First'}
                </option>
                <option value="expiring_soonest" className="bg-slate-900">
                  {isPersian ? 'نزدیک‌ترین به پاک‌سازی ۳۰ روزه' : 'Expiring Soonest'}
                </option>
                <option value="duration" className="bg-slate-900">
                  {isPersian ? 'طولانی‌ترین مدت' : 'Longest Duration'}
                </option>
                <option value="size" className="bg-slate-900">
                  {isPersian ? 'بزرگترین حجم فایل' : 'Largest Size'}
                </option>
              </select>
            </div>

            {filteredRecordings.length > 0 && (
              <button
                onClick={handleBatchDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded-xl text-xs transition-colors shrink-0"
                title="Export filtered MP3s"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">{isPersian ? 'دانلود دسته‌جمعی MP3' : 'Export MP3s'}</span>
                <span className="sm:hidden">دانلود MP3</span>
              </button>
            )}
          </div>
        </div>

        {/* Recordings List */}
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-6 h-6 mx-auto text-amber-400 animate-spin" />
            <p className="text-xs text-slate-400">
              {isPersian ? 'در حال بارگذاری فایل‌های ضبط شده...' : 'Loading call recordings...'}
            </p>
          </div>
        ) : filteredRecordings.length === 0 ? (
          <div className="py-16 px-4 text-center rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-slate-800/80 flex items-center justify-center text-slate-400">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-200">
                {searchQuery || activeFilter !== 'all'
                  ? (isPersian ? 'هیچ مکالمه‌ای با این مشخصات یافت نشد' : 'No calls matched your filter')
                  : (isPersian ? 'هنوز هیچ مکالمه‌ای ثبت نشده است' : 'No call recordings yet')}
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isPersian
                  ? 'می‌توانید با میکروفون زنده، شبیه‌ساز تلفن، یا وارد کردن فایل صوتی اولین تماس خود را ذخیره کنید.'
                  : 'Start by recording live microphone audio, dialer simulation, or importing audio files.'}
              </p>
            </div>
            <button
              onClick={() => setIsRecordModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 active:scale-95"
            >
              <Mic className="w-4 h-4" />
              <span>{isPersian ? 'ضبط اولین مکالمه' : 'Record First Call'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredRecordings.map((recording) => (
              <CallCard
                key={recording.id}
                recording={recording}
                isPlaying={currentPlaying?.id === recording.id}
                onPlay={handlePlayRecording}
                onDelete={handleDelete}
                onToggleProtect={handleToggleProtect}
                onUpdateNotes={handleUpdateNotes}
                isPersian={isPersian}
              />
            ))}
          </div>
        )}
      </main>

      {/* Docked Audio Player Bar */}
      <AudioPlayerBar
        recording={currentPlaying}
        onClose={() => setCurrentPlaying(null)}
        isPersian={isPersian}
      />

      {/* Call Recorder Modal */}
      <CallRecorderModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSaved={handleRecordingSaved}
        isPersian={isPersian}
      />

      {/* 30-Day Retention & FIFO Policy Settings Modal */}
      <RetentionSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        onSettingsUpdated={refreshData}
        isPersian={isPersian}
      />

      {/* Android Background & Capacitor Modal */}
      <AndroidCapacitorModal
        isOpen={isAndroidModalOpen}
        onClose={() => setIsAndroidModalOpen(false)}
        onCallRecorded={refreshData}
        isPersian={isPersian}
      />
    </div>
  );
}
