// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

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
export const app = initializeApp(firebaseConfig);
let analytics;
if (typeof window !== "undefined" && "measurementId" in firebaseConfig) {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    // Optionally log the error
    console.warn("Analytics not supported in this environment", e);
  }
}
export { analytics };
export const auth = getAuth();
export const storage = getStorage();
export const db = getFirestore();