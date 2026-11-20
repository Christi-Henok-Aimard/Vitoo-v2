import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.vitoo.app',
  appName: 'Vitoo',
  webDir: 'dist',
  server: { androidScheme: 'https' },
};

export default config;
