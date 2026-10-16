import React, { useState } from 'react';
import {
  PhoneIncoming,
  PhoneOutgoing,
  Play,
  Pause,
  Download,
  Trash2,
  Pin,
  PinOff,
  Edit2,
  Check,
  Clock,
  AlertTriangle,
  FileAudio,
  Shield,
  Tag
} from 'lucide-react';
import { CallRecording } from '../services/storageService';
import { formatDuration, formatBytes, formatCallDate, getRetentionStatus } from '../utils/formatters';

interface CallCardProps {
  recording: CallRecording;
  isPlaying: boolean;
  onPlay: (recording: CallRecording) => void;
  onDelete: (id: string) => void;
  onToggleProtect: (id: string) => void;
  onUpdateNotes: (id: string, notes: string, contactName: string) => void;
  isPersian: boolean;
}

export const CallCard: React.FC<CallCardProps> = ({
  recording,
  isPlaying,
  onPlay,
  onDelete,
  onToggleProtect,
  onUpdateNotes,
  isPersian,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(recording.contactName);
  const [editedNotes, setEditedNotes] = useState(recording.notes || '');

  const retention = getRetentionStatus(recording.expiresAt, recording.timestamp, recording.isProtected);

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!recording.mp3Blob) return;
    const url = URL.createObjectURL(recording.mp3Blob);
    const a = document.createElement('a');
    a.href = url;
    const cleanName = (recording.contactName || 'call')
      .replace(/[/\\?%*:|"<>]/g, '_')
      .substring(0, 30);
    const dateStr = new Date(recording.timestamp).toISOString().slice(0, 10);
    a.download = `${cleanName}_${dateStr}.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateNotes(recording.id, editedNotes, editedName);
    setIsEditing(false);
  };

  return (
    <div
      className={`relative rounded-xl border transition-all duration-200 overflow-hidden ${
        isPlaying
          ? 'bg-slate-900 border-amber-500/40 shadow-lg shadow-amber-500/5'
          : 'bg-slate-900/70 hover:bg-slate-900 border-slate-800 hover:border-slate-700/80'
      }`}
      dir={isPersian ? 'rtl' : 'ltr'}
    >
      {/* 30-Day Lifecycle Progress Strip at the top */}
      <div className="w-full h-1 bg-slate-800">
        <div
          className={`h-full transition-all duration-500 ${
            recording.isProtected
              ? 'bg-blue-500'
              : retention.statusColor === 'crimson'
              ? 'bg-red-500'
              : retention.statusColor === 'amber'
              ? 'bg-amber-500'
              : 'bg-emerald-500'
          }`}
          style={{ width: `${recording.isProtected ? 100 : Math.min(100, retention.progressPercent)}%` }}
        />
      </div>

      <div className="p-4 space-y-3">
        {/* Main Row */}
        <div className="flex items-start justify-between gap-3">
          {/* Left: Direction Icon + Caller Info */}
          <div className="flex items-start gap-3 min-w-0">
            <button
              onClick={() => onPlay(recording)}
              className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center transition-all ${
                isPlaying
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/30 ring-2 ring-amber-400'
                  : 'bg-slate-800 hover:bg-amber-500/20 text-slate-200 hover:text-amber-300'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
            </button>

            <div className="min-w-0 flex-1">
              {isEditing ? (
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="px-2 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-slate-100 font-semibold mb-1 w-full"
                />
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-sm font-semibold text-slate-100 truncate">
                    {recording.contactName}
                  </h4>
                  {recording.isProtected && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Shield className="w-2.5 h-2.5" />
                      {isPersian ? 'محافظت‌شده' : 'Protected'}
                    </span>
                  )}
                </div>
              )}

              <div className="text-xs text-slate-400 font-mono flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1">
                  {recording.direction === 'incoming' ? (
                    <PhoneIncoming className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <PhoneOutgoing className="w-3 h-3 text-blue-400" />
                  )}
                  <span>{recording.phoneNumber}</span>
                </span>
                <span>·</span>
                <span className="text-slate-400">{formatCallDate(recording.timestamp, isPersian)}</span>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Toggle Protect */}
            <button
              onClick={() => onToggleProtect(recording.id)}
              className={`p-1.5 rounded-lg text-xs transition-colors ${
                recording.isProtected
                  ? 'text-blue-400 bg-blue-500/10 hover:bg-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
              title={
                recording.isProtected
                  ? (isPersian ? 'حذف محافظت (شامل پاک‌سازی خودکار)' : 'Unprotect')
                  : (isPersian ? 'محافظت در برابر پاک‌سازی ۳۰ روزه' : 'Protect from 30-day purge')
              }
            >
              {recording.isProtected ? <Pin className="w-4 h-4 fill-blue-400/30" /> : <Pin className="w-4 h-4" />}
            </button>

            {/* Download MP3 */}
            <button
              onClick={handleDownload}
              className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
              title={isPersian ? 'دانلود فایل MP3' : 'Download MP3'}
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Edit Notes */}
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title={isPersian ? 'ویرایش یادداشت' : 'Edit Notes'}
            >
              <Edit2 className="w-4 h-4" />
            </button>

            {/* Delete */}
            <button
              onClick={() => onDelete(recording.id)}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
              title={isPersian ? 'حذف' : 'Delete'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Audio Meta and Retention Badges */}
        <div className="flex items-center justify-between gap-x-2 gap-y-1.5 pt-1.5 border-t border-slate-800/60 text-xs flex-wrap">
          <div className="flex items-center gap-2 sm:gap-3 font-mono text-slate-400 tabular-nums flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>{formatDuration(recording.duration)}</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <FileAudio className="w-3.5 h-3.5" />
              <span>MP3 · {recording.bitrate} kbps</span>
            </span>
            <span>·</span>
            <span>{formatBytes(recording.sizeBytes)}</span>
          </div>

          {/* Retention Countdown badge */}
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[11px] font-mono px-2 py-0.5 rounded-md flex items-center gap-1 ${
                recording.isProtected
                  ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                  : retention.statusColor === 'crimson'
                  ? 'bg-red-500/15 text-red-300 border border-red-500/30 animate-pulse'
                  : retention.statusColor === 'amber'
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {retention.isExpiringSoon && !recording.isProtected && (
                <AlertTriangle className="w-3 h-3 text-red-400" />
              )}
              <span>{isPersian ? retention.statusLabelFa : retention.statusLabelEn}</span>
            </span>
          </div>
        </div>

        {/* Notes section */}
        {isEditing ? (
          <div className="pt-2 space-y-2">
            <textarea
              value={editedNotes}
              onChange={(e) => setEditedNotes(e.target.value)}
              rows={2}
              className="w-full p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              placeholder={isPersian ? 'یادداشت‌های مکالمه...' : 'Call notes...'}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
              >
                {isPersian ? 'انصراف' : 'Cancel'}
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1 px-3 py-1 bg-amber-500 text-slate-950 font-medium text-xs rounded"
              >
                <Check className="w-3.5 h-3.5" />
                {isPersian ? 'ذخیره' : 'Save'}
              </button>
            </div>
          </div>
        ) : (
          recording.notes && (
            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed bg-slate-950/40 p-2 rounded-lg border border-slate-800/40">
              {recording.notes}
            </p>
          )
        )}
      </div>
    </div>
  );
};
