package com.sadagir.callrecorder;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "SadaGirCallRecorder",
    permissions = {
        @Permission(strings = {Manifest.permission.RECORD_AUDIO}, name = "audio"),
        @Permission(strings = {Manifest.permission.READ_PHONE_STATE}, name = "phoneState"),
        @Permission(strings = {Manifest.permission.READ_CALL_LOG}, name = "callLog")
    }
)
public class CallRecorderPlugin extends Plugin {
    private static final String TAG = "SadaGirPlugin";
    private static CallRecorderPlugin instance;

    @Override
    public void load() {
        super.load();
        instance = this;
    }

    public static void notifyCallState(Context context, String state, String number, String direction) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("state", state); // "RINGING", "OFFHOOK", "IDLE"
            data.put("phoneNumber", number != null ? number : "");
            data.put("direction", direction != null ? direction : "incoming");
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("callStateChanged", data);
        }
    }

    public static void notifyCallSaved(Context context, String filePath, String number, String direction, long duration, long sizeBytes) {
        if (instance != null) {
            JSObject data = new JSObject();
            data.put("filePath", filePath);
            data.put("phoneNumber", number != null ? number : "");
            data.put("direction", direction != null ? direction : "incoming");
            data.put("duration", duration);
            data.put("sizeBytes", sizeBytes);
            data.put("timestamp", System.currentTimeMillis());
            instance.notifyListeners("callSaved", data);
        }
    }

    @PluginMethod
    public void startBackgroundService(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, CallRecordingService.class);
            serviceIntent.setAction("BOOT_START");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent);
            } else {
                context.startService(serviceIntent);
            }

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("message", "Background call recorder foreground service is active");
            call.resolve(res);
        } catch (Exception e) {
            Log.e(TAG, "Error starting background service", e);
            call.reject("Failed to start service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopBackgroundService(PluginCall call) {
        try {
            Context context = getContext();
            Intent serviceIntent = new Intent(context, CallRecordingService.class);
            context.stopService(serviceIntent);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("message", "Background service stopped");
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Failed to stop service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkCallPermissions(PluginCall call) {
        Context context = getContext();
        boolean hasAudio = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED;
        boolean hasPhoneState = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_PHONE_STATE) == PackageManager.PERMISSION_GRANTED;
        boolean hasCallLog = ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED;

        JSObject res = new JSObject();
        res.put("recordAudio", hasAudio);
        res.put("readPhoneState", hasPhoneState);
        res.put("readCallLog", hasCallLog);
        res.put("allGranted", hasAudio && hasPhoneState && hasCallLog);
        call.resolve(res);
    }
}
