import { auth, db } from '../utils/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import { createUserDocument } from './userService';
import { TwilioService } from '../utils/twilio';
import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';

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

export const registerAndLoginWithPhone = async (phoneNumber, otp) => {
  try {
    console.log('Starting phone authentication process...');
    
    // First verify the OTP with Twilio
    const verificationResult = await TwilioService.verifyOTP(phoneNumber, otp);
    console.log('Twilio verification result:', verificationResult);
    
    if (!verificationResult.valid) {
      throw new Error('Invalid verification code');
    }

    // Check if user already exists
    const userDoc = await getDoc(doc(db, 'users', phoneNumber));
    const now = Timestamp.now();
    
    if (!userDoc.exists()) {
      // Create new user document with complete user data
      await setDoc(doc(db, 'users', phoneNumber), {
        phoneNumber,
        createdAt: now,
        lastLogin: now,
        isActive: true,
        displayName: `User ${phoneNumber.slice(-4)}`,
        friends: [],
        friendRequests: [],
        photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(phoneNumber.slice(-4))}&background=667eea&color=fff&bold=true`
      });
      console.log('Created new user document');
    } else {
      // Update last login and ensure user is active
      await setDoc(doc(db, 'users', phoneNumber), {
        lastLogin: now,
        isActive: true
      }, { merge: true });
      console.log('Updated existing user document');
    }

    // Create a mock user object for now
    // In production, you should implement proper Firebase phone authentication
    const mockUser = {
      uid: phoneNumber,
      phoneNumber,
      displayName: `User ${phoneNumber.slice(-4)}`,
      photoURL: `https://ui-avatars.com/api/?name=${encodeURIComponent(phoneNumber.slice(-4))}&background=667eea&color=fff&bold=true`,
      isActive: true
    };

    return mockUser;
  } catch (error) {
    console.error('Phone authentication error:', error);
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