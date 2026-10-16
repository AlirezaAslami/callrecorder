/**
 * Formats seconds into mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats bytes into human readable format (KB, MB)
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const val = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${val} ${sizes[i]}`;
}

/**
 * Calculates remaining days/hours until 30-day auto-purge
 */
export function getRetentionStatus(expiresAt: number, timestamp: number, isProtected: boolean): {
  daysLeft: number;
  hoursLeft: number;
  totalDays: number;
  progressPercent: number; // 0 to 100 elapsed
  isExpiringSoon: boolean;
  isExpired: boolean;
  statusLabelFa: string;
  statusLabelEn: string;
  statusColor: 'green' | 'amber' | 'crimson' | 'blue';
} {
  if (isProtected) {
    return {
      daysLeft: 999,
      hoursLeft: 9999,
      totalDays: 30,
      progressPercent: 0,
      isExpiringSoon: false,
      isExpired: false,
      statusLabelFa: 'محافظت‌شده (بدون انقضا)',
      statusLabelEn: 'Protected (No Expiry)',
      statusColor: 'blue',
    };
  }

  const now = Date.now();
  const diffMs = expiresAt - now;
  const totalLifespanMs = expiresAt - timestamp;
  const elapsedMs = Math.max(0, now - timestamp);
  const progressPercent = Math.min(100, Math.max(0, Math.round((elapsedMs / totalLifespanMs) * 100)));

  if (diffMs <= 0) {
    return {
      daysLeft: 0,
      hoursLeft: 0,
      totalDays: 30,
      progressPercent: 100,
      isExpiringSoon: true,
      isExpired: true,
      statusLabelFa: 'منقضی شده (در صف پاک‌سازی)',
      statusLabelEn: 'Expired (In purge queue)',
      statusColor: 'crimson',
    };
  }

  const daysLeft = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

  const isExpiringSoon = daysLeft <= 3;

  let statusLabelFa = `${daysLeft} روز باقی‌مانده`;
  let statusLabelEn = `${daysLeft} days left`;
  if (daysLeft === 0) {
    statusLabelFa = `${hoursLeft} ساعت تا پاک‌سازی`;
    statusLabelEn = `${hoursLeft} hours to purge`;
  }

  let statusColor: 'green' | 'amber' | 'crimson' | 'blue' = 'green';
  if (daysLeft <= 1) {
    statusColor = 'crimson';
  } else if (daysLeft <= 5) {
    statusColor = 'amber';
  }

  return {
    daysLeft,
    hoursLeft,
    totalDays: 30,
    progressPercent,
    isExpiringSoon,
    isExpired: false,
    statusLabelFa,
    statusLabelEn,
    statusColor,
  };
}

/**
 * Format timestamp into Persian or Gregorian date
 */
export function formatCallDate(timestamp: number, isPersian: boolean = true): string {
  const date = new Date(timestamp);
  if (isPersian) {
    try {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return date.toLocaleDateString();
    }
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}
