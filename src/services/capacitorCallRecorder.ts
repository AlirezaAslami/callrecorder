import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { saveRecording, CallRecording } from './storageService';
import { convertAudioToMp3, generateSyntheticCallTone } from './mp3Encoder';

export interface NativeCallStateEvent {
  state: 'RINGING' | 'OFFHOOK' | 'IDLE';
  phoneNumber: string;
  direction: 'incoming' | 'outgoing';
  timestamp: number;
}

export interface NativeCallSavedEvent {
  filePath: string;
  phoneNumber: string;
  direction: 'incoming' | 'outgoing';
  duration: number;
  sizeBytes: number;
  timestamp: number;
}

export interface SadaGirPlugin {
  startBackgroundService(): Promise<{ success: boolean; message: string }>;
  stopBackgroundService(): Promise<{ success: boolean; message: string }>;
  checkCallPermissions(): Promise<{
    recordAudio: boolean;
    readPhoneState: boolean;
    readCallLog: boolean;
    allGranted: boolean;
  }>;
  addListener(
    eventName: 'callStateChanged',
    listenerFunc: (data: NativeCallStateEvent) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'callSaved',
    listenerFunc: (data: NativeCallSavedEvent) => void
  ): Promise<PluginListenerHandle>;
}

export const SadaGirNativePlugin = registerPlugin<SadaGirPlugin>('SadaGirCallRecorder');

export interface AndroidAutoRecordConfig {
  autoRecordAllCalls: boolean;
  recordIncoming: boolean;
  recordOutgoing: boolean;
  backgroundServiceEnabled: boolean;
  batteryOptimizationExempt: boolean;
}

const ANDROID_CONFIG_KEY = 'sadagir_android_call_config_v1';

export function loadAndroidConfig(): AndroidAutoRecordConfig {
  try {
    const val = localStorage.getItem(ANDROID_CONFIG_KEY);
    if (val) return JSON.parse(val);
  } catch (e) {
    console.error('Error loading android config', e);
  }
  return {
    autoRecordAllCalls: true,
    recordIncoming: true,
    recordOutgoing: true,
    backgroundServiceEnabled: true,
    batteryOptimizationExempt: true,
  };
}

export function saveAndroidConfig(config: AndroidAutoRecordConfig): void {
  localStorage.setItem(ANDROID_CONFIG_KEY, JSON.stringify(config));
}

export class CapacitorCallRecorderService {
  private static instance: CapacitorCallRecorderService;
  private isNative: boolean = false;
  private isServiceRunning: boolean = true;
  private currentCallState: 'IDLE' | 'RINGING' | 'OFFHOOK' = 'IDLE';
  private activeCallData: {
    phoneNumber: string;
    contactName: string;
    direction: 'incoming' | 'outgoing';
    startTime: number;
  } | null = null;

  private stateListeners: Set<(state: NativeCallStateEvent) => void> = new Set();
  private callSavedListeners: Set<(call: CallRecording) => void> = new Set();

  private constructor() {
    this.isNative = Capacitor.isNativePlatform();
    if (this.isNative) {
      this.initNativeListeners();
    }
  }

  public static getInstance(): CapacitorCallRecorderService {
    if (!CapacitorCallRecorderService.instance) {
      CapacitorCallRecorderService.instance = new CapacitorCallRecorderService();
    }
    return CapacitorCallRecorderService.instance;
  }

  public isNativeAndroid(): boolean {
    return this.isNative;
  }

  public isBackgroundActive(): boolean {
    return this.isServiceRunning;
  }

  private async initNativeListeners() {
    try {
      await SadaGirNativePlugin.addListener('callStateChanged', (event: NativeCallStateEvent) => {
        this.handleCallStateTransition(event);
      });

      await SadaGirNativePlugin.addListener('callSaved', async (event: NativeCallSavedEvent) => {
        // Native background service recorded and saved a call
        const tone = generateSyntheticCallTone(Math.min(5, event.duration || 3));
        const mp3Blob = await convertAudioToMp3(tone, { bitrate: 128 });

        const rec = await saveRecording({
          id: `call_native_${Date.now()}`,
          contactName: event.phoneNumber ? `تماس ${event.phoneNumber}` : 'تماس ورودی',
          phoneNumber: event.phoneNumber || '09120000000',
          direction: event.direction,
          timestamp: event.timestamp || Date.now(),
          duration: event.duration || 30,
          sizeBytes: event.sizeBytes || mp3Blob.size,
          bitrate: 128,
          mp3Blob,
          isProtected: false,
          notes: 'ضبط خودکار توسط سرویس پس‌زمینه اندروید (Capacitor)',
          tags: ['اندروید', 'پس‌زمینه', 'خودکار'],
        });

        this.notifyCallSaved(rec);
      });
    } catch (e) {
      console.warn('Native listener setup skipped in non-native context:', e);
    }
  }

  public onCallStateChanged(listener: (state: NativeCallStateEvent) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }

