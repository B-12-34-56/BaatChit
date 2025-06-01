import { db } from '../firebase';
import { collection, addDoc, query, where, getDocs, updateDoc, doc, serverTimestamp, deleteDoc } from 'firebase/firestore';

export async function sendRequest(fromUid, toUid) {
  // Prevent sending to self
  if (fromUid === toUid) throw new Error('Cannot send request to yourself');
  // Check for existing pending request
  const q = query(collection(db, 'friendRequests'), where('from', '==', fromUid), where('to', '==', toUid), where('status', '==', 'pending'));
  const existing = await getDocs(q);
  if (!existing.empty) throw new Error('Request already sent');
  return addDoc(collection(db, 'friendRequests'), {
    from: fromUid,
    to: toUid,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
}

export async function acceptRequest(requestId, currentUserUid) {
  const requestRef = doc(db, 'friendRequests', requestId);
  await updateDoc(requestRef, { status: 'accepted' });
  // Add each user to the other's friends array
  const requestSnap = await getDocs(query(collection(db, 'friendRequests'), where('__name__', '==', requestId)));
  if (!requestSnap.empty) {
    const req = requestSnap.docs[0].data();
    const { from, to } = req;
    const userDoc = doc(db, 'users', from);
    const friendDoc = doc(db, 'users', to);
    await updateDoc(userDoc, { friends: from === currentUserUid ? [to] : [from] });
    await updateDoc(friendDoc, { friends: to === currentUserUid ? [from] : [to] });
  }
}

export async function rejectRequest(requestId) {
  const requestRef = doc(db, 'friendRequests', requestId);
  await updateDoc(requestRef, { status: 'rejected' });
}

export async function cancelRequest(requestId) {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

export async function getIncomingRequests(uid) {
  const q = query(collection(db, 'friendRequests'), where('to', '==', uid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function getOutgoingRequests(uid) {
  const q = query(collection(db, 'friendRequests'), where('from', '==', uid), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
} 