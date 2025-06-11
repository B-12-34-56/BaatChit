// friendRequestService.js - React Native version
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  getDoc,
  deleteDoc,
  arrayUnion,
  serverTimestamp,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db } from '../utils/firebase';

export const friendRequestService = {
  // Send a friend request
  async sendFriendRequest(fromUID, toUID) {
    try {
      // Check if users are the same
      if (fromUID === toUID) {
        throw new Error('Cannot send friend request to yourself');
      }

      // Check if recipient exists
      const recipientDoc = await getDoc(doc(db, 'users', toUID));
      if (!recipientDoc.exists()) {
        throw new Error('User not found');
      }

      // Check for recent request (cooldown)
      const now = Date.now();
      const cooldownQuery = query(
        collection(db, 'friendRequests'),
        where('from', 'in', [fromUID, toUID]),
        where('receiverId', 'in', [fromUID, toUID]),
        where('status', '==', 'pending')
      );
      const cooldownSnap = await getDocs(cooldownQuery);
      for (const docSnap of cooldownSnap.docs) {
        const data = docSnap.data();
        if (data.cooldownUntil && data.cooldownUntil.toMillis() > now) {
          throw new Error('Please wait before sending another friend request.');
        }
      }

      // Check if request already exists (pending)
      const existingQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', fromUID),
        where('receiverId', '==', toUID),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(existingQuery);
      if (!existing.empty) {
        throw new Error('Friend request already sent');
      }

      // Check reverse request (if they already sent one to us)
      const reverseQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', toUID),
        where('receiverId', '==', fromUID),
        where('status', '==', 'pending')
      );
      const reverseExisting = await getDocs(reverseQuery);
      
      if (!reverseExisting.empty) {
        throw new Error('This user has already sent you a friend request');
      }

      // Check if they're already friends
      const userDoc = await getDoc(doc(db, 'users', fromUID));
      const userData = userDoc.data();
      const friends = userData?.friends || []; // Handle undefined friends array
      if (friends.includes(toUID)) {
        throw new Error('Already friends with this user');
      }

      // Create friend request
      const requestRef = await addDoc(collection(db, 'friendRequests'), {
        from: fromUID,
        receiverId: toUID,
        status: 'pending',
        timestamp: serverTimestamp()
      });

      return { success: true, requestId: requestRef.id };
    } catch (error) {
      console.error('Error sending friend request:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to send friend request' 
      };
    }
  },

  // Accept a friend request
  async acceptFriendRequest(requestId, currentUserUID) {
    try {
      const batch = writeBatch(db);
      
      // Get the friend request
      const requestRef = doc(db, 'friendRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Friend request not found');
      }

      const requestData = requestSnap.data();
      
      // Verify the current user is the recipient
      if (requestData.receiverId !== currentUserUID) {
        throw new Error('Unauthorized to accept this request');
      }

      // Update friend request status
      batch.update(requestRef, {
        status: 'accepted',
        acceptedAt: serverTimestamp()
      });

      // Use set with merge instead of update for friends arrays
      const senderRef = doc(db, 'users', requestData.from);
      const recipientRef = doc(db, 'users', requestData.receiverId);
      batch.set(senderRef, { friends: arrayUnion(requestData.receiverId) }, { merge: true });
      batch.set(recipientRef, { friends: arrayUnion(requestData.from) }, { merge: true });

      // Create a conversation document
      const conversationId = [requestData.from, requestData.receiverId].sort().join('_');
      const conversationRef = doc(db, 'conversations', conversationId);
      batch.set(conversationRef, {
        participants: [requestData.from, requestData.receiverId],
        createdAt: serverTimestamp(),
        lastMessage: null,
        lastMessageTime: null
      }, { merge: true });

      await batch.commit();
      
      // Fetch the new friend's user data
      const friendUid = requestData.from === currentUserUID ? requestData.receiverId : requestData.from;
      const friendDoc = await getDoc(doc(db, 'users', friendUid));
      const friendData = friendDoc.exists() ? friendDoc.data() : null;
      
      return { success: true, friend: { uid: friendUid, ...friendData } };
    } catch (error) {
      console.error('Error accepting friend request:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to accept friend request' 
      };
    }
  },

  // Reject a friend request
  async rejectFriendRequest(requestId, currentUserUID) {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Friend request not found');
      }

      const requestData = requestSnap.data();
      
      // Verify the current user is the recipient
      if (requestData.receiverId !== currentUserUID) {
        throw new Error('Unauthorized to reject this request');
      }

      await updateDoc(requestRef, {
        status: 'rejected',
        rejectedAt: serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to reject friend request' 
      };
    }
  },

  // Get incoming friend requests
  async getIncomingRequests(userUID) {
    try {
      const q = query(
        collection(db, 'friendRequests'),
        where('receiverId', '==', userUID),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const requests = [];
      
      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        // Get sender info
        const senderDoc = await getDoc(doc(db, 'users', data.from));
        const senderData = senderDoc.data();
        
        requests.push({
          id: docSnap.id,
          ...data,
          senderInfo: {
            displayName: senderData?.displayName || 'Unknown User',
            email: senderData?.email || '',
            photoURL: senderData?.photoURL || null
          }
        });
      }
      
      return requests;
    } catch (error) {
      console.error('Error getting incoming requests:', error);
      return [];
    }
  },

  // Get outgoing friend requests
  async getOutgoingRequests(userUID) {
    try {
      if (!userUID) {
        console.warn('getOutgoingRequests called without userUID');
        return [];
      }

      const q = query(
        collection(db, 'friendRequests'),
        where('from', '==', userUID),
        where('status', '==', 'pending')
      );
      
      const snapshot = await getDocs(q);
      const requests = [];
      const batch = writeBatch(db);
      let hasChanges = false;
      
      for (const docSnap of snapshot.docs) {
        try {
          const data = docSnap.data();
          
          // Clean up malformed requests
          if (!data?.receiverId) {
            console.warn('Friend request missing receiverId:', docSnap.id);
            // Delete malformed request
            batch.delete(docSnap.ref);
            hasChanges = true;
            continue;
          }

          // Get recipient info
          const recipientDoc = await getDoc(doc(db, 'users', data.receiverId));
          
          // Clean up requests to non-existent users
          if (!recipientDoc.exists()) {
            console.warn('Friend request to non-existent user:', data.receiverId);
            batch.delete(docSnap.ref);
            hasChanges = true;
            continue;
          }

          const recipientData = recipientDoc.data();
          
          requests.push({
            id: docSnap.id,
            from: data.from,
            receiverId: data.receiverId,
            status: data.status,
            timestamp: data.timestamp,
            recipientInfo: {
              displayName: recipientData?.displayName || 'Unknown User',
              email: recipientData?.email || '',
              photoURL: recipientData?.photoURL || null,
              uid: data.receiverId
            }
          });
        } catch (err) {
          console.error('Error processing outgoing request:', err);
          // Delete request that caused error
          batch.delete(docSnap.ref);
          hasChanges = true;
          continue;
        }
      }

      // Commit any cleanup changes
      if (hasChanges) {
        try {
          await batch.commit();
          console.log('Cleaned up malformed friend requests');
        } catch (err) {
          console.error('Error cleaning up friend requests:', err);
        }
      }
      
      return requests;
    } catch (error) {
      console.error('Error getting outgoing requests:', error);
      return [];
    }
  },

  // Cancel an outgoing friend request
  async cancelFriendRequest(requestId, currentUserUID) {
    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      const requestSnap = await getDoc(requestRef);
      
      if (!requestSnap.exists()) {
        throw new Error('Friend request not found');
      }

      const requestData = requestSnap.data();
      
      // Verify the current user is the sender
      if (requestData.from !== currentUserUID) {
        throw new Error('Unauthorized to cancel this request');
      }

      await deleteDoc(requestRef);
      return { success: true };
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      return { 
        success: false, 
        message: error.message || 'Failed to cancel friend request' 
      };
    }
  },

  // Check if two users are friends
  async checkFriendship(user1UID, user2UID) {
    try {
      const userDoc = await getDoc(doc(db, 'users', user1UID));
      const userData = userDoc.data();
      return userData?.friends?.includes(user2UID) || false;
    } catch (error) {
      console.error('Error checking friendship:', error);
      return false;
    }
  },

  // Get user's friends list
  async getFriends(userUID) {
    try {
      const userDoc = await getDoc(doc(db, 'users', userUID));
      const userData = userDoc.data();
      const friendUIDs = userData?.friends || [];
      
      const friends = [];
      for (const friendUID of friendUIDs) {
        const friendDoc = await getDoc(doc(db, 'users', friendUID));
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          friends.push({
            uid: friendUID,
            displayName: friendData.displayName || 'Unknown User',
            email: friendData.email || '',
            photoURL: friendData.photoURL || null
          });
        }
      }
      
      return friends;
    } catch (error) {
      console.error('Error getting friends:', error);
      return [];
    }
  },

  // Helper to get friendship status
  async getFriendshipStatus(userId, targetUserId) {
    try {
      // Check if already friends
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists() && userDoc.data()?.friends?.includes(targetUserId)) {
        return 'friends';
      }
      
      // Check for outgoing pending request
      const outgoingQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', userId),
        where('receiverId', '==', targetUserId),
        where('status', '==', 'pending')
      );
      const outgoing = await getDocs(outgoingQuery);
      if (!outgoing.empty) return 'outgoing_pending';
      
      // Check for incoming pending request
      const incomingQuery = query(
        collection(db, 'friendRequests'),
        where('from', '==', targetUserId),
        where('receiverId', '==', userId),
        where('status', '==', 'pending')
      );
      const incoming = await getDocs(incomingQuery);
      if (!incoming.empty) return 'incoming_pending';
      
      return 'none';
    } catch (error) {
      console.error('Error getting friendship status:', error);
      return 'none';
    }
  },

  // Add a new method to clean up all malformed requests
  async cleanupFriendRequests() {
    try {
      const q = query(collection(db, 'friendRequests'));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      let hasChanges = false;

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        
        // Check for malformed requests
        if (!data?.from || !data?.receiverId || !data?.status) {
          console.warn('Found malformed friend request:', docSnap.id);
          batch.delete(docSnap.ref);
          hasChanges = true;
          continue;
        }

        // Check if users exist
        const [fromDoc, toDoc] = await Promise.all([
          getDoc(doc(db, 'users', data.from)),
          getDoc(doc(db, 'users', data.receiverId))
        ]);

        if (!fromDoc.exists() || !toDoc.exists()) {
          console.warn('Found friend request with non-existent users:', docSnap.id);
          batch.delete(docSnap.ref);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await batch.commit();
        console.log('Cleaned up all malformed friend requests');
      }

      return { success: true };
    } catch (error) {
      console.error('Error cleaning up friend requests:', error);
      return { success: false, error: error.message };
    }
  }
};