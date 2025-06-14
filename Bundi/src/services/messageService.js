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
  setDoc,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../utils/firebase';

export const messageService = {
  // Create or get existing conversation between two users
  async createConversation(user1Id, user2Id) {
    try {
      // Sort IDs to ensure consistent conversation ID
      const sortedIds = [user1Id, user2Id].sort();
      const conversationId = `${sortedIds[0]}${sortedIds[1]}`;
      
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
  async sendMessage(conversationId, message, recipientId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      const batch = writeBatch(db);
      
      // Add message to subcollection
      const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
      batch.set(messageRef, {
        text: message.text,
        senderUid: userId,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
        read: false,
        delivered: false,
        edited: false,
        editedAt: null,
        type: message.type || 'text',
        imageUrl: message.imageUrl || null,
        imageHash: message.imageHash || null,
      });
      
      // Update conversation with last message info
      const conversationRef = doc(db, 'conversations', conversationId);
      let conversationSnap = await getDoc(conversationRef);
      if (!conversationSnap.exists()) {
        // Create the conversation if it doesn't exist
        await setDoc(conversationRef, {
          participants: [userId, recipientId],
          createdAt: serverTimestamp(),
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          lastMessageSender: '',
          unreadCount: {
            [userId]: 0,
            [recipientId]: 0
          }
        });
        conversationSnap = await getDoc(conversationRef);
      }
      const conversationData = conversationSnap.data() || {};
      const unreadCount = conversationData.unreadCount || {};
      
      // Update unread count for the other participant
      const otherUserId = recipientId;
      const currentUnreadCount = unreadCount[otherUserId] || 0;
      
      batch.update(conversationRef, {
        lastMessage: message.text,
        lastMessageTime: serverTimestamp(),
        lastMessageSender: userId,
        [`unreadCount.${otherUserId}`]: currentUnreadCount + 1,
        typing: {
          [userId]: false,
          [otherUserId]: false
        }
      });
      
      // Update userChats for sender
      const senderUserChatsRef = doc(db, 'userChats', userId);
      batch.set(senderUserChatsRef, {
        [conversationId]: {
          userInfo: {
            uid: otherUserId,
            displayName: message.recipientDisplayName || 'Unknown',
            photoURL: message.recipientPhotoURL || null,
          },
          date: serverTimestamp(),
          lastMessage: message.text,
        }
      }, { merge: true });
      
      // Update userChats for recipient
      const recipientUserChatsRef = doc(db, 'userChats', otherUserId);
      batch.set(recipientUserChatsRef, {
        [conversationId]: {
          userInfo: {
            uid: userId,
            displayName: message.senderDisplayName || 'Unknown',
            photoURL: message.senderPhotoURL || null,
          },
          date: serverTimestamp(),
          lastMessage: message.text,
        }
      }, { merge: true });
      
      await batch.commit();
      
      console.log('Message sent:', {
        conversationId,
        sender: userId,
        recipient: otherUserId,
        message: message.text
      });
      
      return { success: true, messageId: messageRef.id };
    } catch (error) {
      console.error('Error sending message:', error, {
        conversationId,
        sender: userId,
        recipient: recipientId
      });
      return { success: false, error: error.message };
    }
  },

  // Get messages for a conversation
  async getMessages(conversationId, limitCount = 50) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

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
      throw error;
    }
  },

  // Mark messages as read
  async markAsRead(conversationId, userId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

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
        where('senderUid', '!=', userId),
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
      throw error;
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
        snapshot.docs.map(async (docSnap) => {
          const data = docSnap.data();
          // Get other participant's info
          const otherUserId = data.participants.find(id => id !== userId);
          let otherUser = null;
          if (typeof otherUserId === 'string') {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            otherUser = userDoc.data();
          }
          return {
            id: docSnap.id,
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
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      if (messageData.senderUid !== userId) {
        throw new Error('Not authorized to delete this message');
      }

      await updateDoc(messageRef, {
        deleted: true,
        deletedAt: serverTimestamp()
      });
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting message:', error);
      throw error;
    }
  },

  // Subscribe to real-time message updates
  subscribeToMessages(conversationId, callback, isMountedCheck) {
    const messagesRef = collection(db, 'conversations', conversationId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    
    return onSnapshot(q, 
      (snapshot) => {
        if (isMountedCheck && !isMountedCheck()) return;
        
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
      }, 
      (error) => {
        if (isMountedCheck && !isMountedCheck()) return;
        console.error('Error in message subscription:', error);
      }
    );
  },

  // Subscribe to conversation updates
  subscribeToConversations(userId, callback, isMountedCheck) {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      console.warn('subscribeToConversations called with invalid userId:', userId);
      return () => {};
    }
    
    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participants', 'array-contains', userId),
      orderBy('lastMessageTime', 'desc')
    );
    
    return onSnapshot(q, 
      async (snapshot) => {
        if (isMountedCheck && !isMountedCheck()) return;
        
        const conversations = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const otherUserId = data.participants.find(id => id !== userId);
            let otherUser = null;
            if (typeof otherUserId === 'string') {
              const userDoc = await getDoc(doc(db, 'users', otherUserId));
              otherUser = userDoc.data();
            }
            return {
              id: docSnap.id,
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
      }, 
      (error) => {
        if (isMountedCheck && !isMountedCheck()) return;
        console.error('Error in conversation subscription:', error);
      }
    );
  },

  // Set typing status for a user in a conversation
  async setTypingStatus(conversationId, userId, isTyping) {
    try {
      const conversationRef = doc(db, 'conversations', conversationId);
      const snap = await getDoc(conversationRef);
      if (!snap.exists()) {
        // Create the conversation doc with minimal fields
        await setDoc(conversationRef, {
          participants: [userId],
          typing: { [userId]: isTyping }
        }, { merge: true });
      } else {
        await updateDoc(conversationRef, {
          [`typing.${userId}`]: isTyping
        });
      }
    } catch (error) {
      console.error('Error setting typing status:', error);
    }
  },

  // Subscribe to typing status changes in a conversation
  subscribeToTyping(conversationId, callback) {
    const conversationRef = doc(db, 'conversations', conversationId);
    return onSnapshot(conversationRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback(data.typing || {});
      }
    }, (error) => {
      console.error('Error in typing subscription:', error);
    });
  },

  // Get recent image messages (commented out functionality preserved)
  async getRecentImageMessages(conversationId, limitCount = 20) {
    if (!conversationId || typeof conversationId !== 'string' || !conversationId.trim()) return [];
    try {
      const messagesRef = collection(db, 'conversations', conversationId, 'messages');
      const q = query(
        messagesRef,
        where('type', '==', 'image'),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (err) {
      // Check for Firestore index error
      if (err && err.code === 'failed-precondition' && err.message && err.message.includes('index')) {
        console.error('Firestore index required: Please create a composite index on "type" (asc) and "timestamp" (desc) for conversations/{conversationId}/messages.');
        return [{ error: 'Firestore index required for this query. Please contact support.' }];
      }
      console.error('Error in getRecentImageMessages:', err);
      return [{ error: err.message || 'Unknown error in getRecentImageMessages' }];
    }
  },

  // Get unread message count
  async getUnreadMessageCount(conversationId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      const unreadQuery = query(
        collection(db, 'conversations', conversationId, 'messages'),
        where('senderUid', '!=', userId),
        where('read', '==', false)
      );

      const unreadSnapshot = await getDocs(unreadQuery);
      return unreadSnapshot.size;
    } catch (error) {
      console.error('[MessageService] Error getting unread message count:', error);
      throw error;
    }
  },

  // Update message status
  async updateMessageStatus(messageId, status) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);

      if (!messageDoc.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageDoc.data();
      if (messageData.senderUid !== userId) {
        throw new Error('Not authorized to update this message');
      }

      await updateDoc(messageRef, {
        status,
        updatedAt: serverTimestamp()
      });

      return true;
    } catch (error) {
      console.error('[MessageService] Error updating message status:', error);
      throw error;
    }
  },
};
