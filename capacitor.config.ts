import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.whitepicket.game',
  appName: 'White Picket',
  webDir: 'web',
  backgroundColor: '#140c2b',
  android: { allowMixedContent: false, webContentsDebuggingEnabled: false },
  ios: { contentInset: 'never', backgroundColor: '#140c2b', scrollEnabled: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: '#140c2b', showSpinner: false },
    StatusBar: { overlaysWebView: true, style: 'DARK' }
  }
};

export default config;
