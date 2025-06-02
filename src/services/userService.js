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
}

export async function updateUserProfile(uid, data) {
  const userRef = doc(db, 'users', uid);
  await updateDoc(userRef, {
    ...data,
    lastActive: serverTimestamp()
  });
}

export async function getUserById(uid) {
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  return userSnap.exists() ? userSnap.data() : null;
}

export async function searchUsers(queryStr) {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('displayName', '>=', queryStr), where('displayName', '<=', queryStr + '\uf8ff'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => doc.data());
} 