// FriendRequestsDropdown.js - React Native conversion of FriendRequestsDropdown.jsx
import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Modal, 
  FlatList, 
  Image, 
  StyleSheet, 
  Alert,
  Animated,
  Dimensions,
  Platform,
  ActivityIndicator
} from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { db } from '../utils/firebase';
import { collection, query, where, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { friendRequestService } from '../services/friendRequestService';
import { getUserById } from '../services/userService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const FriendRequestsDropdown = () => {
  const [currentUser] = useAuthState(auth);
  const [requests, setRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [acceptedId, setAcceptedId] = useState(null);
  const [newFriend, setNewFriend] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Animation values
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!currentUser?.uid) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Query for incoming friend requests
    const q = query(
      collection(db, 'friendRequests'),
      where('to', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsub = onSnapshot(q, 
      async (snapshot) => {
        if (!isMounted) return;
        
        try {
          const reqs = [];
          for (const doc of snapshot.docs) {
            try {
              const data = doc.data();
              const fromUser = await getDoc(doc(db, 'users', data.from));
              if (fromUser.exists()) {
                reqs.push({
                  id: doc.id,
                  ...data,
                  fromUser: fromUser.data()
                });
              }
            } catch (err) {
              console.error('Error fetching user info:', err);
            }
          }
          
          setRequests(reqs);
          setError(null);

          // Animate badge for new requests
          if (reqs.length > requests.length) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            Animated.sequence([
              Animated.timing(badgeAnim, {
                toValue: 1,
                duration: 200,
                useNativeDriver: true,
              }),
              Animated.timing(badgeAnim, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
              }),
            ]).start();
          }
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
        console.error('FriendRequestsDropdown listener error:', error);
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

  const openModal = () => {
    setModalOpen(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeModal = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setModalOpen(false);
    });
  };

  const handleAccept = async (id) => {
    setLoadingId(id);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  const renderRequest = ({ item }) => {
    const { id, fromUser } = item;
    const isAccepted = acceptedId === id;
    const isLoading = loadingId === id;

    return (
      <Animated.View
        style={[
          styles.requestItem,
          {
            transform: [
              { scale: scaleAnim },
              { translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [SCREEN_WIDTH, 0]
              })}
            ]
          }
        ]}
      >
        <View style={styles.requestContent}>
          <Image
            source={{ 
              uri: fromUser?.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(fromUser?.displayName || 'User')}&background=667eea&color=fff&bold=true`
            }}
            style={styles.avatar}
          />
          <View style={styles.requestInfo}>
            <Text style={styles.requestName}>
              {fromUser?.displayName || 'Unknown User'}
            </Text>
            <Text style={styles.requestText}>
              wants to be your friend
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {isAccepted ? (
            <View style={styles.acceptedBadge}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionButton, styles.acceptButton]}
                onPress={() => handleAccept(id)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Ionicons name="checkmark" size={24} color="#fff" />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.rejectButton]}
                onPress={() => handleReject(id)}
                disabled={isLoading}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={openModal}
        style={styles.button}
        disabled={loading}
      >
        <Ionicons name="people" size={20} color="#667eea" />
        <Text style={styles.buttonText}>Friend Requests</Text>
        {requests.length > 0 && (
          <Animated.View
            style={[
              styles.badge,
              {
                transform: [
                  {
                    scale: badgeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.2]
                    })
                  }
                ]
              }
            ]}
          >
            <Text style={styles.badgeText}>{requests.length}</Text>
          </Animated.View>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalOpen}
        transparent
        animationType="none"
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Friend Requests</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#667eea" />
                <Text style={styles.loadingText}>Loading requests...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Ionicons name="alert-circle" size={24} color="#ff3b30" />
                <Text style={styles.errorText}>{error}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => {
                    setError(null);
                    setLoading(true);
                  }}
                >
                  <Text style={styles.retryButtonText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : requests.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="people-outline" size={48} color="#ccc" />
                <Text style={styles.emptyText}>No pending friend requests</Text>
              </View>
            ) : (
              <FlatList
                data={requests}
                renderItem={renderRequest}
                keyExtractor={(item) => item.id}
                style={styles.requestsList}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  button: {
    padding: 8,
    position: 'relative',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#667eea',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#667eea',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  errorContainer: {
    padding: 40,
    alignItems: 'center',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    padding: 12,
    backgroundColor: '#667eea',
    borderRadius: 8,
    marginTop: 20,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#667eea',
    fontSize: 16,
    marginTop: 12,
  },
  requestsList: {
    maxHeight: 400,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  requestContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  requestInfo: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  requestText: {
    fontSize: 14,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  acceptButton: {
    backgroundColor: '#4CAF50',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  acceptedBadge: {
    padding: 8,
  },
});

export default FriendRequestsDropdown;