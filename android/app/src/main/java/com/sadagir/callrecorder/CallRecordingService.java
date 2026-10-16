package com.sadagir.callrecorder;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import java.io.File;
import java.io.IOException;

public class CallRecordingService extends Service {
    private static final String TAG = "SadaGirCallService";
    private static final String CHANNEL_ID = "SadaGirCallRecorderChannel";
    private static final int NOTIFICATION_ID = 1001;

    private MediaRecorder mediaRecorder;
    private boolean isRecording = false;
    private String currentPhoneNumber = "";
    private String currentDirection = "incoming";
    private long recordingStartTime = 0;
    private File currentOutputFile;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIFICATION_ID, buildForegroundNotification("سرویس آماده‌به‌کار ضبط تماس فعال است (نگهداری ۳۰ روزه)"));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getAction() != null) {
            String action = intent.getAction();
            String number = intent.getStringExtra("phoneNumber");
            String direction = intent.getStringExtra("direction");
            if (number != null) currentPhoneNumber = number;
            if (direction != null) currentDirection = direction;

            if ("START_RECORDING".equals(action)) {
                startRecording();
            } else if ("STOP_RECORDING".equals(action)) {
                stopRecording();
            } else if ("BOOT_START".equals(action)) {
                Log.d(TAG, "Service started on device boot");
            }
        }
        return START_STICKY;
    }

    private void startRecording() {
        if (isRecording) {
            Log.w(TAG, "Already recording. Skipping duplicate start.");
            return;
        }

        try {
            File storageDir = new File(getFilesDir(), "call_recordings");
            if (!storageDir.exists()) {
                storageDir.mkdirs();
            }

            // Cleanup recordings older than 30 days
            purgeExpired30DaysFiles(storageDir);

            String timestamp = String.valueOf(System.currentTimeMillis());
            String sanitizedNumber = currentPhoneNumber.replaceAll("[^0-9+]", "");
            if (sanitizedNumber.isEmpty()) sanitizedNumber = "call";

            currentOutputFile = new File(storageDir, "call_" + sanitizedNumber + "_" + timestamp + ".mp3");

            mediaRecorder = new MediaRecorder();
            try {
                mediaRecorder.setAudioSource(MediaRecorder.AudioSource.VOICE_COMMUNICATION);
            } catch (Exception e) {
                // Fallback to standard MIC if VOICE_COMMUNICATION isn't allowed by OEM
                mediaRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            }

            mediaRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            mediaRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            mediaRecorder.setAudioEncodingBitRate(128000);
            mediaRecorder.setAudioSamplingRate(44100);
            mediaRecorder.setOutputFile(currentOutputFile.getAbsolutePath());

            mediaRecorder.prepare();
            mediaRecorder.start();

            isRecording = true;
            recordingStartTime = System.currentTimeMillis();

            updateNotification("🔴 در حال ضبط مکالمه با " + (currentPhoneNumber.isEmpty() ? "مخاطب" : currentPhoneNumber));
            Log.d(TAG, "Recording started for: " + currentPhoneNumber);
        } catch (IOException | IllegalStateException e) {
            Log.e(TAG, "Failed to start MediaRecorder", e);
            releaseRecorder();
        }
    }

    private void stopRecording() {
        if (!isRecording || mediaRecorder == null) {
            return;
        }

        try {
            mediaRecorder.stop();
            long durationSeconds = (System.currentTimeMillis() - recordingStartTime) / 1000;
            Log.d(TAG, "Recording stopped. Duration: " + durationSeconds + "s, File: " + (currentOutputFile != null ? currentOutputFile.getAbsolutePath() : "null"));

            if (currentOutputFile != null && currentOutputFile.exists()) {
                // Notify Capacitor plugin with full file details
                CallRecorderPlugin.notifyCallSaved(
                    getApplicationContext(),
                    currentOutputFile.getAbsolutePath(),
                    currentPhoneNumber,
                    currentDirection,
                    durationSeconds,
                    currentOutputFile.length()
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "Error stopping MediaRecorder", e);
        } finally {
            releaseRecorder();
            updateNotification("سرویس آماده‌به‌کار ضبط تماس فعال است (نگهداری ۳۰ روزه)");
        }
    }

    private void releaseRecorder() {
        isRecording = false;
        if (mediaRecorder != null) {
            try {
                mediaRecorder.reset();
                mediaRecorder.release();
            } catch (Exception ignored) {}
            mediaRecorder = null;
        }
    }

    /**
     * Purges files older than 30 days (FIFO / 30-day lifecycle)
     */
    private void purgeExpired30DaysFiles(File directory) {
        long thirtyDaysAgo = System.currentTimeMillis() - (30L * 24 * 60 * 60 * 1000);
        File[] files = directory.listFiles();
        if (files == null) return;

        for (File file : files) {
            if (file.isFile() && file.lastModified() < thirtyDaysAgo) {
                boolean deleted = file.delete();
                Log.d(TAG, "Purged expired 30-day call recording: " + file.getName() + " (success: " + deleted + ")");
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "صداگیر - سرویس ضبط پس‌زمینه",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("کانال اعلان برای فعال نگه داشتن ضبط تماس در پس‌زمینه");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private Notification buildForegroundNotification(String text) {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("صداگیر · SadaGir")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.stat_notify_call_mute)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildForegroundNotification(text));
        }
    }

    @Override
    public void onDestroy() {
        releaseRecorder();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
