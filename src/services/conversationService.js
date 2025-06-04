import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../utils/firebase";

export async function getOrCreateConversation(uidA, uidB) {
  const [user1, user2] = [uidA, uidB].sort();
  const convId = `${user1}_${user2}`;
  const convRef = doc(db, "conversations", convId);

  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) {
    await setDoc(convRef, {
      participants: [user1, user2],
      lastMessageTime: null,
      createdAt: serverTimestamp(),
    });
  }
  return convId;
} 