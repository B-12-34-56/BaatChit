import { db } from '../utils/firebase';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';

// Standard user schema
// {
//   uid: string,
//   email: string,
//   displayName: string,
//   photoURL: string | null,
//   friends: string[],
//   createdAt: timestamp,
//   lastActive: timestamp,
//   isOnline: boolean,
//   bio: string
// }

export async function createUserDocument(user) {
  if (!user?.uid) return;
  
  try {
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || null,
        friends: [],
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        isOnline: false,
        bio: ''
      });
    }
  } catch (error) {
    console.error('Error creating user document:', error);
    throw error;
  }
}

export async function updateUserProfile(uid, data) {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...data,
      lastActive: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
}

export async function getUserById(uid) {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    return userSnap.exists() ? userSnap.data() : null;
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

export async function searchUsersByEmail(email) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
  } catch (error) {
    console.error('Error searching users by email:', error);
    return [];
  }
}

export async function searchUsers(queryStr) {
  try {
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef, 
      where('displayName', '>=', queryStr), 
      where('displayName', '<=', queryStr + '\uf8ff')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => doc.data());
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