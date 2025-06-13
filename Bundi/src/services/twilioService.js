import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOTP, verifyOTP, validatePhoneNumber } from '../utils/twilio';

// Single source of truth for storage keys
const STORAGE_KEYS = {
  VERIFICATION_SESSION: 'twilioVerificationSession',
  VERIFIED_PHONE: 'twilioVerifiedPhone'
};

/**
 * Debug utility to log all AsyncStorage contents
 */
const debugStorage = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    console.log('[STORAGE-DEBUG] All keys:', allKeys);
    
    const allValues = await Promise.all(
      allKeys.map(async (key) => {
        const value = await AsyncStorage.getItem(key);
        return { key, value };
      })
    );
    
    console.log('[STORAGE-DEBUG] All values:', allValues);
  } catch (error) {
    console.error('[STORAGE-DEBUG] Error reading storage:', error);
  }
};

/**
 * Safe AsyncStorage operations with logging
 */
const storage = {
  async setItem(key, value) {
    try {
      await AsyncStorage.setItem(key, value);
      console.log('[STORAGE-WRITE]', key, value);
      // Verify write
      const readBack = await AsyncStorage.getItem(key);
      console.log('[STORAGE-VERIFY]', key, readBack);
      return readBack === value;
    } catch (error) {
      console.error('[STORAGE-ERROR] Write failed:', error);
      throw error;
    }
  },

  async getItem(key) {
    try {
      const value = await AsyncStorage.getItem(key);
      console.log('[STORAGE-READ]', key, value);
      return value;
    } catch (error) {
      console.error('[STORAGE-ERROR] Read failed:', error);
      throw error;
    }
  },

  async removeItem(key) {
    try {
      await AsyncStorage.removeItem(key);
      console.log('[STORAGE-REMOVE]', key);
    } catch (error) {
      console.error('[STORAGE-ERROR] Remove failed:', error);
      throw error;
    }
  },

  async multiRemove(keys) {
    try {
      await AsyncStorage.multiRemove(keys);
      console.log('[STORAGE-MULTI-REMOVE]', keys);
    } catch (error) {
      console.error('[STORAGE-ERROR] Multi-remove failed:', error);
      throw error;
    }
  }
};

/**
 * Service for handling Twilio phone verification
 */
