import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.sadagir.callrecorder',
  appName: 'صداگیر',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    // Custom native bridge plugin for Android background call recording
  },
};

export default config;
