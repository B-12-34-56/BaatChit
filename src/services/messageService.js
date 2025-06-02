import { db } from '../utils/firebase';
import { collection, addDoc, query, orderBy, getDocs, serverTimestamp } from 'firebase/firestore';

export async function sendMessage(conversationId, senderId, text) {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  await addDoc(messagesRef, {
    senderId,
    text,
    createdAt: serverTimestamp()
  });
}

export async function getMessages(conversationId) {
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
} 