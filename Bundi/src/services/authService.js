import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInAnonymously
} from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs 
} from 'firebase/firestore';
import { httpsCallable, getFunctions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TwilioService } from '../utils/twilio';
import { createUserDocument } from './userService';

const firebaseFunctions = getFunctions();

export async function register(email, password, displayName) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Create user document in Firestore
    await createUserDocument(user.uid, {
      email,
      displayName,
      createdAt: new Date().toISOString()
    });
    
    return user;
  } catch (error) {
    console.error('Error registering user:', error);
    throw error;
  }
}

export async function login(email, password) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Error logging in:', error);
    throw error;
  }
}

export const registerAndLoginWithPhone = async (phoneNumber, otpCode) => {
  try {
    console.log('Starting phone authentication process...');
    console.log('Verifying OTP with Twilio...');
    
    // Step 1: Verify OTP with Twilio
    const verificationResult = await TwilioService.verifyOTP(phoneNumber, otpCode);
    console.log('Twilio verification result:', verificationResult);
    
    if (!verificationResult.valid) {
      throw new Error('Invalid verification code');
    }

    console.log('Phone number verified successfully:', phoneNumber);

    // Step 2: Get custom token from your backend
    console.log('Attempting to fetch custom token...');
    let customToken;
    try {
      customToken = await getCustomTokenFromBackend(phoneNumber);
      console.log('Successfully received custom token');
    } catch (tokenError) {
      console.error('Failed to get custom token:', tokenError);
      
      // For development/testing, create a temporary user with email/password
      console.log('Creating temporary user for development...');
      const tempEmail = `${phoneNumber.replace(/[^0-9]/g, '')}@temp.baatchit.com`;
      const tempPassword = Math.random().toString(36).slice(-8);
      
      try {
        const tempCredential = await createUserWithEmailAndPassword(auth, tempEmail, tempPassword);
        const tempUser = tempCredential.user;
        
        // Create a temporary user document
        const userDocRef = doc(db, 'users', tempUser.uid);
        await setDoc(userDocRef, {
          uid: tempUser.uid,
          phoneNumber: phoneNumber,
          displayName: phoneNumber,
          avatar: null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
          isActive: true,
          friends: [],
          friendRequests: [],
          isTemporary: true,
          email: tempEmail
        });
        
        console.log('Temporary user document created');
        return { 
          user: tempUser, 
          phoneNumber, 
          isVerified: true,
          isTemporary: true 
        };
      } catch (tempUserError) {
        console.error('Failed to create temporary user:', tempUserError);
        // If user already exists, try to sign in
        try {
          const signInCredential = await signInWithEmailAndPassword(auth, tempEmail, tempPassword);
          const existingUser = signInCredential.user;
          
          // Update last login
          const userDocRef = doc(db, 'users', existingUser.uid);
          await setDoc(userDocRef, {
            lastLogin: serverTimestamp(),
            isActive: true
          }, { merge: true });
          
          return {
            user: existingUser,
            phoneNumber,
            isVerified: true,
            isTemporary: true
          };
        } catch (signInError) {
          console.error('Failed to sign in with temporary account:', signInError);
          throw new Error('Failed to create or sign in with temporary account. Please try again.');
        }
      }
    }

    // Step 3: Sign in with the custom token
    console.log('Signing in with custom token...');
    const userCredential = await signInWithCustomToken(auth, customToken);
    const user = userCredential.user;
    console.log('Successfully signed in with custom token');

    // Step 4: Check if user document exists
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
      // Step 5: Create new user document for first-time users
      await setDoc(userDocRef, {
        uid: user.uid,
        phoneNumber: phoneNumber,
        displayName: phoneNumber,
        avatar: null,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        isActive: true,
        friends: [],
        friendRequests: [],
      });
      console.log('User document created successfully');
    } else {
      // Step 6: Update existing user's last login
      await setDoc(userDocRef, {
        ...userDoc.data(),
        lastLogin: serverTimestamp(),
        isActive: true,
      });
      console.log('User document updated successfully');
    }

    // Store verified phone number
    await AsyncStorage.setItem('phoneNumber', phoneNumber);
    
    console.log('Phone authentication completed successfully');
    return { user, phoneNumber, isVerified: true };
  } catch (error) {
    console.error('Phone authentication error:', error);
    if (error.message.includes('VerificationCheck was not found')) {
      throw new Error('Verification service is not properly configured. Please contact support.');
    }
    throw error;
  }
};

// Helper function to get custom token from your backend
const getCustomTokenFromBackend = async (phoneNumber) => {
  try {
    console.log('Fetching custom token from backend...');
    // Replace with your actual backend endpoint
    const response = await Promise.race([
      fetch('https://verify.twilio.com/v2/Services/VA87818ecf299afe43e5422c2986cf0c1f/Verifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber }),
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Backend request timeout')), 5000)
      )
    ]);
    
    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    if (!data.customToken) {
      throw new Error('Backend response missing customToken');
    }
    return data.customToken;
  } catch (error) {
    console.error('Error getting custom token:', error);
    throw error;
  }
};

// Add a function to request phone verification code
export const requestPhoneVerification = async (phoneNumber) => {
  try {
    console.log('Requesting phone verification code...');
    const requestPhoneCode = httpsCallable(firebaseFunctions, 'requestPhoneCode');
    
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

export const authService = {
  // Send OTP to phone number
  sendOTP: async (phoneNumber) => {
    try {
      const sendVerification = httpsCallable(firebaseFunctions, 'sendVerification');
      const result = await sendVerification({ phoneNumber });
      return result.data;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw error;
    }
  },

  // Verify OTP and sign in
  verifyOTP: async (phoneNumber, code) => {
    try {
      // First verify the OTP with Twilio
      const verificationResult = await TwilioService.verifyOTP(phoneNumber, code);
      
      if (verificationResult.valid) {
        // Get the custom token from our Cloud Function
        const verifyPhoneAndCreateToken = httpsCallable(firebaseFunctions, 'verifyPhoneAndCreateToken');
        const result = await verifyPhoneAndCreateToken({ phoneNumber });
        
        // Sign in with the custom token
        await auth.signInWithCustomToken(result.data.customToken);
        
        return {
          success: true,
          user: result.data
        };
      } else {
        throw new Error('Invalid verification code');
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      throw error;
    }
  },

  // Sign out
  signOut: async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  },

  // Get current user
  getCurrentUser: () => {
    return auth.currentUser;
  },

  // Listen to auth state changes
  onAuthStateChanged: (callback) => {
    return auth.onAuthStateChanged(callback);
  }
};