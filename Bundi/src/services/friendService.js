import { db } from '../utils/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

export async function addFriend(userId, friendId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentFriends = userData.friends || [];
      if (!currentFriends.includes(friendId)) {
        await updateDoc(userRef, {
          friends: [...currentFriends, friendId]
        });
      }
    }
  } catch (error) {
    console.error('Error adding friend:', error);
    throw error;
  }
}

export async function removeFriend(userId, friendId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentFriends = userData.friends || [];
      await updateDoc(userRef, {
        friends: currentFriends.filter(f => f !== friendId)
      });
    }
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
}

export async function getFriends(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      return userSnap.data().friends || [];
    }
    return [];
  } catch (error) {
    console.error('Error getting friends:', error);
    return [];
  }
}