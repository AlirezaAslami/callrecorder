import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Square,
  Pause,
  Play,
  PhoneCall,
  PhoneIncoming,
  PhoneOutgoing,
  X,
  Upload,
  Settings2,
  Sparkles,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { AudioVisualizer } from './AudioVisualizer';
import { convertAudioToMp3, generateSyntheticCallTone } from '../services/mp3Encoder';
import { saveRecording, CallRecording } from '../services/storageService';
import { formatDuration } from '../utils/formatters';

interface CallRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: (recording: CallRecording) => void;
  isPersian: boolean;
}

export const CallRecorderModal: React.FC<CallRecorderModalProps> = ({
  isOpen,
  onClose,
  onSaved,
  isPersian,
}) => {
  const [activeTab, setActiveTab] = useState<'mic' | 'dialer' | 'import'>('mic');
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Form states
  const [contactName, setContactName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [direction, setDirection] = useState<'incoming' | 'outgoing'>('incoming');
  const [bitrate, setBitrate] = useState<number>(128);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>(['تماس']);

  // Encoding & Saving state
  const [isEncoding, setIsEncoding] = useState(false);
  const [encodeProgress, setEncodeProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Media references
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // Dialer simulation states
  const [isDialing, setIsDialing] = useState(false);
  const [dialStep, setDialStep] = useState<'idle' | 'ringing' | 'connected'>('idle');

  useEffect(() => {
    return () => {
      stopAndCleanupMedia();
    };
  }, []);

  if (!isOpen) return null;

  const startLiveRecording = async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // Audio context for visualizer
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder setup
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : undefined,
      });

      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.start(250); // collect chunks every 250ms
      mediaRecorderRef.current = recorder;

      setIsRecording(true);
      setIsPaused(false);
      setElapsedSeconds(0);

      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: unknown) {
      console.error('Microphone access failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        isPersian
          ? `دسترسی به میکروفون امکان‌پذیر نشد (${msg}). لطفاً مجوز دسترسی را تأیید کنید.`
          : `Failed to access microphone (${msg}). Please allow permission.`
      );
    }
  };

  const pauseResumeRecording = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = window.setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    }
  };

  const stopAndSave = async () => {
    if (!mediaRecorderRef.current && audioChunksRef.current.length === 0) return;

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setIsRecording(false);
    setIsPaused(false);
    setIsEncoding(true);
    setEncodeProgress(10);

    const finishSaving = async (rawAudioBlob: Blob, recordedDuration: number) => {
      try {
        setEncodeProgress(30);

        // Convert directly to standard MP3 via lamejs
        const mp3Blob = await convertAudioToMp3(rawAudioBlob, {
          bitrate,
          onProgress: (p) => setEncodeProgress(30 + Math.round(p * 0.6)),
        });

        setEncodeProgress(95);

        const newRecording = await saveRecording({
          id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          contactName: contactName.trim() || (isPersian ? 'تماس نام‌گذاری نشده' : 'Unnamed Call'),
          phoneNumber: phoneNumber.trim() || (direction === 'incoming' ? 'ناشناس' : 'خروجی'),
          direction,
          timestamp: Date.now(),
          duration: recordedDuration || elapsedSeconds || 1,
          sizeBytes: mp3Blob.size,
          bitrate,
          mp3Blob,
          isProtected: false,
          notes: notes.trim(),
          tags: tags.length > 0 ? tags : ['تماس'],
        });

        setEncodeProgress(100);
        setIsEncoding(false);
        stopAndCleanupMedia();
        onSaved(newRecording);
        resetForm();
        onClose();
      } catch (encodeErr: unknown) {
        console.error('MP3 encoding failed:', encodeErr);
        setIsEncoding(false);
        setErrorMessage(
          isPersian
            ? 'خطا در تبدیل فایل صوتی به قالب استاندارد MP3.'
            : 'Error converting recorded audio to standard MP3.'
        );
      }
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await finishSaving(rawBlob, elapsedSeconds);
      };
      mediaRecorderRef.current.stop();
    } else if (audioChunksRef.current.length > 0) {
      const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await finishSaving(rawBlob, elapsedSeconds);
    }
  };

  const stopAndCleanupMedia = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsDialing(false);
    setDialStep('idle');
  };

  const handleSimulateCall = async () => {
    setIsDialing(true);
    setDialStep('ringing');

    // Simulate ringtone for 2.5 seconds then connect
    setTimeout(() => {
      setDialStep('connected');
      startLiveRecording();
    }, 2500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsEncoding(true);
    setEncodeProgress(15);
    setErrorMessage(null);

    try {
      const mp3Blob = await convertAudioToMp3(file, {
        bitrate,
        onProgress: (p) => setEncodeProgress(15 + Math.round(p * 0.8)),
      });

      // estimate duration from AudioContext
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await audioCtx.decodeAudioData(arrayBuffer);
      const estDuration = Math.round(decoded.duration);
      if (audioCtx.state !== 'closed') await audioCtx.close();

      const newRec = await saveRecording({
        id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        contactName: contactName.trim() || file.name.replace(/\.[^/.]+$/, ''),
        phoneNumber: phoneNumber.trim() || 'فایل وارداتی',
        direction,
        timestamp: Date.now(),
        duration: estDuration,
        sizeBytes: mp3Blob.size,
        bitrate,
        mp3Blob,
        isProtected: false,
        notes: notes.trim() || `فایل وارد شده: ${file.name}`,
        tags: [...tags, 'وارد شده'],
      });

      setEncodeProgress(100);
      setIsEncoding(false);
      onSaved(newRec);
      resetForm();
      onClose();
    } catch (err) {
      console.error('File conversion to MP3 failed:', err);
      setIsEncoding(false);
      setErrorMessage(
        isPersian
          ? 'خطا در بارگذاری یا تبدیل فایل به MP3. فرمت فایل نامعتبر است.'
          : 'Failed to import and convert file to MP3.'
      );
    }
  };

  const resetForm = () => {
    setContactName('');
    setPhoneNumber('');
    setNotes('');
    setElapsedSeconds(0);
    setIsRecording(false);
    setIsPaused(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100"
        dir={isPersian ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-semibold text-slate-100 truncate">
                {isPersian ? 'ضبط مکالمه جدید' : 'Record New Call'}
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                {isPersian
                  ? 'خروجی MP3 · نگهداری حداکثر ۳۰ روزه'
                  : 'MP3 Output · 30-Day Auto Retention'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              stopAndCleanupMedia();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-1 sm:p-1.5 gap-1 sm:gap-1.5">
          <button
            onClick={() => !isRecording && setActiveTab('mic')}
            disabled={isRecording}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'mic'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'میکروفون' : 'Mic'}</span>
          </button>
          <button
            onClick={() => !isRecording && setActiveTab('dialer')}
            disabled={isRecording}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'dialer'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <PhoneOutgoing className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'شبیه‌ساز تماس' : 'Simulator'}</span>
          </button>
          <button
            onClick={() => !isRecording && setActiveTab('import')}
            disabled={isRecording}
            className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-1.5 sm:py-2 text-[11px] sm:text-xs font-medium rounded-lg transition-all ${
              activeTab === 'import'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="truncate">{isPersian ? 'تبدیل فایل' : 'Import'}</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl flex items-center gap-3 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form fields: Contact Name, Phone, Direction */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {isPersian ? 'نام مخاطب / عنوان مکالمه' : 'Contact Name / Title'}
              </label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder={isPersian ? 'مثال: مهندس احمدی (پروژه سئول)' : 'e.g. John Doe'}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {isPersian ? 'شماره تماس' : 'Phone Number'}
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder={isPersian ? 'مثال: 09123456789' : '+1 555 0192'}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 font-mono focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {isPersian ? 'نوع تماس' : 'Call Direction'}
              </label>
              <div className="flex rounded-lg bg-slate-950/80 p-1 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setDirection('incoming')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded font-medium transition-colors ${
                    direction === 'incoming'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PhoneIncoming className="w-3.5 h-3.5" />
                  {isPersian ? 'ورودی' : 'Incoming'}
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('outgoing')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs rounded font-medium transition-colors ${
                    direction === 'outgoing'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <PhoneOutgoing className="w-3.5 h-3.5" />
                  {isPersian ? 'خروجی' : 'Outgoing'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {isPersian ? 'کیفیت بیت‌ریت MP3' : 'MP3 Bitrate'}
              </label>
              <select
                value={bitrate}
                onChange={(e) => setBitrate(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value={64}>64 kbps ({isPersian ? 'فوق فشرده - صدای مکالمه' : 'Ultra Voice'})</option>
                <option value={128}>128 kbps ({isPersian ? 'استاندارد تماس - شفاف' : 'Standard Call'})</option>
                <option value={192}>192 kbps ({isPersian ? 'کیفیت استودیویی بالا' : 'High Quality'})</option>
              </select>
            </div>
          </div>

          {/* Tab 1: Live Mic / Call Recording */}
          {activeTab === 'mic' && (
            <div className="space-y-4 pt-2">
              {/* Visualizer & Timer Display */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    ) : (
                      <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                    )}
                    <span className="text-xs font-medium text-slate-300">
                      {isRecording
                        ? isPaused
                          ? (isPersian ? 'ضبط موقتاً متوقف شد' : 'Recording Paused')
                          : (isPersian ? 'در حال ضبط زنده مکالمه...' : 'Recording Live Call...')
                        : (isPersian ? 'آماده برای شروع ضبط' : 'Ready to Record')}
                    </span>
                  </div>

                  <span className="font-mono text-lg font-bold text-amber-400 tabular-nums">
                    {formatDuration(elapsedSeconds)}
                  </span>
                </div>

                <AudioVisualizer
                  analyser={analyserRef.current}
                  isRecording={isRecording && !isPaused}
                  barColor="#f59e0b"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-2">
                {!isRecording ? (
                  <button
                    onClick={startLiveRecording}
                    className="flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-sm rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95"
                  >
                    <Mic className="w-4 h-4" />
                    {isPersian ? 'شروع ضبط مکالمه' : 'Start Call Recording'}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={pauseResumeRecording}
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors border border-slate-700"
                    >
                      {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                      {isPaused
                        ? (isPersian ? 'ادامه ضبط' : 'Resume')
                        : (isPersian ? 'مکث' : 'Pause')}
                    </button>
                    <button
                      onClick={stopAndSave}
                      className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-red-600/20 active:scale-95"
                    >
                      <Square className="w-4 h-4" />
                      {isPersian ? 'پایان و ذخیره به عنوان MP3' : 'Stop & Save MP3'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Dialer Simulation */}
          {activeTab === 'dialer' && (
            <div className="space-y-4 pt-2">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-center space-y-3">
                <p className="text-xs text-slate-400">
                  {isPersian
                    ? 'شبیه‌سازی تماس خروجی واقعی با پخش بوق آزاد، اتصال به میکروفون و کدگذاری مستقیم MP3'
                    : 'Simulate full realistic outbound call with ringback tone, live mic connection and MP3 encoding.'}
                </p>

                {dialStep === 'idle' && (
                  <button
                    onClick={handleSimulateCall}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-emerald-600/20"
                  >
                    <PhoneCall className="w-4 h-4" />
                    {isPersian ? 'برقراری و ضبط تماس تلفنی' : 'Dial & Record Call'}
                  </button>
                )}

                {dialStep === 'ringing' && (
                  <div className="py-4 space-y-2">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 animate-ping">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-medium text-emerald-400">
                      {isPersian ? 'در حال برقراری تماس و پخش بوق آزاد...' : 'Dialing & Ringing...'}
                    </p>
                  </div>
                )}

                {dialStep === 'connected' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-emerald-400 font-medium">
                        {isPersian ? 'تماس متصل است (در حال ضبط)' : 'Call Connected (Recording)'}
                      </span>
                      <span className="font-mono text-lg font-bold text-amber-400 tabular-nums">
                        {formatDuration(elapsedSeconds)}
                      </span>
                    </div>

                    <AudioVisualizer
                      analyser={analyserRef.current}
                      isRecording={isRecording && !isPaused}
                      barColor="#10b981"
                    />

                    <div className="flex justify-center gap-3 pt-2">
                      <button
                        onClick={stopAndSave}
                        className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-all shadow-lg shadow-red-600/20"
                      >
                        <Square className="w-4 h-4" />
                        {isPersian ? 'قطع تماس و ذخیره MP3' : 'End Call & Save MP3'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Import & Convert to MP3 */}
          {activeTab === 'import' && (
            <div className="space-y-4 pt-2">
              <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 hover:border-amber-500/50 rounded-xl bg-slate-950/40 hover:bg-slate-950/80 cursor-pointer transition-all">
                <Upload className="w-8 h-8 text-amber-400 mb-2" />
                <span className="text-xs font-medium text-slate-200">
                  {isPersian
                    ? 'انتخاب یا رها کردن فایل صوتی تماس (WAV, WEBM, M4A, OGG)'
                    : 'Select or drop voice call recording file'}
                </span>
                <span className="text-[11px] text-slate-500 mt-1">
                  {isPersian
                    ? 'فایل شما بلافاصله به فرمت استاندارد MP3 تبدیل و در چرخه ۳۰ روزه ذخیره می‌شود'
                    : 'Converted to MP3 and added into the 30-day auto retention vault'}
                </span>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Notes field */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              {isPersian ? 'یادداشت یا خلاصه مکالمه (اختیاری)' : 'Call Notes / Summary (Optional)'}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={
                isPersian
                  ? 'موضوع مکالمه، توافقات انجام شده، شماره پیگیری و...'
                  : 'Call details, agreements, follow-up numbers...'
              }
              className="w-full px-3 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Encoding Progress overlay */}
          {isEncoding && (
            <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-300 font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  {isPersian ? 'در حال تبدیل و کدگذاری فایل MP3...' : 'Encoding standard MP3 file...'}
                </span>
                <span className="font-mono text-amber-400 tabular-nums">{encodeProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                  style={{ width: `${encodeProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
