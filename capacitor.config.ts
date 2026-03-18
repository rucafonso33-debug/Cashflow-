import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.provera.app',
  appName: 'Provera',
  webDir: 'dist',

  server: {
    hostname: 'provera-finance.vercel.app',
    androidScheme: 'https'
  }
};

export default config;
