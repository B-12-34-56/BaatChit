import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { friendRequestService } from '../../services/friendRequestService';
import { getUserById } from '../../services/userService';
import Toast from 'react-native-toast-message';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { Ionicons } from '@expo/vector-icons';

const FriendRequests = () => {
  const [currentUser] = useAuthState(auth);
  const [requests, setRequests] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [acceptedId, setAcceptedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    setLoading(true);
    setError(null);
    
    const q = query(
      collection(db, 'friendRequests'), 
      where('receiverId', '==', currentUser.uid), 
      where('status', '==', 'pending')
    );
    
    const unsub = onSnapshot(q, 
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
          setRequests(withUserInfo);
          setError(null);
        } catch (err) {
          console.error('Error processing friend requests:', err);
          setError('Error loading friend requests');
          Toast.show({
            type: 'error',
            text1: 'Error loading friend requests',
          });
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        if (!isMounted) return;
        console.error('FriendRequests listener error:', error);
        setError('Error loading friend requests');
        Toast.show({
          type: 'error',
          text1: 'Error loading friend requests',
        });
        setLoading(false);
      }
    );
    
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  const handleAccept = async (id) => {
    setLoadingId(id);
    try {
      const result = await friendRequestService.acceptFriendRequest(id, currentUser.uid);
      if (!result.success) {
        Toast.show({
          type: 'error',
          text1: 'Error: ' + (result.message || 'Failed to accept request'),
        });
        setLoadingId(null);
        return;
      }
      setAcceptedId(id);
      Toast.show({
        type: 'success',
        text1: 'Friend request accepted!',
      });
      
      // Remove the request from local state immediately
      setRequests(prevRequests => prevRequests.filter(req => req.id !== id));
      
      setTimeout(() => setAcceptedId(null), 1200);
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error accepting request: ' + err.message,
      });
    }
    setLoadingId(null);
  };
  
  const handleReject = async (id) => {
    setLoadingId(id);
    try {
      const result = await friendRequestService.rejectFriendRequest(id, currentUser.uid);
      if (!result.success) {
        Toast.show({
          type: 'error',
          text1: 'Error: ' + (result.message || 'Failed to reject request'),
        });
        setLoadingId(null);
        return;
      }
      Toast.show({
        type: 'info',
        text1: 'Friend request rejected.',
      });
      
      // Remove the request from local state immediately
      setRequests(prevRequests => prevRequests.filter(req => req.id !== id));
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error rejecting request: ' + err.message,
      });
    }
    setLoadingId(null);
  };

  const renderRequest = ({ item: req }) => (
    <View style={[
      styles.requestItem,
      { opacity: acceptedId === req.id ? 0.5 : 1 }
    ]}>
      <View style={styles.userInfo}>
        <Image 
          source={{ 
            uri: req.fromUser?.photoURL || 'https://ui-avatars.com/api/?name=' + (req.fromUser?.displayName || 'User') 
          }}
          style={styles.avatar}
        />
        <View style={styles.userDetails}>
          <Text style={styles.userName} numberOfLines={1}>
            {req.fromUser?.displayName || req.from}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {req.fromUser?.email}
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        {acceptedId === req.id ? (
          <View style={styles.acceptedContainer}>
            <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            <Text style={styles.acceptedText}>Accepted</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity 
              onPress={() => handleAccept(req.id)} 
              disabled={loadingId === req.id} 
              style={[
                styles.actionButton,
                styles.acceptButton,
                { opacity: loadingId === req.id ? 0.7 : 1 }
              ]}
            >
              <Ionicons name="checkmark" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleReject(req.id)} 
              disabled={loadingId === req.id} 
              style={[
                styles.actionButton,
                styles.rejectButton,
                { opacity: loadingId === req.id ? 0.7 : 1 }
              ]}
            >
              <Ionicons name="close" size={20} color="white" />
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#667eea" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity 
          style={styles.retryButton}
          onPress={() => setLoading(true)}
        >
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (requests.length === 0) {
    return (
      <Text style={styles.emptyText}>No pending requests</Text>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item) => item.id}
        renderItem={renderRequest}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
      />
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    paddingVertical: 4,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: 'white',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  userDetails: {
    flex: 1,
    marginLeft: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#e53e3e',
  },
  acceptedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceptedText: {
    color: '#4CAF50',
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    padding: 12,
    alignItems: 'center',
  },
  errorContainer: {
    padding: 12,
    alignItems: 'center',
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyText: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    padding: 12,
  },
});

export default FriendRequests;