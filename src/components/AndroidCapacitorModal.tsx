import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  Play,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  Square,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  Layers,
  BatteryCharging,
  X,
  Volume2
} from 'lucide-react';
import {
  capacitorCallService,
  loadAndroidConfig,
  saveAndroidConfig,
  AndroidAutoRecordConfig,
  NativeCallStateEvent
} from '../services/capacitorCallRecorder';
import { formatDuration } from '../utils/formatters';

interface AndroidCapacitorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCallRecorded: () => void;
  isPersian: boolean;
}

export const AndroidCapacitorModal: React.FC<AndroidCapacitorModalProps> = ({
  isOpen,
  onClose,
  onCallRecorded,
  isPersian,
}) => {
  const [config, setConfig] = useState<AndroidAutoRecordConfig>(loadAndroidConfig());
  const [activeTab, setActiveTab] = useState<'service' | 'test' | 'build'>('service');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Live call simulation state
  const [callState, setCallState] = useState<'IDLE' | 'RINGING' | 'OFFHOOK'>('IDLE');
  const [simPhone, setSimPhone] = useState('09123456789');
  const [simName, setSimName] = useState('مهندس رضایی');
  const [simDuration, setSimDuration] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setConfig(loadAndroidConfig());
    }

    const unsubState = capacitorCallService.onCallStateChanged((event: NativeCallStateEvent) => {
      setCallState(event.state);
      if (event.state === 'IDLE') {
        setSimDuration(0);
      }
    });

    return () => {
      unsubState();
    };
  }, [isOpen]);

  // Duration timer when call is offhook (recording)
  useEffect(() => {
    let interval: number | null = null;
    if (callState === 'OFFHOOK') {
      setSimDuration(0);
      interval = window.setInterval(() => {
        setSimDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (interval) clearInterval(interval);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof AndroidAutoRecordConfig) => {
    const updated = { ...config, [key]: !config[key] };
    setConfig(updated);
    saveAndroidConfig(updated);
  };

  const handleSimulateIncoming = async () => {
    await capacitorCallService.simulateTriggerIncomingCall(simPhone, simName);
  };

  const handleSimulateAnswer = async () => {
    await capacitorCallService.simulateAnswerCall();
  };

  const handleSimulateHangup = async () => {
    await capacitorCallService.simulateEndCall();
    onCallRecorded();
  };

  const handleSimulateOutgoing = async () => {
    await capacitorCallService.simulateOutgoingCall('09359876543', 'پشتیبانی اداری');
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const buildSteps = [
    {
      titleFa: '۱. خروجی گرفتن از پروژه وب (Vite Build)',
      titleEn: '1. Build web distribution assets',
      command: 'npm run build',
    },
    {
      titleFa: '۲. افزودن پلتفرم بومی اندروید (در صورت اولین بار)',
      titleEn: '2. Add native Android platform',
      command: 'npx cap add android',
    },
    {
      titleFa: '۳. همگام‌سازی کدهای React و سرویس پس‌زمینه با پوشه android',
      titleEn: '3. Sync web assets & native plugin code',
      command: 'npx cap sync',
    },
    {
      titleFa: '۴. باز کردن پروژه در Android Studio جهت بیلد فایل APK/AAB',
      titleEn: '4. Open native project in Android Studio',
      command: 'npx cap open android',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-2xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        dir={isPersian ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
              <Smartphone className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                {isPersian
                  ? 'ضبط خودکار پس‌زمینه اندروید'
                  : 'Android Background Call Recording'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isPersian
                  ? 'شروع ضبط با پاسخ و پایان با قطع تماس'
                  : 'Auto-record on answer / stop on hangup'}
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

        {/* Tab Switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 sm:p-1.5 gap-1 sm:gap-1.5">
          <button
            onClick={() => setActiveTab('service')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'service'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'تنظیمات سرویس' : 'Service'}</span>
          </button>
          <button
            onClick={() => setActiveTab('test')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'test'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'تست زنده تماس' : 'Live Test'}</span>
          </button>
          <button
            onClick={() => setActiveTab('build')}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'build'
                ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'بیلد APK' : 'APK Build'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {activeTab === 'service' && (
            <div className="space-y-4">
              {/* Foreground Service Live Banner */}
              <div className="p-4 bg-emerald-950/30 border border-emerald-800/50 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-xs font-semibold text-emerald-300">
                      {isPersian
                        ? 'سرویس پس‌زمینه آماده‌به‌کار (Foreground Service) فعال است'
                        : 'Foreground Service Active & Listening'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400 bg-emerald-900/40 px-2 py-0.5 rounded border border-emerald-700/40">
                    STATUS: READY
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {isPersian
                    ? 'به لطف سرویس بومی Foreground Service که در AndroidManifest تعریف شده، سیستم‌عامل اندروید برنامه را در پس‌زمینه زنده نگه می‌دارد. به محض فشرده شدن دکمه پاسخ به تماس (Answer)، ضبط تماس به شکل خودکار شروع و با پایان تماس متوقف و به MP3 ذخیره می‌شود.'
                    : 'The Android Foreground Service and BroadcastReceiver monitor incoming and outgoing calls 24/7 without being closed by the system.'}
                </p>

                {/* Simulated Android Notification Drawer */}
                <div className="mt-2 p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-semibold text-slate-200">صداگیر · SadaGir</div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {callState === 'OFFHOOK'
                        ? '🔴 در حال ضبط مکالمه فعال (تبدیل به MP3)...'
                        : 'سرویس آماده‌به‌کار ضبط خودکار تماس فعال است (نگهداری ۳۰ روزه)'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2.5">
                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-200">
                      {isPersian
                        ? 'ضبط خودکار تماس‌های ورودی (Answer -> Record)'
                        : 'Auto-record incoming calls on answer'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isPersian
                        ? 'با برداشتن گوشی و زدن دکمه پاسخ، مکالمه بدون دخالت دست ضبط می‌شود'
                        : 'Starts recording automatically when you answer'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.recordIncoming}
                    onChange={() => handleToggle('recordIncoming')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-200">
                      {isPersian
                        ? 'ضبط خودکار تماس‌های خروجی (Dial -> Record)'
                        : 'Auto-record outgoing calls on connect'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isPersian
                        ? 'هنگامی که خودتان شماره‌گیری می‌کنید، تماس بلافاصله ضبط می‌شود'
                        : 'Starts recording when you call someone'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.recordOutgoing}
                    onChange={() => handleToggle('recordOutgoing')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-200">
                      {isPersian
                        ? 'اجرای خودکار پس از روشن شدن گوشی (RECEIVE_BOOT_COMPLETED)'
                        : 'Auto-start service on device reboot'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isPersian
                        ? 'سرویس حتی پس از ری‌استارت گوشی به صورت خودکار فعال باقی می‌ماند'
                        : 'Restarts service automatically after device boots'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.backgroundServiceEnabled}
                    onChange={() => handleToggle('backgroundServiceEnabled')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-slate-200">
                      {isPersian
                        ? 'معافیت از محدودیت باتری (Ignore Battery Optimization)'
                        : 'Exempt from battery optimization killers'}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {isPersian
                        ? 'جلوگیری از بستن برنامه توسط مدیریت باتری گوشی‌های شیائومی، سامسونگ و هواوی'
                        : 'Prevents OEM battery killers from terminating the recorder'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.batteryOptimizationExempt}
                    onChange={() => handleToggle('batteryOptimizationExempt')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Tab 2: Live Call Flow Test */}
          {activeTab === 'test' && (
            <div className="space-y-4">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300">
                {isPersian
                  ? 'شما می‌توانید دقیقاً همان چرخه‌ای که خواستید (زنگ خوردن -> پاسخ دادن -> شروع خودکار ضبط -> قطع تماس -> ایجاد فایل MP3 و ذخیره در صف ۳۰ روزه) را هم‌اکنون تست کنید:'
                  : 'Test the exact flow: Ring -> Answer -> Auto Record -> Hangup -> MP3 generated and stored in 30-day FIFO.'}
              </div>

              {/* Call Simulation State Display */}
              <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 text-center space-y-4">
                {callState === 'IDLE' && (
                  <div className="space-y-3">
                    <div className="w-12 h-12 mx-auto rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-200">
                        {isPersian ? 'گوشی در حالت آماده‌به‌کار (Standby)' : 'Standby / Idle'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {isPersian ? 'سرویس پس‌زمینه منتظر رویداد تماس است' : 'Waiting for call event'}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto pt-2">
                      <button
                        onClick={handleSimulateIncoming}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-md transition-all active:scale-95"
                      >
                        <PhoneIncoming className="w-4 h-4" />
                        {isPersian ? 'تماس ورودی (کسی زنگ زد)' : 'Incoming Call'}
                      </button>
                      <button
                        onClick={handleSimulateOutgoing}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-xl shadow-md transition-all active:scale-95"
                      >
                        <PhoneOutgoing className="w-4 h-4" />
                        {isPersian ? 'تماس خروجی (خودم زنگ زدم)' : 'Outgoing Call'}
                      </button>
                    </div>
                  </div>
                )}

                {callState === 'RINGING' && (
                  <div className="space-y-4 py-2">
                    <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center animate-bounce">
                      <PhoneIncoming className="w-7 h-7" />
                    </div>
                    <div>
                      <div className="text-xs text-emerald-400 font-semibold tracking-wider">
                        {isPersian ? 'تماس ورودی در حال زنگ خوردن...' : 'INCOMING CALL RINGING...'}
                      </div>
                      <div className="text-base font-bold text-slate-100 mt-1">{simName}</div>
                      <div className="text-xs font-mono text-slate-400">{simPhone}</div>
                    </div>

                    <div className="flex items-center justify-center gap-4 pt-2">
                      <button
                        onClick={handleSimulateAnswer}
                        className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        <PhoneCall className="w-4 h-4" />
                        {isPersian ? 'زدن دکمه و شروع پاسخ (شروع خودکار ضبط)' : 'Answer (Auto Starts Recording)'}
                      </button>
                      <button
                        onClick={handleSimulateHangup}
                        className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl"
                      >
                        {isPersian ? 'رد تماس' : 'Reject'}
                      </button>
                    </div>
                  </div>
                )}

                {callState === 'OFFHOOK' && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span>{isPersian ? 'مکالمه برقرار شد - ضبط در پس‌زمینه فعال است' : 'Call Connected - Recording in Background'}</span>
                    </div>

                    <div className="text-2xl font-bold font-mono text-amber-400 tabular-nums">
                      {formatDuration(simDuration)}
                    </div>

                    <div className="text-xs text-slate-300">
                      <span>{isPersian ? 'در حال مکالمه و ذخیره‌سازی همزمان MP3' : 'Live conversation streaming to MP3...'}</span>
                    </div>

                    <div className="pt-2">
                      <button
                        onClick={handleSimulateHangup}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold text-xs rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95 mx-auto"
                      >
                        <Square className="w-4 h-4" />
                        {isPersian ? 'قطع تماس (پایان مکالمه و ذخیره خودکار MP3)' : 'Hang Up & Save MP3'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Android APK Build Guide */}
          {activeTab === 'build' && (
            <div className="space-y-4">
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Terminal className="w-4 h-4" />
                  <span>{isPersian ? 'پیکربندی کامل Capacitor JS انجام شد' : 'Capacitor JS Configured'}</span>
                </div>
                <p className="text-slate-300 leading-relaxed text-[11px]">
                  {isPersian
                    ? 'فایل‌های `capacitor.config.ts`، `AndroidManifest.xml` (شامل کلیه مجوزهای پس‌زمینه)، `CallStateReceiver.java` و `CallRecordingService.java` در پروژه ایجاد شده‌اند. شما می‌توانید با دستورات زیر پروژه را در Android Studio باز کرده و بیلد APK بگیرید:'
                    : 'The Capacitor configuration, Android Manifest, Background Call Receiver and Foreground Service are fully generated in the project.'}
                </p>
              </div>

              {/* Step by step commands */}
              <div className="space-y-2.5">
                {buildSteps.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2"
                  >
                    <div className="text-xs font-semibold text-slate-200">
                      {isPersian ? step.titleFa : step.titleEn}
                    </div>
                    <div className="flex items-center justify-between bg-slate-900 px-3 py-2 rounded-lg border border-slate-800/80 font-mono text-xs text-amber-400">
                      <code>{step.command}</code>
                      <button
                        onClick={() => copyToClipboard(step.command, idx)}
                        className="p-1 hover:text-slate-200 text-slate-400 transition-colors"
                        title="Copy command"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Xiaomi / Samsung OEM Note */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-[11px] text-slate-400 space-y-1">
                <div className="text-slate-200 font-medium">
                  {isPersian ? 'نکته مهم برای گوشی‌های شیائومی و سامسونگ (Android 10+):' : 'Notice for Xiaomi & Samsung:'}
                </div>
                <p>
                  {isPersian
                    ? 'در اندروید ۱۰ به بالا، به دلیل سیاست‌های گوگل، برای عملکرد بدون قطعی در پس‌زمینه، در تنظیمات گوشی بخش "App Info" حتماً گزینه Autostart (شروع خودکار) را روشن کرده و Battery Saver را روی "No Restrictions" قرار دهید.'
                    : 'On Android 10+, enable Autostart and set Battery Saver to "No Restrictions" in your phone App Info settings.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors shadow-sm"
          >
            {isPersian ? 'تأیید و بازگشت' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
};
