import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { friendRequestService } from '../../services/friendRequestService';
import { getUserById } from '../../services/userService';
import Toast from 'react-native-toast-message';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';

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
        <View>
          <Text style={styles.userName}>{req.fromUser?.displayName || req.from}</Text>
          <Text style={styles.userEmail}>{req.fromUser?.email}</Text>
        </View>
      </View>
      <View style={styles.actions}>
        {acceptedId === req.id ? (
          <View style={styles.acceptedContainer}>
            <Text style={styles.acceptedText}>✓ Accepted!</Text>
          </View>
        ) : (
          <>
            <TouchableOpacity 
              onPress={() => handleAccept(req.id)} 
              disabled={loadingId === req.id} 
              style={[
                styles.acceptButton,
                { opacity: loadingId === req.id ? 0.7 : 1 }
              ]}
            >
              <Text style={styles.buttonText}>
                {loadingId === req.id ? 'Accepting...' : 'Accept'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={() => handleReject(req.id)} 
              disabled={loadingId === req.id} 
              style={[
                styles.rejectButton,
                { opacity: loadingId === req.id ? 0.7 : 1 }
              ]}
            >
              <Text style={styles.buttonText}>
                {loadingId === req.id ? 'Rejecting...' : 'Reject'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Incoming Friend Requests</Text>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#667eea" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton}
            onPress={() => setLoading(true)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : requests.length === 0 ? (
        <Text style={styles.emptyText}>No pending requests</Text>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id}
          renderItem={renderRequest}
        />
      )}
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    maxWidth: 420,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 18,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: 13,
    color: '#888',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  rejectButton: {
    backgroundColor: '#e53e3e',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  acceptedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  acceptedText: {
    color: '#4CAF50',
    fontWeight: '700',
    fontSize: 15,
  },
  emptyText: {
    color: '#888',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#e53e3e',
    fontSize: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default FriendRequests;