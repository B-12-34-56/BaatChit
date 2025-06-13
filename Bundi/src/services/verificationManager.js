import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'verificationSession';

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
}

export default VerificationManager; 