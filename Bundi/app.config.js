export default {
  name: 'BaatChit',
  slug: 'BaatChit',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff'
  },
  assetBundlePatterns: [
    '**/*'
  ],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.baatchit.app'
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff'
    },
    package: 'com.baatchit.app'
  },
  web: {
    favicon: './assets/favicon.png'
  },
  extra: {
    firebaseApiKey: 'YOUR_FIREBASE_API_KEY',
    firebaseAuthDomain: 'YOUR_FIREBASE_AUTH_DOMAIN',
    firebaseProjectId: 'YOUR_FIREBASE_PROJECT_ID',
    firebaseStorageBucket: 'YOUR_FIREBASE_STORAGE_BUCKET',
    firebaseMessagingSenderId: 'YOUR_FIREBASE_MESSAGING_SENDER_ID',
    firebaseAppId: 'YOUR_FIREBASE_APP_ID',
    firebaseMeasurementId: 'YOUR_FIREBASE_MEASUREMENT_ID',
    twilioAccountSid: 'YOUR_TWILIO_ACCOUNT_SID',
    twilioAuthToken: 'YOUR_TWILIO_AUTH_TOKEN',
    twilioVerifyServiceSid: 'YOUR_TWILIO_VERIFY_SERVICE_SID',
    eas: {
      projectId: 'your-project-id'
    }
  }
}; 