// messageService.js
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  getDocs,
  getDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  limit,
  setDoc
} from 'firebase/firestore';
import { db } from '../utils/firebase';

export const messageService = {
  // Create or get existing conversation between two users
  async createConversation(user1Id, user2Id) {
    try {
      // Sort IDs to ensure consistent conversation ID
      const sortedIds = [user1Id, user2Id].sort();
      const conversationId = `${sortedIds[0]}_${sortedIds[1]}`;
      
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        await setDoc(conversationRef, {
          participants: sortedIds,
          createdAt: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
          unreadCount: {
            [user1Id]: 0,
            [user2Id]: 0
          }
        });
      }
      
      return conversationId;
    } catch (error) {
      console.error('Error creating conversation:', error);
      throw error;
    }
  },

  // Send a message
  async sendMessage(conversationId, message) {
    try {
      const batch = writeBatch(db);
      
      // Add message to subcollection
      const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
      batch.set(messageRef, {
        text: message.text,
        senderUID: message.senderUID,
        timestamp: serverTimestamp(),
        read: false,
        type: message.type || 'text'
      });
      
      // Update conversation with last message info
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      const conversationData = conversationSnap.data();
      
      // Update unread count for the other participant
      const otherUserId = conversationData.participants.find(id => id !== message.senderUID);
      const currentUnreadCount = conversationData.unreadCount?.[otherUserId] || 0;
      
      batch.update(conversationRef, {
        lastMessage: message.text,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: message.senderUID,
        [`unreadCount.${otherUserId}`]: currentUnreadCount + 1
      });
      
      await batch.commit();
      
      return { success: true, messageId: messageRef.id };
    } catch (error) {
      console.error('Error sending message:', error);
      return { success: false, error: error.message };
    }
  },

  // Get messages for a conversation
  async getMessages(conversationId, limitCount = 50) {
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef, 
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Return in chronological order
      return messages.reverse();
    } catch (error) {
      console.error('Error getting messages:', error);
      return [];
    }
  },

  // Mark messages as read
  async markAsRead(conversationId, userId) {
    try {
      const batch = writeBatch(db);
      
      // Reset unread count for this user
      const conversationRef = doc(db, 'conversations', conversationId);
      batch.update(conversationRef, {
        [`unreadCount.${userId}`]: 0
      });
      
      // Mark all unread messages as read
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        where('senderUID', '!=', userId),
        where('read', '==', false)
      );
      
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, { read: true });
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error marking messages as read:', error);
      return { success: false, error: error.message };
    }
  },

  // Get all conversations for a user
  async getConversations(userId) {
    try {
      const conversationsRef = collection(db, 'conversations');
      const q = query(
        conversationsRef,
        where('participants', 'array-contains', userId),
        orderBy('lastMessageTime', 'desc')
      );
      
      const snapshot = await getDocs(q);
      const conversations = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Get other participant's info
          const otherUserId = data.participants.find(id => id !== userId);
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          const otherUser = userDoc.data();
          
          return {
            id: doc.id,
            ...data,
            otherUser: {
              uid: otherUserId,
              displayName: otherUser?.displayName || 'Unknown User',
              photoURL: otherUser?.photoURL || null,
              isOnline: otherUser?.isOnline || false
            },
            unreadCount: data.unreadCount?.[userId] || 0
          };
        })
      );
      
      return conversations;
    } catch (error) {
      console.error('Error getting conversations:', error);
      return [];
    }
  },

  // Delete a message (soft delete)
  async deleteMessage(conversationId, messageId) {
    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      await updateDoc(messageRef, {
        deleted: true,
        deletedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      return { success: false, error: error.message };
    }
  },

  // Subscribe to real-time message updates
  subscribeToMessages(conversationId, callback) {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    return onSnapshot(q, (snapshot) => {
      const messages = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const message = {
            id: change.doc.id,
            ...change.doc.data()
          };
          messages.push(message);
        }
      });
      
      if (messages.length > 0) {
        callback(messages);
      }
    }, (error) => {
      console.error('Error in message subscription:', error);
    });
  },

  // Subscribe to conversation updates
  subscribeToConversations(userId, callback) {
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    );
    
    return onSnapshot(q, async (snapshot) => {
      const conversations = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          
          // Get other participant's info
          const otherUserId = data.participants.find(id => id !== userId);
          const userDoc = await getDoc(doc(db, 'users', otherUserId));
          const otherUser = userDoc.data();
          
          return {
            id: doc.id,
            ...data,
            otherUser: {
              uid: otherUserId,
              displayName: otherUser?.displayName || 'Unknown User',
              photoURL: otherUser?.photoURL || null,
              isOnline: otherUser?.isOnline || false
            },
            unreadCount: data.unreadCount?.[userId] || 0
          };
        })
      );
      
      callback(conversations);
    }, (error) => {
      console.error('Error in conversation subscription:', error);
    });
  },

  async getRecentImageMessages(conversationId, limitCount = 20) {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(
      messagesRef,
      where('type', '==', 'image'),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data());
  }
};