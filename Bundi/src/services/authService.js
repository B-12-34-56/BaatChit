import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getAuth, 
  signInAnonymously,
  signOut, 
  onAuthStateChanged as onFirebaseAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { app } from '../utils/firebase';
import { sendOTP, verifyOTP } from '../utils/twilio';
import VerificationManager from './verificationManager';

const auth = getAuth();
const db = getFirestore(app);

/**
 * Normalize a phone number to E.164 format (e.g. "+15551234567")
 */
function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) cleaned = `+${cleaned}`;
  return cleaned;
}

const authService = {
  /**
   * Send OTP to phone number
   * @param {string} phoneNumber - The phone number to send OTP to
   * @returns {Promise<{sid: string, phoneNumber: string}>} - The verification session
   */
  sendOTP: async (phoneNumber) => {
    try {
      console.log('[AuthService] Sending OTP to:', phoneNumber);
      
      // Format phone number to E.164
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      console.log('[AuthService] Formatted phone:', formattedPhone);
      
      // Send OTP via Twilio
      const result = await sendOTP(formattedPhone);
      console.log('[AuthService] Twilio response:', result);
      
      // Store verification session
      const session = {
        phoneNumber: formattedPhone,
        sid: result.sid,
        timestamp: Date.now()
      };
      
      console.log('[AuthService] Storing session:', session);
      await VerificationManager.storeSession(session);
      
      return {
        sid: result.sid,
        phoneNumber: formattedPhone
      };
    } catch (error) {
      console.error('[AuthService] Error sending OTP:', error);
      throw error;
    }
  },

  /**
   * Verify OTP and sign in user
   * @param {string} code - The OTP code to verify
   * @param {Object} routeParams - The route parameters containing verification session
   * @returns {Promise<Object>} - The user data
   */
  verifyOTP: async (code, routeParams) => {
    try {
      console.log('[AuthService] Verifying OTP with params:', { code, routeParams });
      
      // Get verification session from route params or storage
      const session = await VerificationManager.getSession(routeParams);
      console.log('[AuthService] Retrieved session:', session);
      
      if (!session || !VerificationManager.validateSession(session)) {
        console.error('[AuthService] Invalid session:', {
          hasSession: !!session,
          sessionData: session
        });
        throw new Error('Invalid or expired verification session');
      }
      
      // Verify OTP with Twilio
      console.log('[AuthService] Verifying with Twilio:', {
        phoneNumber: session.phoneNumber,
        code
      });
      await verifyOTP(session.phoneNumber, code);
      
      // Sign in anonymously
      console.log('[AuthService] Signing in anonymously');
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      console.log('[AuthService] Anonymous sign in successful:', user.uid);
      
      // Create or update user document
      const userRef = doc(db, 'users', user.uid);
      console.log('[AuthService] Updating user document');
      await setDoc(userRef, {
        phoneNumber: session.phoneNumber,
        lastVerified: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Clear verification session
      console.log('[AuthService] Clearing verification session');
      await VerificationManager.clearSession();
      
      return {
        uid: user.uid,
        phoneNumber: session.phoneNumber
      };
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
      await signOut(auth);
      await VerificationManager.clearSession();
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
    return onFirebaseAuthStateChanged(auth, callback);
  },
};

export default authService;