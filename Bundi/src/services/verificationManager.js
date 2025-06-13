import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc, getFirestore, serverTimestamp } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';

const STORAGE_KEY = 'verificationSession';
const AUTH_STATE_KEY = 'firebaseAuthState';

class VerificationManager {
  /**
   * Store verification session
   * @param {Object} session - The verification session data
   * @returns {Promise<boolean>} - Whether storage was successful
   */
  static async storeSession(session) {
    try {
      console.log('[VerificationManager] Storing session:', session);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      // Add small delay to ensure storage completes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify storage was successful
      const stored = await this.getStoredSession();
      console.log('[VerificationManager] Verified stored session:', stored);
      
      return true;
    } catch (error) {
      console.error('[VerificationManager] Error storing session:', error);
      return false;
    }
  }

  /**
   * Get verification session from storage
   * @returns {Promise<Object|null>} - The stored session or null
   */
  static async getStoredSession() {
    try {
      const session = await AsyncStorage.getItem(STORAGE_KEY);
      console.log('[VerificationManager] Retrieved from storage:', session);
      return session ? JSON.parse(session) : null;
    } catch (error) {
      console.error('[VerificationManager] Error getting session:', error);
      return null;
    }
  }

  /**
   * Clear verification session
   */
  static async clearSession() {
    try {
      console.log('[VerificationManager] Clearing session');
      await AsyncStorage.removeItem(STORAGE_KEY);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Verify session was cleared
      const stored = await this.getStoredSession();
      console.log('[VerificationManager] Verified session cleared:', stored === null);
    } catch (error) {
      console.error('[VerificationManager] Error clearing session:', error);
    }
  }

  /**
   * Get verification session from either route params or storage
   * @param {Object} routeParams - The route parameters
   * @returns {Promise<Object|null>} - The verification session
   */
  static async getSession(routeParams) {
    console.log('[VerificationManager] Getting session from params:', routeParams);
    
    // First check route params
    if (routeParams?.phoneNumber && routeParams?.verificationSid) {
      const session = {
        phoneNumber: routeParams.phoneNumber,
        sid: routeParams.verificationSid,
        timestamp: parseInt(routeParams.timestamp) || Date.now()
      };
      
      console.log('[VerificationManager] Created session from params:', session);
      
      // Store in AsyncStorage for backup
      await this.storeSession(session);
      return session;
    }
    
    // Fall back to AsyncStorage
    const storedSession = await this.getStoredSession();
    console.log('[VerificationManager] Retrieved from storage:', storedSession);
    return storedSession;
  }

  /**
   * Validate verification session
   * @param {Object} session - The session to validate
   * @returns {boolean} - Whether the session is valid
   */
  static validateSession(session) {
    console.log('[VerificationManager] Validating session:', session);
    
    if (!session) {
      console.log('[VerificationManager] Session is null or undefined');
      return false;
    }
    
    const { phoneNumber, sid, timestamp } = session;
    
    if (!phoneNumber || !sid || !timestamp) {
      console.log('[VerificationManager] Missing required fields:', {
        hasPhoneNumber: !!phoneNumber,
        hasSid: !!sid,
        hasTimestamp: !!timestamp
      });
      return false;
    }
    
    // Check if session has expired (15 minutes)
    const now = Date.now();
    const age = now - timestamp;
    const isValid = age <= 15 * 60 * 1000; // 15 minutes in milliseconds
    
    console.log('[VerificationManager] Session age check:', {
      now,
      timestamp,
      age,
      maxAge: 15 * 60 * 1000,
      isValid
    });
    
    return isValid;
  }

  /**
   * Initiate phone verification with Twilio via Firebase Cloud Function
   * @param {string} phoneNumber - The phone number to verify
   * @returns {Promise<Object>} - Verification session data
   */
  static async initiatePhoneVerification(phoneNumber) {
    try {
      console.log('[VerificationManager] Initiating phone verification for:', phoneNumber);
      
      // Call Firebase Cloud Function to start Twilio verification
      const functions = getFunctions();
      const initiateVerification = httpsCallable(functions, 'initiatePhoneVerification');
      const result = await initiateVerification({ phoneNumber });
      
      if (result.data.success) {
        const session = {
          phoneNumber: phoneNumber,
          sid: result.data.verificationSid,
          timestamp: Date.now()
        };
        
        // Store session for later use
        await this.storeSession(session);
        
        console.log('[VerificationManager] Phone verification initiated successfully');
        return session;
      } else {
        throw new Error('Failed to initiate phone verification');
      }
      
    } catch (error) {
      console.error('[VerificationManager] Error initiating phone verification:', error);
      throw error;
    }
  }

