import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { friendRequestService } from '../../services/friendRequestService';
import { messageService } from '../../services/messageService';
import { getUserById } from '../../services/userService';
import { ChatContext } from '../../context/ChatContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

const FriendRequests = () => {
  const [currentUser] = useAuthState(auth);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [loadingId, setLoadingId] = useState(null);
  const [chatLoading, setChatLoading] = useState('');
  const { dispatch } = useContext(ChatContext);

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
    
    const incomingUnsub = onSnapshot(incomingQuery, 
      async (snapshot) => {
        if (!isMounted) return;
        
        try {
          const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const withUserInfo = await Promise.all(reqs.map(async req => {
            try {
              const user = await getUserById(req.from);
              return { ...req, fromUser: user };
            } catch (err) {
              console.error('Error fetching user info:', err);
              return { ...req, fromUser: null };
            }
          }));
          setIncomingRequests(withUserInfo);
        } catch (err) {
          console.error('Error processing incoming requests:', err);
          setError('Error loading incoming requests');
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error('Incoming requests listener error:', error);
        setError('Error loading incoming requests');
      }
    );

    // Subscribe to outgoing requests
    const outgoingQuery = query(
      collection(db, 'friendRequests'),
      where('from', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const outgoingUnsub = onSnapshot(outgoingQuery,
      async (snapshot) => {
        if (!isMounted) return;
        
        try {
          const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const withUserInfo = await Promise.all(reqs.map(async req => {
            try {
              const user = await getUserById(req.receiverId);
              return { ...req, toUser: user };
            } catch (err) {
              console.error('Error fetching user info:', err);
              return { ...req, toUser: null };
            }
          }));
          setOutgoingRequests(withUserInfo);
        } catch (err) {
          console.error('Error processing outgoing requests:', err);
          setError('Error loading outgoing requests');
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error('Outgoing requests listener error:', error);
        setError('Error loading outgoing requests');
        setLoading(false);
      }
    );
    
    return () => {
      isMounted = false;
      incomingUnsub();
      outgoingUnsub();
    };
  }, [currentUser]);

  const handleAccept = async (requestId, fromUser) => {
    if (loadingId) return;
    setLoadingId(requestId);
    
    try {
      const result = await friendRequestService.acceptFriendRequest(requestId, currentUser.uid);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request accepted!',
        });
        if (Platform.OS === 'ios') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to accept request',
        text2: error.message,
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (requestId) => {
    if (loadingId) return;
    setLoadingId(requestId);
    
    try {
      await friendRequestService.rejectFriendRequest(requestId);
      Toast.show({
        type: 'success',
        text1: 'Friend request rejected',
      });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error rejecting friend request:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to reject request',
        text2: error.message,
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleCancel = async (requestId) => {
    if (loadingId) return;
    setLoadingId(requestId);
    
    try {
      await friendRequestService.cancelFriendRequest(requestId);
      Toast.show({
        type: 'success',
        text1: 'Friend request cancelled',
      });
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Error cancelling friend request:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to cancel request',
        text2: error.message,
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
      
      {incomingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Incoming Requests</Text>
          <FlatList
            data={incomingRequests}
            renderItem={(item) => renderRequestItem({ ...item, type: 'incoming' })}
            keyExtractor={item => item.id}
            style={styles.list}
          />
        </View>
      )}

      {outgoingRequests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Outgoing Requests</Text>
          <FlatList
            data={outgoingRequests}
            renderItem={(item) => renderRequestItem({ ...item, type: 'outgoing' })}
            keyExtractor={item => item.id}
            style={styles.list}
          />
        </View>
      )}

      {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
        <View style={styles.emptyContainer}>
          <Ionicons name="people-outline" size={48} color="#667eea" />
          <Text style={styles.emptyText}>No friend requests</Text>
        </View>
      )}
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
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginVertical: 8,
  },
  list: {
    flex: 1,
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