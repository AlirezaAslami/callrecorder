export interface CallRecording {
  id: string;
  contactName: string;
  phoneNumber: string;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
  duration: number; // in seconds
  sizeBytes: number;
  bitrate: number; // e.g. 128
  mp3Blob: Blob;
  isProtected: boolean;
  notes: string;
  tags: string[];
  expiresAt: number; // timestamp when it will auto-purge
  audioUrl?: string;
}

export interface PurgeLogItem {
  id: string;
  purgedAt: number;
  contactName: string;
  phoneNumber: string;
  callDate: number;
  reason: 'expired_30_days' | 'fifo_storage_limit' | 'manual';
  freedBytes: number;
}

export interface StorageSettings {
  retentionDays: number; // Max 30 days
  maxStorageMB: number; // Max storage limit before FIFO triggers (e.g. 250 MB)
  maxRecordingsCount: number; // e.g. 150
  autoPurgeEnabled: boolean;
  exemptProtectedCalls: boolean;
}

const DB_NAME = 'sadagir_call_recorder_db';
const DB_VERSION = 1;
const STORE_RECORDINGS = 'recordings';
const STORE_PURGE_LOGS = 'purge_logs';
const SETTINGS_KEY = 'sadagir_retention_settings';

export const DEFAULT_SETTINGS: StorageSettings = {
  retentionDays: 30, // حداکثر یک ماه (۳۰ روز)
  maxStorageMB: 300,
  maxRecordingsCount: 100,
  autoPurgeEnabled: true,
  exemptProtectedCalls: true,
};

let dbInstance: IDBDatabase | null = null;

export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_RECORDINGS)) {
        const store = db.createObjectStore(STORE_RECORDINGS, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_PURGE_LOGS)) {
        const logStore = db.createObjectStore(STORE_PURGE_LOGS, { keyPath: 'id' });
        logStore.createIndex('purgedAt', 'purgedAt', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

export function loadSettings(): StorageSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored), retentionDays: Math.min(30, JSON.parse(stored).retentionDays || 30) };
    }
  } catch (e) {
    console.error('Failed to parse settings:', e);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: StorageSettings): void {
  // Enforce max 30 days as requested by user
  const sanitized = {
    ...settings,
    retentionDays: Math.min(30, Math.max(1, settings.retentionDays)),
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(sanitized));
}

/**
 * Saves a new call recording and automatically triggers FIFO & 30-day auto-purge
 */
export async function saveRecording(recording: Omit<CallRecording, 'expiresAt'> & { expiresAt?: number }): Promise<CallRecording> {
  const db = await getDB();
  const settings = loadSettings();

  const retentionDuration = settings.retentionDays * 24 * 60 * 60 * 1000;
  const expiresAt = recording.expiresAt || (recording.timestamp + retentionDuration);

  const fullRecord: CallRecording = {
    ...recording,
    expiresAt,
  };

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.put(fullRecord);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  // Run auto-purge check (FIFO + 30-day rule)
  if (settings.autoPurgeEnabled) {
    await performAutoPurge();
  }

  return fullRecord;
}

/**
 * Gets all call recordings sorted by timestamp descending
 */
export async function getAllRecordings(): Promise<CallRecording[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS], 'readonly');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.getAll();

    req.onsuccess = () => {
      const results: CallRecording[] = req.result || [];
      // Sort newest first
      results.sort((a, b) => b.timestamp - a.timestamp);
      // Attach blob URL for playback
      results.forEach((rec) => {
        if (!rec.audioUrl && rec.mp3Blob) {
          rec.audioUrl = URL.createObjectURL(rec.mp3Blob);
        }
      });
      resolve(results);
    };

    req.onerror = () => reject(req.error);
  });
}

/**
 * Deletes a single recording by ID
 */
export async function deleteRecording(id: string, reason: PurgeLogItem['reason'] = 'manual'): Promise<void> {
  const db = await getDB();
  const rec = await getRecordingById(id);

  if (rec) {
    // Log purge
    await addPurgeLog({
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      purgedAt: Date.now(),
      contactName: rec.contactName,
      phoneNumber: rec.phoneNumber,
      callDate: rec.timestamp,
      reason,
      freedBytes: rec.sizeBytes,
    });
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getRecordingById(id: string): Promise<CallRecording | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS], 'readonly');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function toggleProtectRecording(id: string): Promise<boolean> {
  const db = await getDB();
  const rec = await getRecordingById(id);
  if (!rec) return false;

  const newStatus = !rec.isProtected;
  rec.isProtected = newStatus;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.put(rec);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

  return newStatus;
}

