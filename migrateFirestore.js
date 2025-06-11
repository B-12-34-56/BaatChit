// migrateFirestore.js
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // Download from Firebase Console

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrate() {
  // 1. Migrate conversations -> chats
  const conversations = await db.collection('conversations').get();
  for (const doc of conversations.docs) {
    const data = doc.data();
    const chatId = doc.id;
    const members = data.participants || [];
    const lastMessage = data.lastMessage ? {
      text: data.lastMessage,
      timestamp: data.lastMessageTime,
      senderId: data.lastMessageSender
    } : null;
    await db.collection('chats').doc(chatId).set({
      members,
      lastMessage,
      createdAt: data.createdAt || admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Migrate messages
    const messages = await db.collection('conversations').doc(chatId).collection('messages').get();
    for (const msgDoc of messages.docs) {
      const msg = msgDoc.data();
      await db.collection('chats').doc(chatId).collection('messages').doc(msgDoc.id).set({
        text: msg.text || '',
        imageUrl: msg.img || msg.imageUrl || '',
        senderId: msg.senderUid,
        timestamp: msg.timestamp || msg.createdAt || admin.firestore.FieldValue.serverTimestamp(),
        seen: msg.read || false,
        seenAt: msg.read ? msg.editedAt || admin.firestore.FieldValue.serverTimestamp() : null
      }, { merge: true });
    }
  }

  // 2. Migrate friendRequests
  const requests = await db.collection('friendRequests').get();
  for (const doc of requests.docs) {
    const data = doc.data();
    await db.collection('friendRequests').doc(doc.id).set({
      from: data.from,
      to: data.receiverId || data.to,
      status: data.status,
      timestamp: data.timestamp || admin.firestore.FieldValue.serverTimestamp(),
      fromUserData: data.fromUserData || {}
    }, { merge: true });
  }

  // 3. Migrate users (ensure friends is an array)
  const users = await db.collection('users').get();
  for (const doc of users.docs) {
    const data = doc.data();
    await db.collection('users').doc(doc.id).set({
      displayName: data.displayName,
      email: data.email,
      photoURL: data.photoURL || '',
      status: data.status || 'offline',
      lastSeen: data.lastSeen || admin.firestore.FieldValue.serverTimestamp(),
      friends: Array.isArray(data.friends) ? data.friends : []
    }, { merge: true });
  }

  console.log('Migration complete!');
}

migrate().catch(console.error);