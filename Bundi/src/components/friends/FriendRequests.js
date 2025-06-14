import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform
} from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../../utils/firebase';
import { friendRequestService } from '../../services/friendRequestService';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';

const FriendRequests = () => {
  const [currentUser] = useAuthState(auth);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  // Subscribe to real-time friend request updates
  useEffect(() => {
    if (!currentUser?.uid) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Subscribe to incoming requests
    const incomingQuery = query(
      collection(db, 'friendRequests'),
      where('receiverId', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const incomingUnsubscribe = onSnapshot(incomingQuery, async (snapshot) => {
      if (!isMounted) return;

      try {
        const requests = [];
        for (const doc of snapshot.docs) {
          try {
            const data = doc.data();
            const fromUserDoc = await getDoc(doc(db, 'users', data.from));
            if (fromUserDoc.exists()) {
              requests.push({
                id: doc.id,
                ...data,
                fromUser: fromUserDoc.data()
              });
            }
          } catch (err) {
            console.error(`Error processing incoming request ${doc.id}:`, err);
          }
        }
        console.log('Loaded incoming friend requests for', currentUser.uid, requests);
        if (isMounted) {
          setIncomingRequests(requests);
        }
      } catch (err) {
        console.error('Error processing incoming requests:', err);
        if (isMounted) {
          setError('Failed to load incoming requests');
        }
      }
    });

    // Subscribe to outgoing requests
    const outgoingQuery = query(
      collection(db, 'friendRequests'),
      where('from', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const outgoingUnsubscribe = onSnapshot(outgoingQuery, async (snapshot) => {
      if (!isMounted) return;

      try {
        const requests = [];
        for (const doc of snapshot.docs) {
          try {
            const data = doc.data();
            const toUserDoc = await getDoc(doc(db, 'users', data.receiverId));
            if (toUserDoc.exists()) {
              requests.push({
                id: doc.id,
                ...data,
                toUser: toUserDoc.data()
              });
            }
          } catch (err) {
            console.error(`Error processing outgoing request ${doc.id}:`, err);
          }
        }
        console.log('Loaded outgoing friend requests for', currentUser.uid, requests);
        if (isMounted) {
          setOutgoingRequests(requests);
        }
      } catch (err) {
        console.error('Error processing outgoing requests:', err);
        if (isMounted) {
          setError('Failed to load outgoing requests');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    });

    return () => {
      isMounted = false;
      incomingUnsubscribe();
      outgoingUnsubscribe();
    };
  }, [currentUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The real-time listeners will handle the refresh
  }, []);

  const handleAccept = async (requestId, fromUser) => {
    setLoadingId(requestId);
    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }

      const result = await friendRequestService.acceptFriendRequest(requestId, currentUser.uid);
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request accepted',
          text2: `You are now friends with ${fromUser.displayName}`
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('Error accepting friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to accept friend request',
        text2: err.message || 'Please try again later'
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (requestId) => {
    setLoadingId(requestId);
    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      const result = await friendRequestService.rejectFriendRequest(requestId, currentUser.uid);
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request rejected'
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to reject friend request',
        text2: err.message || 'Please try again later'
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (requestId) => {
    setLoadingId(requestId);
    try {
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      const result = await friendRequestService.cancelFriendRequest(requestId, currentUser.uid);
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request cancelled'
        });
      } else {
        throw new Error(result.message);
      }
    } catch (err) {
      console.error('Error cancelling friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to cancel friend request',
        text2: err.message || 'Please try again later'
      });
    } finally {
      setLoadingId(null);
    }
  };

  const renderRequestItem = ({ item, type }) => (
    <View style={styles.requestItem}>
      <Image 
        source={{ 
          uri: type === 'incoming' ? item.fromUser?.photoURL : item.toUser?.photoURL || 
               'https://ui-avatars.com/api/?name=' + (type === 'incoming' ? item.fromUser?.displayName : item.toUser?.displayName || 'User')
        }} 
        style={styles.avatar}
      />
      <View style={styles.requestInfo}>
        <Text style={styles.name}>
          {type === 'incoming' ? item.fromUser?.displayName : item.toUser?.displayName || 'Unknown User'}
        </Text>
        <Text style={styles.email}>
          {type === 'incoming' ? item.fromUser?.email : item.toUser?.email || 'No email'}
        </Text>
      </View>
      <View style={styles.actions}>
        {type === 'incoming' ? (
          <>
            <TouchableOpacity
              onPress={() => handleAccept(item.id, item.fromUser)}
              disabled={loadingId === item.id}
              style={[styles.actionButton, styles.acceptButton]}
            >
              {loadingId === item.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="checkmark" size={24} color="#fff" />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleReject(item.id)}
              disabled={loadingId === item.id}
              style={[styles.actionButton, styles.rejectButton]}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            onPress={() => handleCancel(item.id)}
            disabled={loadingId === item.id}
            style={[styles.actionButton, styles.cancelButton]}
          >
            {loadingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="close" size={24} color="#fff" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      <FlatList
        data={[
          ...incomingRequests.map(req => ({ ...req, type: 'incoming' })),
          ...outgoingRequests.map(req => ({ ...req, type: 'outgoing' }))
        ]}
        renderItem={({ item }) => renderRequestItem({ item, type: item.type })}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#667eea" />
            <Text style={styles.emptyText}>No friend requests</Text>
          </View>
        }
        ListHeaderComponent={
          <>
            {incomingRequests.length > 0 && (
              <Text style={styles.sectionTitle}>Incoming Requests</Text>
            )}
            {outgoingRequests.length > 0 && (
              <Text style={styles.sectionTitle}>Outgoing Requests</Text>
            )}
          </>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  requestInfo: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  email: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#f44336',
  },
  cancelButton: {
    backgroundColor: '#9e9e9e',
  },
  errorText: {
    color: '#f44336',
    textAlign: 'center',
    margin: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
});

export default FriendRequests;