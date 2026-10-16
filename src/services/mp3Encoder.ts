import * as lamejs from 'lamejs';

export interface EncodeOptions {
  bitrate?: number; // 64, 128, 192, 256, 320 kbps (default 128)
  sampleRate?: number; // default 44100
  channels?: number; // 1 (mono) or 2 (stereo), default 1 for calls
  onProgress?: (percent: number) => void;
}

/**
 * Converts Float32Array (-1.0 to 1.0) into Int16Array (-32768 to 32767)
 */
function floatTo16BitPCM(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

/**
 * Encodes audio buffer or raw blob directly into an MP3 Blob
 */
export async function convertAudioToMp3(
  audioSource: Blob | AudioBuffer,
  options: EncodeOptions = {}
): Promise<Blob> {
  const bitrate = options.bitrate || 128;
  let audioBuffer: AudioBuffer;

  if (audioSource instanceof Blob) {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const arrayBuffer = await audioSource.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    if (audioContext.state !== 'closed') {
      await audioContext.close();
    }
  } else {
    audioBuffer = audioSource;
  }

  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const sampleRate = audioBuffer.sampleRate;
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);

  const leftChannel = audioBuffer.getChannelData(0);
  const rightChannel = channels > 1 ? audioBuffer.getChannelData(1) : undefined;

  const leftInt16 = floatTo16BitPCM(leftChannel);
  const rightInt16 = rightChannel ? floatTo16BitPCM(rightChannel) : undefined;

  const mp3Data: Int8Array[] = [];
  const sampleBlockSize = 1152;
  const totalSamples = leftInt16.length;

  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
    let mp3buf: Int8Array;

    if (channels === 2 && rightInt16) {
      const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
      mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = mp3encoder.encodeBuffer(leftChunk);
    }

    if (mp3buf.length > 0) {
      mp3Data.push(mp3buf);
    }

    if (options.onProgress && totalSamples > 0) {
      const progress = Math.min(99, Math.round((i / totalSamples) * 100));
      options.onProgress(progress);
    }
  }

  const endBuf = mp3encoder.flush();
  if (endBuf.length > 0) {
    mp3Data.push(endBuf);
  }

  if (options.onProgress) {
    options.onProgress(100);
  }

  return new Blob(mp3Data as unknown as BlobPart[], { type: 'audio/mp3' });
}

/**
 * Generates synthetic realistic phone call audio for simulation
 * (e.g., ringtone + simulated dial tone / voice audio)
 */
export function generateSyntheticCallTone(durationSeconds: number = 3): AudioBuffer {
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const sampleRate = audioContext.sampleRate;
  const numSamples = sampleRate * durationSeconds;
  const buffer = audioContext.createBuffer(1, numSamples, sampleRate);
  const channelData = buffer.getChannelData(0);

  // 440Hz + 480Hz US ring tone or 425Hz European tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const tone1 = Math.sin(2 * Math.PI * 440 * t);
    const tone2 = Math.sin(2 * Math.PI * 480 * t);
    // Beep pattern: 1.5s on, 1.5s off
    const isRing = (t % 3) < 1.5;
    channelData[i] = isRing ? 0.2 * (tone1 + tone2) * 0.5 : 0;
  }

  return buffer;
}
