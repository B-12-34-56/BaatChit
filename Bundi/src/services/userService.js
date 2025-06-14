import { db, auth } from '../utils/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Standard user schema
// {
//   uid: string,
//   phoneNumber: string,
//   displayName: string,
//   photoURL: string | null,
//   friends: string[],
//   createdAt: timestamp,
//   lastActive: timestamp,
//   isOnline: boolean,
//   bio: string
// }

export async function createUserDocument(user) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      uid: userId,
      phoneNumber: user.phoneNumber,
      displayName: user.displayName || `User ${userId}`,
      displayNameLower: (user.displayName || `User ${userId}`).toLowerCase(),
      photoURL: user.photoURL || null,
      friends: [],
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp(),
      isOnline: false,
      bio: '',
      twilioVerified: true
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error creating user document:', error);
    throw error;
  }
}

export async function updateUserProfile(uid, updates) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  if (uid !== userId) {
    throw new Error('Not authorized to update this profile');
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error updating user profile:', error);
    throw error;
  }
}

export async function getUserById(uid) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      return null;
    }
    
    return {
      uid: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('[UserService] Error getting user by ID:', error);
    throw error;
  }
}

export async function searchUsersByphoneNumber(phoneNumber) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNumber', '==', phoneNumber.toLowerCase()));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }
    
    const userDoc = querySnapshot.docs[0];
    return {
      uid: userDoc.id,
      ...userDoc.data()
    };
  } catch (error) {
    console.error('[UserService] Error searching users by phoneNumber:', error);
    throw error;
  }
}

export async function searchUsers(queryStr) {
  try {
    const usersRef = collection(db, 'users');
    let results = [];

    // Normalize the query string
    const normalizedQuery = queryStr.trim().toLowerCase();
    console.log('searchUsers input:', queryStr, 'normalized:', normalizedQuery);

    // Search by phone number
    if (normalizedQuery.includes('+') || /^\d+$/.test(normalizedQuery)) {
      // Format phone number to E.164 format
      let phoneNumber = normalizedQuery;
      if (!phoneNumber.startsWith('+')) {
        // Remove any non-digit characters
        phoneNumber = phoneNumber.replace(/\D/g, '');
        // If it starts with 1 and is 11 digits, remove it
        if (phoneNumber.length === 11 && phoneNumber.startsWith('1')) {
          phoneNumber = phoneNumber.substring(1);
        }
        // Add +1 prefix if not present
        if (!phoneNumber.startsWith('+')) {
          phoneNumber = `+1${phoneNumber}`;
        }
      }
      console.log('Searching for phoneNumber:', phoneNumber);
      const phoneQuery = query(usersRef, where('phoneNumber', '==', phoneNumber));
      const phoneSnapshot = await getDocs(phoneQuery);
      results = [...results, ...phoneSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }))];
      // Also try searching without +1 in case it's stored differently
      if (phoneNumber.startsWith('+1')) {
        const altPhone = phoneNumber.replace('+1', '');
        const altQuery = query(usersRef, where('phoneNumber', '==', altPhone));
        const altSnapshot = await getDocs(altQuery);
        results = [...results, ...altSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }))];
      }
    }

    // Search by email
    if (normalizedQuery.includes('@')) {
      const emailQuery = query(usersRef, where('email', '==', normalizedQuery));
      const emailSnapshot = await getDocs(emailQuery);
      results = [...results, ...emailSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }))];
    }

    // Search by display name (only if query is at least 2 characters)
    if (normalizedQuery.length >= 2) {
      // Create a compound query for case-insensitive search
      const nameQuery = query(
        usersRef,
        where('displayNameLower', '>=', normalizedQuery),
        where('displayNameLower', '<=', normalizedQuery + '\uf8ff')
      );
      const nameSnapshot = await getDocs(nameQuery);
      results = [...results, ...nameSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }))];
    }

    // Remove duplicates based on uid
    const uniqueResults = Array.from(new Map(results.map(item => [item.uid, item])).values());
    console.log('searchUsers results:', uniqueResults);
    return uniqueResults;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

/**
 * Set user online status
 * @param {string} uid - User ID
 * @param {boolean} isOnline - Online status
 */
export async function setUserOnlineStatus(uid, isOnline) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      isOnline,
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error('Error setting user online status:', error);
    throw error;
  }
}

/**
 * Update user's last active timestamp
 * @param {string} uid - User ID
 */
export async function updateLastActive(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating last active:', error);
    throw error;
  }
}

export async function updateUserStatus(isOnline) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isOnline,
      lastActive: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error updating user status:', error);
    throw error;
  }
}

export async function updateUserLastActive() {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      lastActive: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error updating user last active:', error);
    throw error;
  }
}

export async function updateUserDisplayName(displayName) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      displayName,
      displayNameLower: displayName.toLowerCase(),
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error updating user display name:', error);
    throw error;
  }
}

export async function updateUserBio(bio) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      bio,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error updating user bio:', error);
    throw error;
  }
}

export async function updateUserPhotoURL(photoURL) {
  const currentUser = auth.currentUser;
  if (!currentUser) throw new Error('Not authenticated');
  const userId = currentUser.uid;

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      photoURL,
      updatedAt: serverTimestamp()
    });
    return true;
  } catch (error) {
    console.error('[UserService] Error updating user photo URL:', error);
    throw error;
  }
}