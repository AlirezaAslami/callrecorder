import { convertAudioToMp3, generateSyntheticCallTone } from './mp3Encoder';
import { saveRecording, getAllRecordings } from './storageService';

const SEED_FLAG_KEY = 'sadagir_initial_seed_completed_v1';

export async function checkAndSeedInitialData(): Promise<void> {
  const isSeeded = localStorage.getItem(SEED_FLAG_KEY);
  if (isSeeded) return;

  const existing = await getAllRecordings();
  if (existing.length > 0) {
    localStorage.setItem(SEED_FLAG_KEY, 'true');
    return;
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  // Generate a short tone audio buffer for seed items
  const toneBuffer = generateSyntheticCallTone(4);
  const sampleMp3Blob = await convertAudioToMp3(toneBuffer, { bitrate: 128 });

  const initialItems = [
    {
      id: `rec_${now - 2 * dayMs}_01`,
      contactName: 'مهندس احمدی (پروژه البرز)',
      phoneNumber: '09123456789',
      direction: 'incoming' as const,
      timestamp: now - 2 * dayMs, // 2 days ago -> 28 days remaining
      duration: 184, // 3m 04s
      sizeBytes: sampleMp3Blob.size + 145000,
      bitrate: 128,
      mp3Blob: sampleMp3Blob,
      isProtected: false,
      notes: 'هماهنگی پرداخت صورت‌حساب مرحله دوم و تحویل مستندات سرور',
      tags: ['کاری', 'مالی', 'پروژه'],
    },
    {
      id: `rec_${now - 9 * dayMs}_02`,
      contactName: 'دفترخانه اسناد رسمی ۱۰۲',
      phoneNumber: '02188776655',
      direction: 'outgoing' as const,
      timestamp: now - 9 * dayMs, // 9 days ago -> 21 days remaining
      duration: 95, // 1m 35s
      sizeBytes: sampleMp3Blob.size + 78000,
      bitrate: 128,
      mp3Blob: sampleMp3Blob,
      isProtected: true, // Marked as protected / pinned
      notes: 'شماره سند وکالت‌نامه و مدارک هویتی ثبت شد - مهم',
      tags: ['قرارداد', 'حقوقی'],
    },
    {
      id: `rec_${now - 16 * dayMs}_03`,
      contactName: 'پشتیبانی فنی آسیاتک',
      phoneNumber: '1544',
      direction: 'outgoing' as const,
      timestamp: now - 16 * dayMs, // 16 days ago -> 14 days remaining
      duration: 310, // 5m 10s
      sizeBytes: sampleMp3Blob.size + 245000,
      bitrate: 128,
      mp3Blob: sampleMp3Blob,
      isProtected: false,
      notes: 'پیگیری پینگ تایم سرور و رفع قطعی فیبر نوری دفتر',
      tags: ['پشتیبانی', 'اینترنت'],
    },
    {
      id: `rec_${now - 27 * dayMs}_04`,
      contactName: 'املاک پایتخت (آقای کریمی)',
      phoneNumber: '09351112233',
      direction: 'incoming' as const,
      timestamp: now - 27 * dayMs, // 27 days ago -> 3 days remaining before 30-day auto-purge!
      duration: 142, // 2m 22s
      sizeBytes: sampleMp3Blob.size + 112000,
      bitrate: 128,
      mp3Blob: sampleMp3Blob,
      isProtected: false,
      notes: 'پیشنهاد تمدید قرارداد اجاره سالانه واحد اداری',
      tags: ['ملک', 'اجاره'],
    },
    {
      id: `rec_${now - 29 * dayMs}_05`,
      contactName: 'سفارشات فروشگاه تهران ابزار',
      phoneNumber: '02166554433',
      direction: 'incoming' as const,
      timestamp: now - 29 * dayMs, // 29 days ago -> 1 day remaining!
      duration: 68, // 1m 08s
      sizeBytes: sampleMp3Blob.size + 52000,
      bitrate: 128,
      mp3Blob: sampleMp3Blob,
      isProtected: false,
      notes: 'تأییدیه بارنامه تجهیزات صنعتی',
      tags: ['خرید', 'تأمین'],
    },
  ];

  for (const item of initialItems) {
    await saveRecording(item);
  }

  localStorage.setItem(SEED_FLAG_KEY, 'true');
}
