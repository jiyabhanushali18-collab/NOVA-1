import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nova.app',
  appName: 'NOVA',
  webDir: 'dist',
  // No server.url — the app loads its own bundled JS from dist/ inside the APK.
  // API calls use the absolute VITE_API_BASE_URL baked into the bundle at build time.
};

export default config;
