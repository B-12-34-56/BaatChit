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
  arrayRemove,
  serverTimestamp,
  writeBatch,
  setDoc,
  runTransaction,
  Timestamp
} from 'firebase/firestore';
import { db } from '../utils/firebase';
import { auth } from '../utils/firebase';

export const friendRequestService = {
  // Send a friend request
  async sendFriendRequest(toUID) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      // Check if recipient exists
      const recipientDoc = await getDoc(doc(db, 'users', toUID));
      if (!recipientDoc.exists()) {
        throw new Error('Recipient not found');
      }

      // Create friend request
      const requestData = {
        from: userId,
        receiverId: toUID,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        const userDoc = await transaction.get(doc(db, 'users', userId));
        if (!userDoc.exists()) {
          throw new Error('User not found');
        }

        // Check if request already exists
        const existingRequest = await getDoc(
          query(
            collection(db, 'friendRequests'),
            where('from', '==', userId),
            where('receiverId', '==', toUID),
            where('status', 'in', ['pending', 'accepted'])
          )
        );

        if (!existingRequest.empty) {
          throw new Error('Friend request already exists');
        }

        // Create the request
        const requestRef = doc(collection(db, 'friendRequests'));
        transaction.set(requestRef, requestData);
      });

      return requestData;
    } catch (error) {
      console.error('[FriendRequestService] Error sending friend request:', error);
      throw error;
    }
  },

  // Accept a friend request
  async acceptFriendRequest(requestId) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      const requestRef = doc(db, 'friendRequests', requestId);
      const requestDoc = await getDoc(requestRef);

      if (!requestDoc.exists()) {
        throw new Error('Friend request not found');
      }

      const requestData = requestDoc.data();
      if (requestData.receiverId !== userId) {
        throw new Error('Not authorized to accept this request');
      }

      if (requestData.status !== 'pending') {
        throw new Error('Friend request is not pending');
      }

      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        const senderRef = doc(db, 'users', requestData.from);
        const recipientRef = doc(db, 'users', requestData.receiverId);

        // Update request status
        transaction.update(requestRef, {
          status: 'accepted',
          updatedAt: serverTimestamp()
        });

        // Add to friends list for both users
        transaction.update(senderRef, {
          friends: arrayUnion(requestData.receiverId)
        });
        transaction.update(recipientRef, {
          friends: arrayUnion(requestData.from)
        });
      });

      return true;
    } catch (error) {
      console.error('[FriendRequestService] Error accepting friend request:', error);
      throw error;
    }
  },

  // Remove a friend
  async removeFriend(friendUID) {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const userId = user.uid;

    try {
      // Use transaction to ensure atomicity
      await runTransaction(db, async (transaction) => {
        const currentUserRef = doc(db, 'users', userId);
        const friendRef = doc(db, 'users', friendUID);

        // Remove from friends list for both users
        transaction.update(currentUserRef, {
          friends: arrayRemove(friendUID)
        });
        transaction.update(friendRef, {
          friends: arrayRemove(userId)
        });

        // Delete any existing friend requests
        const requestsQuery = query(
          collection(db, 'friendRequests'),
          where('from', 'in', [userId, friendUID]),
          where('receiverId', 'in', [userId, friendUID]),
          where('status', 'in', ['pending', 'accepted'])
        );

        const requestsSnapshot = await getDocs(requestsQuery);
        requestsSnapshot.forEach((doc) => {
          transaction.delete(doc.ref);
        });
      });

      return true;
    } catch (error) {
      console.error('[FriendRequestService] Error removing friend:', error);
      throw error;
    }
  },

  // Cleanup stale friend requests
  async cleanupFriendRequests() {
    try {
      const batch = writeBatch(db);
      const now = Date.now();
      
      // Find and clean up old pending requests
      const oldRequestsQuery = query(
        collection(db, 'friendRequests'),
        where('status', '==', 'pending'),
        where('timestamp', '<', Timestamp.fromMillis(now - 7 * 24 * 60 * 60 * 1000)) // 7 days old
      );
      
      const oldRequests = await getDocs(oldRequestsQuery);
      oldRequests.docs.forEach(doc => {
        batch.update(doc.ref, { status: 'expired' });
      });
      
      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error cleaning up friend requests:', error);
      return { success: false, message: error.message };
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
      if (!userDoc.exists()) {
        console.log('User document not found');
        return [];
      }
      
      const userData = userDoc.data();
      const friendUIDs = userData?.friends || [];
      
      if (!friendUIDs.length) {
        console.log('No friends found for user');
        return [];
      }
      
      const friends = [];
      for (const friendUID of friendUIDs) {
        const friendDoc = await getDoc(doc(db, 'users', friendUID));
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();
          friends.push({
            uid: friendUID,
            displayName: friendData.displayName || 'Unknown User',
            email: friendData.email || '',
            photoURL: friendData.photoURL || null,
            phoneNumber: friendData.phoneNumber || null
          });
        }
      }
      
      return friends;
    } catch (error) {
      console.error('Error getting friends:', error);
      throw error;
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
};