const twilioService = {
  /**
   * Send a verification code to a phone number
   * @param {string} phoneNumber - The phone number to send the code to (in E.164 format)
   * @returns {Promise<{verificationSid: string, phoneNumber: string}>} The verification SID and phone number
   * @throws {Error} If the phone number is invalid or if sending fails
   */
  sendVerificationCode: async (phoneNumber) => {
    try {
      console.log('[TwilioService] Sending verification code to:', phoneNumber);
      
      // Debug current storage state
      await debugStorage();
      
      // Clear any existing verification data
      await storage.multiRemove([
        STORAGE_KEYS.VERIFICATION_SESSION,
        STORAGE_KEYS.VERIFIED_PHONE
      ]);
      
      // Send verification code via Twilio
      const response = await sendOTP(phoneNumber);
      console.log('[TwilioService] Twilio verification response:', response);
      
      if (!response || !response.sid) {
        throw new Error('Invalid response from Twilio');
      }
      
      // Store verification data
      const verificationData = {
        phoneNumber,
        verificationSid: response.sid,
        timestamp: Date.now(),
        attempts: 0
      };
      
      const stored = await storage.setItem(
        STORAGE_KEYS.VERIFICATION_SESSION,
        JSON.stringify(verificationData)
      );
      
      if (!stored) {
        throw new Error('Failed to store verification data');
      }
      
      // Verify storage immediately
      const verificationState = await this.getVerificationState();
      console.log('[TwilioService] Verified storage state:', verificationState);
      
      return {
        verificationSid: response.sid,
        phoneNumber
      };
    } catch (error) {
      console.error('[TwilioService] Error sending verification code:', error);
      // Clear any partial verification data
      await storage.multiRemove([
        STORAGE_KEYS.VERIFICATION_SESSION,
        STORAGE_KEYS.VERIFIED_PHONE
      ]);
      throw new Error(`Failed to send verification code: ${error.message}`);
    }
  },

  /**
   * Check if a verification code is valid
   * @param {string} phoneNumber - The phone number that received the code
   * @param {string} code - The verification code to check
   * @returns {Promise<{valid: boolean, phoneNumber: string}>} The verification result
   * @throws {Error} If verification fails or if no verification is in progress
   */
  checkVerificationCode: async (phoneNumber, code) => {
    try {
      console.log('[TwilioService] Checking verification code for:', phoneNumber);
      
      // Debug current storage state
      await debugStorage();
      
      // Get the stored verification data
      const storedData = await storage.getItem(STORAGE_KEYS.VERIFICATION_SESSION);
      console.log('[TwilioService] Retrieved stored data:', storedData);
      
      if (!storedData) {
        throw new Error('No verification in progress. Please request a new code.');
      }

      const verificationData = JSON.parse(storedData);
      console.log('[TwilioService] Parsed verification data:', verificationData);

      // Check if verification has expired (15 minutes)
      const now = Date.now();
      const verificationAge = now - verificationData.timestamp;
      if (verificationAge > 15 * 60 * 1000) { // 15 minutes in milliseconds
        await storage.removeItem(STORAGE_KEYS.VERIFICATION_SESSION);
        throw new Error('Verification code expired. Please request a new code.');
      }

      // Check phone number match
      if (verificationData.phoneNumber !== phoneNumber) {
        console.error('[TwilioService] Phone number mismatch:', {
          stored: verificationData.phoneNumber,
          current: phoneNumber
        });
        throw new Error('Phone number mismatch. Please start verification again.');
      }

      // Increment attempts
      verificationData.attempts += 1;
      if (verificationData.attempts > 3) {
        await storage.removeItem(STORAGE_KEYS.VERIFICATION_SESSION);
        throw new Error('Too many attempts. Please request a new code.');
      }
      
      const stored = await storage.setItem(
        STORAGE_KEYS.VERIFICATION_SESSION,
        JSON.stringify(verificationData)
      );
      
      if (!stored) {
        throw new Error('Failed to update verification attempts');
      }

      // Verify code with Twilio
      const verificationResult = await verifyOTP(phoneNumber, code);
      console.log('[TwilioService] Verification result:', verificationResult);
      
      if (verificationResult.valid) {
        // Store the verified phone number
        await storage.setItem(STORAGE_KEYS.VERIFIED_PHONE, phoneNumber);
        // Clear verification data
        await storage.removeItem(STORAGE_KEYS.VERIFICATION_SESSION);
      }
      
      return verificationResult;
    } catch (error) {
      console.error('[TwilioService] Error checking verification code:', error);
      throw new Error(`Verification failed: ${error.message}`);
    }
  },

  /**
   * Get the current verification state
   * @returns {Promise<{phoneNumber: string, verificationSid: string, timestamp: number, attempts: number} | null>}
   */
  getVerificationState: async () => {
    try {
      const storedData = await storage.getItem(STORAGE_KEYS.VERIFICATION_SESSION);
      return storedData ? JSON.parse(storedData) : null;
    } catch (error) {
      console.error('[TwilioService] Error getting verification state:', error);
      return null;
    }
  },

  /**
   * Get the verified phone number
   * @returns {Promise<string | null>}
   */
  getVerifiedPhone: async () => {
    try {
      return await storage.getItem(STORAGE_KEYS.VERIFIED_PHONE);
    } catch (error) {
      console.error('[TwilioService] Error getting verified phone:', error);
      return null;
    }
  },

  /**
   * Clear all verification data
   */
  clearVerificationData: async () => {
    try {
      await storage.multiRemove([
        STORAGE_KEYS.VERIFICATION_SESSION,
        STORAGE_KEYS.VERIFIED_PHONE
      ]);
      console.log('[TwilioService] Cleared all verification data');
    } catch (error) {
      console.error('[TwilioService] Error clearing verification data:', error);
    }
  },

  /**
   * Debug utility to check storage state
   */
  debugStorage,

  /**
   * Validate a phone number
   * @param {string} phoneNumber - The phone number to validate
   * @returns {string} The validated phone number in E.164 format
   * @throws {Error} If the phone number is invalid
   */
  validatePhoneNumber
};

export default twilioService; 