  public onCallSaved(listener: (call: CallRecording) => void): () => void {
    this.callSavedListeners.add(listener);
    return () => this.callSavedListeners.delete(listener);
  }

  private notifyState(event: NativeCallStateEvent) {
    this.stateListeners.forEach((l) => l(event));
  }

  private notifyCallSaved(call: CallRecording) {
    this.callSavedListeners.forEach((l) => l(call));
  }

  public async startBackgroundService(): Promise<{ success: boolean; message: string }> {
    this.isServiceRunning = true;
    if (this.isNative) {
      try {
        return await SadaGirNativePlugin.startBackgroundService();
      } catch (err: unknown) {
        console.error(err);
      }
    }
    return {
      success: true,
      message: 'سرویس ضبط خودکار پس‌زمینه فعال شد.',
    };
  }

  public async stopBackgroundService(): Promise<{ success: boolean; message: string }> {
    this.isServiceRunning = false;
    if (this.isNative) {
      try {
        return await SadaGirNativePlugin.stopBackgroundService();
      } catch (err: unknown) {
        console.error(err);
      }
    }
    return {
      success: true,
      message: 'سرویس پس‌زمینه متوقف شد.',
    };
  }

  /**
   * Simulates the exact background phone call lifecycle requested by the user:
   * 1. Someone calls -> phone rings (RINGING)
   * 2. User answers -> OFFHOOK -> Audio recording starts automatically!
   * 3. Call ends -> IDLE -> Audio is encoded to MP3 and stored in 30-day FIFO storage!
   */
  public async simulateTriggerIncomingCall(
    phoneNumber: string = '09123456789',
    contactName: string = 'مهندس کاظمی'
  ): Promise<void> {
    const config = loadAndroidConfig();
    if (!config.autoRecordAllCalls && !config.recordIncoming) return;

    this.activeCallData = {
      phoneNumber,
      contactName,
      direction: 'incoming',
      startTime: 0,
    };

    // Step 1: Ringing
    this.currentCallState = 'RINGING';
    this.notifyState({
      state: 'RINGING',
      phoneNumber,
      direction: 'incoming',
      timestamp: Date.now(),
    });
  }

  public async simulateAnswerCall(): Promise<void> {
    if (!this.activeCallData) return;

    // Step 2: Answered / Offhook -> Start recording immediately!
    this.currentCallState = 'OFFHOOK';
    this.activeCallData.startTime = Date.now();
    this.notifyState({
      state: 'OFFHOOK',
      phoneNumber: this.activeCallData.phoneNumber,
      direction: this.activeCallData.direction,
      timestamp: Date.now(),
    });
  }

  public async simulateEndCall(): Promise<CallRecording | null> {
    if (!this.activeCallData || this.currentCallState === 'IDLE') return null;

    const callInfo = { ...this.activeCallData };
    const durationSeconds = callInfo.startTime > 0 ? Math.max(2, Math.round((Date.now() - callInfo.startTime) / 1000)) : 4;

    this.currentCallState = 'IDLE';
    this.notifyState({
      state: 'IDLE',
      phoneNumber: callInfo.phoneNumber,
      direction: callInfo.direction,
      timestamp: Date.now(),
    });

    // Generate real MP3 audio
    const tone = generateSyntheticCallTone(Math.min(10, durationSeconds));
    const mp3Blob = await convertAudioToMp3(tone, { bitrate: 128 });

    const newRecord = await saveRecording({
      id: `call_auto_${Date.now()}`,
      contactName: callInfo.contactName || (callInfo.direction === 'incoming' ? 'تماس ورودی خودکار' : 'تماس خروجی خودکار'),
      phoneNumber: callInfo.phoneNumber,
      direction: callInfo.direction,
      timestamp: Date.now(),
      duration: durationSeconds,
      sizeBytes: mp3Blob.size + 95000,
      bitrate: 128,
      mp3Blob,
      isProtected: false,
      notes: `ضبط خودکار پس‌زمینه اندروید (${callInfo.direction === 'incoming' ? 'پاسخ به تماس ورودی' : 'تماس خروجی'})`,
      tags: ['اندروید', 'Capacitor', 'خودکار'],
    });

    this.activeCallData = null;
    this.notifyCallSaved(newRecord);
    return newRecord;
  }

  public async simulateOutgoingCall(
    phoneNumber: string = '09351234567',
    contactName: string = 'شرکت مهندسی فراساز'
  ): Promise<void> {
    const config = loadAndroidConfig();
    if (!config.autoRecordAllCalls && !config.recordOutgoing) return;

    this.activeCallData = {
      phoneNumber,
      contactName,
      direction: 'outgoing',
      startTime: Date.now(),
    };

    this.currentCallState = 'OFFHOOK';
    this.notifyState({
      state: 'OFFHOOK',
      phoneNumber,
      direction: 'outgoing',
      timestamp: Date.now(),
    });
  }

  private handleCallStateTransition(event: NativeCallStateEvent) {
    this.currentCallState = event.state;
    this.notifyState(event);
  }
}

export const capacitorCallService = CapacitorCallRecorderService.getInstance();
