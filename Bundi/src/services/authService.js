import { auth, db, functions } from '../utils/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  updateProfile, 
  signInWithCustomToken,
  PhoneAuthProvider,
  RecaptchaVerifier
} from 'firebase/auth';
import { createUserDocument } from './userService';
import { 
  doc, 
  setDoc, 
  getDoc, 
  Timestamp, 
  serverTimestamp, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TwilioService } from '../utils/twilio';

export async function register(email, password, displayName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(userCredential.user, { displayName });
    return userCredential.user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export const registerAndLoginWithPhone = async (phoneNumber, otpCode) => {
  try {
    console.log('Starting phone authentication process...');
    console.log('Verifying OTP with Twilio...');
    
    // Verify OTP with Twilio
    const verificationResult = await TwilioService.verifyOTP(phoneNumber, otpCode);
    console.log('Twilio verification result:', verificationResult);
    
    if (!verificationResult.valid) {
      throw new Error('Invalid verification code');
    }

    console.log('Phone number verified successfully:', phoneNumber);

    try {
      // Check if user already exists with this phone number
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('phoneNumber', '==', phoneNumber));
      const querySnapshot = await getDocs(q);
      
      let user;
      
      if (querySnapshot.empty) {
        // Create new user if doesn't exist
        const userCredential = await createUserWithEmailAndPassword(
          auth,
          `${phoneNumber}@baatchit.com`,
          Math.random().toString(36).slice(-8)
        );
        user = userCredential.user;
        
        // Create user document
        await setDoc(doc(db, 'users', user.uid), {
          phoneNumber,
          createdAt: serverTimestamp(),
          friends: [],
          displayName: null,
          photoURL: null,
          email: null
        });
        console.log('New user created in Firebase');
      } else {
        // User exists, sign in
        const userDoc = querySnapshot.docs[0];
        const userCredential = await signInWithEmailAndPassword(
          auth,
          `${phoneNumber}@baatchit.com`,
          Math.random().toString(36).slice(-8)
        );
        user = userCredential.user;
        console.log('Existing user signed in');
      }

      // Store verified phone number
      await AsyncStorage.setItem('phoneNumber', phoneNumber);
      
      console.log('Phone authentication completed successfully');
      return { user, phoneNumber, isVerified: true };
    } catch (firebaseError) {
      console.error('Firebase operation error:', firebaseError);
      throw new Error('Failed to authenticate with Firebase: ' + firebaseError.message);
    }
  } catch (error) {
    console.error('Phone authentication error:', error);
    if (error.message.includes('VerificationCheck was not found')) {
      throw new Error('Verification service is not properly configured. Please contact support.');
    }
    throw error;
  }
};

// Add a function to request phone verification code
export const requestPhoneVerification = async (phoneNumber) => {
  try {
    console.log('Requesting phone verification code...');
    const requestPhoneCode = httpsCallable(functions, 'requestPhoneCode');
    
    const result = await requestPhoneCode({
      phoneNumber
    });
    
    console.log('Phone verification code requested:', result.data);
    return result.data;
  } catch (error) {
    console.error('Error requesting phone verification:', error);
    throw error;
  }
};

export async function logout() {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
}