import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getAuth, 
  signOut, 
  onAuthStateChanged as onFirebaseAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { doc, setDoc, getFirestore, serverTimestamp, getDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../utils/firebase';

const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

/**
 * Normalize a phone number to E.164 format (e.g. "+15551234567")
 */
function formatPhoneNumber(phone) {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');
  
  // If the number starts with 1, remove it (we'll add it back)
  if (cleaned.startsWith('1')) {
    cleaned = cleaned.substring(1);
  }
  
  // Ensure the number is 10 digits (US format)
  if (cleaned.length !== 10) {
    throw new Error('Phone number must be 10 digits');
  }
  
  // Add +1 prefix for US numbers
  return `+1${cleaned}`;
}

const authService = {
  /**
   * Send OTP to phone number using Firebase Cloud Function
   * @param {string} phoneNumber - The phone number to send OTP to
   * @returns {Promise<{sid: string, phoneNumber: string}>} - The verification session
   */
  sendOTP: async (phoneNumber) => {
    try {
      console.log('[AuthService] Sending OTP to:', phoneNumber);
      
      // Format phone number to E.164
      const formattedPhone = formatPhoneNumber(phoneNumber);
      console.log('[AuthService] Formatted phone:', formattedPhone);
      
      // Call Firebase Cloud Function
      const initiateVerification = httpsCallable(functions, 'initiatePhoneVerification');
      const result = await initiateVerification({ phoneNumber: formattedPhone });
      
      console.log('[AuthService] Verification initiated:', result.data);
      
      return {
        sid: result.data.verificationSid,
        phoneNumber: result.data.phoneNumber,
        verificationSid: result.data.verificationSid
      };
    } catch (error) {
      console.error('[AuthService] Error sending OTP:', error);
      throw error;
    }
  },

  /**
   * Verify OTP and authenticate with Firebase using custom token
   * @param {string} code - The OTP code to verify
   * @param {Object} session - The verification session
   * @returns {Promise<Object>} - The user data
   */
  verifyOTP: async (code, session) => {
    try {
      console.log('[AuthService] Verifying OTP with session:', session);
      
      if (!session.phoneNumber || !session.verificationSid || !code) {
        throw new Error('Missing required fields: phoneNumber, code, or verificationSid');
      }
      
      // Call Firebase Cloud Function
      const verifyPhone = httpsCallable(functions, 'verifyPhoneAndCreateToken');
      const result = await verifyPhone({
        phoneNumber: session.phoneNumber,
        code: code,
        verificationSid: session.verificationSid
      });
      
      if (result.data.success && result.data.customToken) {
        // Sign in with custom token
        const userCredential = await signInWithCustomToken(auth, result.data.customToken);
        console.log('[AuthService] Authentication successful:', userCredential.user);
        
        // Update user document in Firestore
        const userRef = doc(db, 'users', userCredential.user.uid);
        await setDoc(userRef, {
          phoneNumber: session.phoneNumber,
          lastLogin: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
        
        return {
          uid: userCredential.user.uid,
          phoneNumber: userCredential.user.phoneNumber,
          user: userCredential.user
        };
      } else {
        throw new Error('Authentication failed');
      }
    } catch (error) {
      console.error('[AuthService] Error verifying OTP:', error);
      throw error;
    }
  },

  /**
   * Sign out user
   */
  logout: async () => {
    try {
      console.log('[AuthService] Signing out user');
      await auth.signOut();
      console.log('[AuthService] Sign out complete');
    } catch (error) {
      console.error('[AuthService] Error signing out:', error);
      throw error;
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
    return auth.onAuthStateChanged(callback);
  },

  // Legacy methods for backward compatibility (if needed)
  /**
   * @deprecated Use the new methods instead
   */
  sendOTPLegacy: async (phoneNumber) => {
    console.warn('[AuthService] sendOTPLegacy is deprecated, use sendOTP instead');
    return authService.sendOTP(phoneNumber);
  },

  /**
   * @deprecated Use the new methods instead
   */
  verifyOTPLegacy: async (code, routeParams) => {
    console.warn('[AuthService] verifyOTPLegacy is deprecated, use verifyOTP instead');
    return authService.verifyOTP(code, routeParams);
  },

  /**
   * Get user profile from Firestore
   * @param {string} uid - The user ID
   * @returns {Promise<Object>} - The user profile data
   */
  getUserProfile: async (uid) => {
    try {
      console.log('[AuthService] Getting user profile for:', uid);
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      return {
        uid: userDoc.id,
        ...userDoc.data()
      };
    } catch (error) {
      console.error('[AuthService] Error getting user profile:', error);
      throw error;
    }
  }
};

export default authService;