export async function updateRecordingMeta(
  id: string,
  updates: Partial<Pick<CallRecording, 'contactName' | 'phoneNumber' | 'notes' | 'tags'>>
): Promise<void> {
  const db = await getDB();
  const rec = await getRecordingById(id);
  if (!rec) return;

  const updated: CallRecording = {
    ...rec,
    ...updates,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_RECORDINGS], 'readwrite');
    const store = tx.objectStore(STORE_RECORDINGS);
    const req = store.put(updated);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * AUTO PURGE ENGINE:
 * 1. Purges calls older than 30 days (expiresAt <= Date.now())
 * 2. FIFO Auto-Prune: If total storage or item count exceeds quota, removes oldest recordings first ("از آخر پاک کند")
 */
export async function performAutoPurge(): Promise<{
  purged30DaysCount: number;
  purgedFifoCount: number;
  freedBytes: number;
}> {
  const settings = loadSettings();
  const recordings = await getAllRecordings();
  const now = Date.now();

  let purged30DaysCount = 0;
  let purgedFifoCount = 0;
  let totalFreedBytes = 0;

  // Step 1: 30-Day Expiration Check
  const remainingRecordings: CallRecording[] = [];

  for (const rec of recordings) {
    const isExpired = rec.expiresAt <= now;
    const canPurge = !rec.isProtected || !settings.exemptProtectedCalls;

    if (isExpired && canPurge) {
      await deleteRecording(rec.id, 'expired_30_days');
      purged30DaysCount++;
      totalFreedBytes += rec.sizeBytes;
    } else {
      remainingRecordings.push(rec);
    }
  }

  // Step 2: FIFO Auto-Cleanup if capacity exceeded
  // Sort oldest first (FIFO - First In, First Out: "از آخر پاک کند")
  remainingRecordings.sort((a, b) => a.timestamp - b.timestamp);

  const maxBytes = settings.maxStorageMB * 1024 * 1024;
  let currentTotalBytes = remainingRecordings.reduce((sum, r) => sum + r.sizeBytes, 0);
  let currentCount = remainingRecordings.length;

  for (const oldestRec of remainingRecordings) {
    const violatesStorage = currentTotalBytes > maxBytes;
    const violatesCount = currentCount > settings.maxRecordingsCount;

    if ((violatesStorage || violatesCount) && (!oldestRec.isProtected || !settings.exemptProtectedCalls)) {
      await deleteRecording(oldestRec.id, 'fifo_storage_limit');
      purgedFifoCount++;
      totalFreedBytes += oldestRec.sizeBytes;
      currentTotalBytes -= oldestRec.sizeBytes;
      currentCount--;
    }
  }

  return {
    purged30DaysCount,
    purgedFifoCount,
    freedBytes: totalFreedBytes,
  };
}

/**
 * Purge logs tracking
 */
export async function addPurgeLog(log: PurgeLogItem): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PURGE_LOGS], 'readwrite');
    const store = tx.objectStore(STORE_PURGE_LOGS);
    const req = store.put(log);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function getPurgeLogs(): Promise<PurgeLogItem[]> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PURGE_LOGS], 'readonly');
    const store = tx.objectStore(STORE_PURGE_LOGS);
    const req = store.getAll();
    req.onsuccess = () => {
      const logs: PurgeLogItem[] = req.result || [];
      logs.sort((a, b) => b.purgedAt - a.purgedAt);
      resolve(logs.slice(0, 50)); // Last 50 purge records
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearAllPurgeLogs(): Promise<void> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_PURGE_LOGS], 'readwrite');
    const store = tx.objectStore(STORE_PURGE_LOGS);
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/**
 * Get storage statistics
 */
export async function getStorageStats(): Promise<{
  totalCount: number;
  totalBytes: number;
  totalDurationSeconds: number;
  expiringIn3DaysCount: number;
  protectedCount: number;
  storageUsagePercent: number;
}> {
  const recordings = await getAllRecordings();
  const settings = loadSettings();
  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const totalBytes = recordings.reduce((acc, r) => acc + r.sizeBytes, 0);
  const totalDurationSeconds = recordings.reduce((acc, r) => acc + r.duration, 0);
  const protectedCount = recordings.filter((r) => r.isProtected).length;
  const expiringIn3DaysCount = recordings.filter(
    (r) => !r.isProtected && r.expiresAt - now > 0 && r.expiresAt - now <= threeDaysMs
  ).length;

  const maxBytes = settings.maxStorageMB * 1024 * 1024;
  const storageUsagePercent = Math.min(100, Math.round((totalBytes / maxBytes) * 100));

  return {
    totalCount: recordings.length,
    totalBytes,
    totalDurationSeconds,
    expiringIn3DaysCount,
    protectedCount,
    storageUsagePercent,
  };
}
