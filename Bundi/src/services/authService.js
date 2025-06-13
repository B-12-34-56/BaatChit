import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getAuth, 
  signInWithCredential, 
  PhoneAuthProvider,
  signOut, 
  onAuthStateChanged as onFirebaseAuthStateChanged,
  RecaptchaVerifier
} from 'firebase/auth';
import { app } from '../utils/firebase';

const auth = getAuth();

/**
 * Normalize a phone number to E.164 format (e.g. "+15551234567")
 */
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) cleaned = `+${cleaned}`;
  console.log('Formatted phone number:', cleaned);
  return cleaned;
}

const authService = {
  /**
   * Send an OTP via Firebase
   * @param {string} phoneNumber — raw or E.164-format
   * @returns {Promise<string>} verificationId
   */
  sendOTP: async (phoneNumber) => {
    const e164 = formatPhoneNumber(phoneNumber);
    try {
      console.log('Sending OTP to:', e164);
      
      // Clear any existing verification data
      await AsyncStorage.removeItem('confirmationResult');
      
      // Create a new reCAPTCHA verifier
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
        callback: () => {
          console.log('reCAPTCHA verified');
        }
      });

      // Send verification code
      const confirmationResult = await auth.signInWithPhoneNumber(e164, recaptchaVerifier);
      console.log('Verification code sent successfully');
      
      // Store the confirmation result
      const verificationData = {
        phoneNumber: e164,
        verificationId: confirmationResult.verificationId,
        timestamp: Date.now()
      };
      
      await AsyncStorage.setItem('confirmationResult', JSON.stringify(verificationData));
      console.log('Stored verification data:', verificationData);
      
      return confirmationResult.verificationId;
    } catch (error) {
      console.error('Error sending OTP:', error);
      // Clear any partial verification data
      await AsyncStorage.removeItem('confirmationResult');
      throw new Error(`Failed to send OTP: ${error.message}`);
    }
  },

  /**
   * Verify the OTP code and sign in with Firebase
   * @param {string} phoneNumber — must match the one used in sendOTP()
   * @param {string} code — 6-digit verification code
   * @returns {Promise<import('firebase/auth').UserCredential.user>}
   */
  verifyOTP: async (phoneNumber, code) => {
    const e164 = formatPhoneNumber(phoneNumber);
    try {
      console.log('Verifying OTP for:', e164);
      
      // Get the stored confirmation result
      const storedData = await AsyncStorage.getItem('confirmationResult');
      console.log('Retrieved stored data:', storedData);
      
      if (!storedData) {
        throw new Error('No verification in progress. Please request a new code.');
      }

      const verificationData = JSON.parse(storedData);
      console.log('Parsed verification data:', verificationData);

      // Check if verification has expired (15 minutes)
      const now = Date.now();
      const verificationAge = now - verificationData.timestamp;
      if (verificationAge > 15 * 60 * 1000) { // 15 minutes in milliseconds
        await AsyncStorage.removeItem('confirmationResult');
        throw new Error('Verification code expired. Please request a new code.');
      }

      if (verificationData.phoneNumber !== e164) {
        console.error('Phone number mismatch:', {
          stored: verificationData.phoneNumber,
          current: e164
        });
        throw new Error('Phone number mismatch. Please start verification again.');
      }

      // Get Firebase phone auth credential
      const credential = PhoneAuthProvider.credential(
        verificationData.verificationId,
        code
      );

      // Sign in with the credential
      const userCredential = await signInWithCredential(auth, credential);
      console.log('Successfully signed in with Firebase:', userCredential.user.uid);
      
      // Store user ID
      await AsyncStorage.setItem('uid', userCredential.user.uid);
      
      // Clear verification data only after successful sign in
      await AsyncStorage.removeItem('confirmationResult');
      console.log('Cleared verification data after successful sign in');
      
      return userCredential.user;
    } catch (error) {
      console.error('Error verifying OTP & signing in:', error);
      if (error.code === 'auth/invalid-verification-code') {
        throw new Error('Invalid verification code. Please try again.');
      } else if (error.code === 'auth/invalid-verification-id') {
        await AsyncStorage.removeItem('confirmationResult');
        throw new Error('Verification expired. Please request a new code.');
      }
      throw new Error(`Authentication failed: ${error.message}`);
    }
  },

  /**
   * Sign the current user out
   */
  logout: async () => {
    try {
      await signOut(auth);
      await AsyncStorage.removeItem('uid');
      await AsyncStorage.removeItem('confirmationResult');
      console.log('Cleared all auth data during logout');
    } catch (error) {
      console.error('Error signing out:', error);
      throw new Error(`Failed to sign out: ${error.message}`);
    }
  },

  /**
   * Get the currently signed-in user
   * @returns {import('firebase/auth').User | null}
   */
  getCurrentUser: () => {
    return auth.currentUser;
  },

  /**
   * Subscribe to Firebase auth state changes
   * @param {(user: import('firebase/auth').User | null) => void} callback
   * @returns {() => void} unsubscribe function
   */
  onAuthStateChanged: (callback) => {
    return onFirebaseAuthStateChanged(auth, callback);
  },
};

export default authService;