  /**
   * Verify OTP and authenticate with Firebase using custom token
   * @param {string} otp - The OTP code entered by user
   * @param {Object} routeParams - Route parameters (optional)
   * @returns {Promise<Object>} - Authentication result
   */
  static async verifyOTPAndAuthenticate(otp, routeParams = null) {
    try {
      console.log('[VerificationManager] Starting OTP verification and authentication');
      
      // Get verification session
      const session = await this.getSession(routeParams);
      
      // Validate session
      const isValidSession = this.validateSession(session);
      console.log('[VerificationManager] Session validation:', {
        hasSession: !!session,
        sessionData: session,
        isValid: isValidSession
      });
      
      if (!isValidSession) {
        console.error('[VerificationManager] Invalid session:', {
          hasSession: !!session,
          sessionData: session
        });
        throw new Error('Invalid or expired verification session');
      }

      // Step 1: Verify OTP with Twilio and get custom token
      console.log('[VerificationManager] Verifying OTP with Twilio...');
      const functions = getFunctions();
      const verifyPhone = httpsCallable(functions, 'verifyPhoneAndCreateToken');
      
      const result = await verifyPhone({
        phoneNumber: session.phoneNumber,
        code: otp,
        verificationSid: session.sid
      });

      if (!result.data.success) {
        throw new Error('OTP verification failed');
      }

      console.log('[VerificationManager] OTP verified successfully, received custom token');

      // Step 2: Sign in with custom token
      const { customToken, uid, phoneNumber } = result.data;
      
      console.log('[VerificationManager] Signing in with custom token...');
      const auth = getAuth();
      const userCredential = await signInWithCustomToken(auth, customToken);
      
      console.log('[VerificationManager] Firebase authentication successful');
      
      // Step 3: Update user document in Firestore
      const db = getFirestore();
      const userRef = doc(db, 'users', userCredential.user.uid);
      await setDoc(userRef, {
        phoneNumber: phoneNumber,
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      // Step 4: Store Firebase auth state
      const authState = {
        uid: userCredential.user.uid,
        phoneNumber: phoneNumber,
        displayName: userCredential.user.displayName,
        isNewUser: userCredential.additionalUserInfo?.isNewUser || false,
        authenticatedAt: Date.now()
      };
      
      await this.storeAuthState(authState);
      
      // Step 5: Clear verification session (keep auth state)
      await this.clearSession();
      
      // Step 6: Return user data
      return {
        success: true,
        user: authState
      };
      
    } catch (error) {
      console.error('[VerificationManager] Error verifying OTP:', error);
      
      // Clear session on error
      await this.clearSession();
      
      // Handle specific error types
      if (error.code === 'functions/permission-denied') {
        throw new Error('Invalid verification code');
      } else if (error.code === 'functions/invalid-argument') {
        throw new Error('Invalid verification data');
      } else if (error.code === 'auth/invalid-custom-token') {
        throw new Error('Authentication failed - invalid token');
      } else {
        throw new Error(error.message || 'Verification failed');
      }
    }
  }

  /**
   * Store Firebase authentication state
   * @param {Object} authState - The authentication state to store
   */
  static async storeAuthState(authState) {
    try {
      console.log('[VerificationManager] Storing auth state:', authState);
      await AsyncStorage.setItem(AUTH_STATE_KEY, JSON.stringify(authState));
    } catch (error) {
      console.error('[VerificationManager] Error storing auth state:', error);
    }
  }

  /**
   * Get stored Firebase authentication state
   * @returns {Promise<Object|null>} - The stored auth state or null
   */
  static async getStoredAuthState() {
    try {
      const authState = await AsyncStorage.getItem(AUTH_STATE_KEY);
      return authState ? JSON.parse(authState) : null;
    } catch (error) {
      console.error('[VerificationManager] Error getting auth state:', error);
      return null;
    }
  }

  /**
   * Clear Firebase authentication state
   */
  static async clearAuthState() {
    try {
      console.log('[VerificationManager] Clearing auth state');
      await AsyncStorage.removeItem(AUTH_STATE_KEY);
    } catch (error) {
      console.error('[VerificationManager] Error clearing auth state:', error);
    }
  }

  /**
   * Get current authenticated user
   * @returns {Object|null} - Current user or null
   */
  static getCurrentUser() {
    const auth = getAuth();
    const user = auth.currentUser;
    if (user) {
      return {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        displayName: user.displayName,
        email: user.email
      };
    }
    return null;
  }

  /**
   * Sign out current user
   * @returns {Promise<void>}
   */
  static async signOut() {
    try {
      const auth = getAuth();
      await signOut(auth);
      await this.clearSession();
      await this.clearAuthState();
      console.log('[VerificationManager] User signed out successfully');
    } catch (error) {
      console.error('[VerificationManager] Error signing out:', error);
      throw error;
    }
  }

  /**
   * Listen for authentication state changes
   * @param {Function} callback - Callback function to handle auth state changes
   * @returns {Function} - Unsubscribe function
   */
  static onAuthStateChanged(callback) {
    const auth = getAuth();
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        callback({
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
          email: user.email
        });
      } else {
        callback(null);
      }
    });
  }
}

export default VerificationManager;
