// src/utils/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyDQEmgORaQ_IYo980WmcjAZXHdvXhSxz2E",
  authDomain: "messagingapp-cc6ec.firebaseapp.com",
  projectId: "messagingapp-cc6ec",
  storageBucket: "messagingapp-cc6ec.firebasestorage.app",
  appId: "1:511694963453:web:e8066316c37d7768b73494",
  measurementId: "G-207JCH66B2"
};

// Initialize app only once
let app;
let auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  
  // Initialize auth with AsyncStorage persistence
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage)
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

// Initialize other services
const db = getFirestore(app);
const storage = getStorage(app);

console.log('Firebase initialized successfully');

export { auth, db, storage };