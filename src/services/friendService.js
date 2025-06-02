import { db } from '../utils/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export async function addFriend(userId, friendId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    if (!userData.friends.includes(friendId)) {
      await updateDoc(userRef, {
        friends: [...userData.friends, friendId]
      });
    }
  }
}

export async function removeFriend(userId, friendId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    const userData = userSnap.data();
    await updateDoc(userRef, {
      friends: userData.friends.filter(f => f !== friendId)
    });
  }
}

export async function getFriends(userId) {
  const userRef = doc(db, 'users', userId);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists()) {
    return userSnap.data().friends;
  }
  return [];
} 