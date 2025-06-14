import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  getAuth, 
  signOut, 
  onAuthStateChanged as onFirebaseAuthStateChanged,
  signInWithPhoneNumber,
  signInWithCustomToken,
  RecaptchaVerifier,
  updateProfile,
  signInAnonymously
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

async function sendOTP(phoneNumber) {
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
}

async function verifyOTP(code, session) {
  try {
    console.log('[AuthService] Verifying OTP with session:', session);
    
    if (!session.phoneNumber || !session.verificationSid || !code) {
      throw new Error('Missing required fields: phoneNumber, code, or verificationSid');
    }
    
    // Call Firebase Cloud Function to verify with Twilio
    const verifyPhone = httpsCallable(functions, 'verifyPhoneAndCreateToken');
    const result = await verifyPhone({
      phoneNumber: session.phoneNumber,
      code: code,
      verificationSid: session.verificationSid
    });
    
    console.log('[AuthService] Twilio verification result:', result.data);
    
    if (!result.data || !result.data.success) {
      throw new Error(result.data?.message || 'Verification failed');
    }

    // Sign in with the custom token
    const userCredential = await signInWithCustomToken(auth, result.data.customToken);
    const user = userCredential.user;
    console.log('[AuthService] Signed in with custom token:', user.uid);
    
    // Update user document in Firestore
    await setDoc(doc(db, 'users', user.uid), {
      phoneNumber: session.phoneNumber,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
      twilioVerified: true,
      displayName: session.phoneNumber
    }, { merge: true });
    
    console.log('[AuthService] Firebase user setup complete:', user.uid);
    
    return {
      uid: user.uid,
      phoneNumber: session.phoneNumber,
      user: user,
      isRealFirebaseUser: true
    };
  } catch (error) {
    console.error('[AuthService] Error verifying OTP:', error);
    throw error;
  }
}

async function logout() {
  try {
    console.log('[AuthService] Signing out user');
    await signOut(auth);
    console.log('[AuthService] Sign out complete');
  } catch (error) {
    console.error('[AuthService] Error signing out:', error);
    throw error;
  }
}

function getCurrentUser() {
  return auth.currentUser;
}

function onAuthStateChanged(callback) {
  return auth.onAuthStateChanged(callback);
}

async function getUserProfile(uid) {
  try {
    if (!auth.currentUser) {
      console.error('[AuthService] No authenticated user found');
      return null;
    }

    console.log('[AuthService] Getting user profile for:', uid);
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('[AuthService] User profile not found for uid:', uid);
      
      // Create default user document
      const defaultUserData = {
        uid: uid,
        phoneNumber: auth.currentUser.phoneNumber || '',
        displayName: auth.currentUser.displayName || `User ${uid}`,
        displayNameLower: (auth.currentUser.displayName || `User ${uid}`).toLowerCase(),
        photoURL: auth.currentUser.photoURL || null,
        friends: [],
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        isOnline: false,
        bio: '',
        twilioVerified: true
      };

      try {
        await setDoc(userRef, defaultUserData);
        console.log('[AuthService] Created default user profile for:', uid);
        return defaultUserData;
      } catch (createError) {
        console.error('[AuthService] Error creating default user profile:', createError);
        return null;
      }
    }
    
    const userData = {
      uid: userDoc.id,
      ...userDoc.data()
    };
    console.log('[AuthService] Successfully retrieved user profile:', userData);
    return userData;
  } catch (error) {
    console.error('[AuthService] Error getting user profile:', error);
    return null;
  }
}

async function ensureRealFirebaseUser() {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.error('[AuthService] No user signed in');
      return null;
    }
    
    console.log('[AuthService] Current user:', {
      uid: currentUser.uid,
      phoneNumber: currentUser.phoneNumber,
      isAnonymous: currentUser.isAnonymous
    });
    
    // Get phone number from current user or profile
    let phoneNumber = currentUser.phoneNumber;
    if (!phoneNumber) {
      try {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          phoneNumber = profile.phoneNumber;
        } else {
          console.log('[AuthService] No profile found, using current user phone number');
          phoneNumber = currentUser.phoneNumber;
        }
      } catch (error) {
        console.log('[AuthService] Error getting profile, using current user phone number:', error);
        phoneNumber = currentUser.phoneNumber;
      }
    }
    
    if (!phoneNumber) {
      console.error('[AuthService] No phone number available for user');
      return null;
    }
    
    console.log('[AuthService] Using phone number:', phoneNumber);
    
    // Get a new custom token from the server
    const getCustomToken = httpsCallable(functions, 'getCustomToken');
    const result = await getCustomToken({ phoneNumber });
    
    if (!result.data || !result.data.customToken) {
      console.error('[AuthService] Failed to get custom token');
      return null;
    }
    
    // Sign in with the custom token
    const userCredential = await signInWithCustomToken(auth, result.data.customToken);
    const user = userCredential.user;
    
    // Update user document with new UID
    await setDoc(doc(db, 'users', user.uid), {
      phoneNumber: phoneNumber,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp(),
      twilioVerified: true,
      displayName: phoneNumber
    }, { merge: true });
    
    console.log('[AuthService] Created new real Firebase user:', user.uid);
    return user;
  } catch (error) {
    console.error('[AuthService] Error in ensureRealFirebaseUser:', error);
    return null;
  }
}

const authService = {
  sendOTP,
  verifyOTP,
  logout,
  getCurrentUser,
  onAuthStateChanged,
  getUserProfile,
  ensureRealFirebaseUser
};

export { authService };
export default authService;
 