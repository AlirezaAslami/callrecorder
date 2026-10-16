package com.sadagir.callrecorder;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.telephony.TelephonyManager;
import android.util.Log;

public class CallStateReceiver extends BroadcastReceiver {
    private static final String TAG = "SadaGirCallReceiver";
    private static int lastState = TelephonyManager.CALL_STATE_IDLE;
    private static String savedNumber = "";
    private static boolean isIncoming = false;

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();

        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            Log.d(TAG, "Boot completed. Starting Background Call Recording Service...");
            startRecordingService(context, "BOOT_START", "");
            return;
        }

        if ("android.intent.action.NEW_OUTGOING_CALL".equals(action)) {
            savedNumber = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER);
            isIncoming = false;
            Log.d(TAG, "Outgoing call to: " + savedNumber);
            return;
        }

        if (TelephonyManager.ACTION_PHONE_STATE_CHANGED.equals(action)) {
            String stateStr = intent.getStringExtra(TelephonyManager.EXTRA_STATE);
            String incomingNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER);
            if (incomingNumber != null && !incomingNumber.isEmpty()) {
                savedNumber = incomingNumber;
            }

            int state = TelephonyManager.CALL_STATE_IDLE;
            if (TelephonyManager.EXTRA_STATE_RINGING.equals(stateStr)) {
                state = TelephonyManager.CALL_STATE_RINGING;
            } else if (TelephonyManager.EXTRA_STATE_OFFHOOK.equals(stateStr)) {
                state = TelephonyManager.CALL_STATE_OFFHOOK;
            }

            onCustomCallStateChanged(context, state, savedNumber);
        }
    }

    private void onCustomCallStateChanged(Context context, int state, String number) {
        if (lastState == state) {
            return;
        }

        switch (state) {
            case TelephonyManager.CALL_STATE_RINGING:
                isIncoming = true;
                savedNumber = number;
                Log.d(TAG, "Incoming ringing from: " + number);
                // Notify plugin about incoming call
                CallRecorderPlugin.notifyCallState(context, "RINGING", number, "incoming");
                break;

            case TelephonyManager.CALL_STATE_OFFHOOK:
                // Transition to OFFHOOK:
                // If it was ringing -> Answered incoming call!
                // If it wasn't ringing -> Initiated outgoing call!
                String direction = isIncoming ? "incoming" : "outgoing";
                Log.d(TAG, "Call answered/offhook (" + direction + ") with: " + savedNumber);
                startRecordingService(context, "START_RECORDING", savedNumber, direction);
                CallRecorderPlugin.notifyCallState(context, "OFFHOOK", savedNumber, direction);
                break;

            case TelephonyManager.CALL_STATE_IDLE:
                // Call ended or missed
                if (lastState == TelephonyManager.CALL_STATE_OFFHOOK) {
                    Log.d(TAG, "Call ended. Stopping recording for: " + savedNumber);
                    startRecordingService(context, "STOP_RECORDING", savedNumber);
                    CallRecorderPlugin.notifyCallState(context, "IDLE", savedNumber, isIncoming ? "incoming" : "outgoing");
                }
                isIncoming = false;
                savedNumber = "";
                break;
        }

        lastState = state;
    }

    private void startRecordingService(Context context, String action, String number) {
        startRecordingService(context, action, number, "incoming");
    }

    private void startRecordingService(Context context, String action, String number, String direction) {
        Intent serviceIntent = new Intent(context, CallRecordingService.class);
        serviceIntent.setAction(action);
        serviceIntent.putExtra("phoneNumber", number);
        serviceIntent.putExtra("direction", direction);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent);
        } else {
            context.startService(serviceIntent);
        }
    }
}
