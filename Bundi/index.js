import 'expo-router/entry';
import { LogBox } from 'react-native';
import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';
import { getAnalytics } from 'firebase/analytics';
import Constants from 'expo-constants';
import App from './App';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDQEmgORaQ_IYo980WmcjAZXHdvXhSxz2E",
  authDomain: "messagingapp-cc6ec.firebaseapp.com",
  projectId: "messagingapp-cc6ec",
  storageBucket: "messagingapp-cc6ec.appspot.com",
  messagingSenderId: "511694963453",
  appId: "1:511694963453:web:e8066316c37d7768b73494",
  measurementId: "G-207JCH66B2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const analytics = getAnalytics(app);

// Ignore specific warnings
LogBox.ignoreLogs([
  'Warning: Failed prop type',
  'Non-serializable values were found in the navigation state',
]);

function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Give Firebase time to initialize
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return <ExpoRoot />;
}

export default App;

registerRootComponent(App);
