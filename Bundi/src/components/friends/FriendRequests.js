import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert, ActivityIndicator, Platform } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
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
  const [requests, setRequests] = useState([]);
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

  const handleAccept = async (id, fromUser) => {
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
      Toast.show({
        type: 'success',
        text1: 'Friend request accepted!',
      });
      
      // Remove the request from local state immediately
      setRequests(prevRequests => prevRequests.filter(req => req.id !== id));
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

  const handleStartChat = async (user) => {
    setChatLoading(user.uid);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Create/get conversation
      const conversationId = await messageService.createConversation(currentUser.uid, user.uid);
      
      // Update chat context to open the chat
      dispatch({
        type: 'CHANGE_USER',
        payload: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          chatId: conversationId
        }
      });
      
      Toast.show({
        type: 'success',
        text1: 'Chat started!',
      });
    } catch (err) {
      console.error('Error starting chat:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to start chat: ' + (err.message || 'Unknown error'),
      });
    }
    setChatLoading('');
  };

  const renderRequest = ({ item }) => {
    const { id, fromUser } = item;
    const isLoading = loadingId === id;
    const isChatLoading = chatLoading === fromUser?.uid;

    return (
      <View style={styles.requestItem}>
        <TouchableOpacity
          style={styles.requestContent}
          onPress={() => handleStartChat(fromUser)}
        >
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
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.acceptButton]}
            onPress={() => handleAccept(id, fromUser)}
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
        </View>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Friend Requests</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.loadingText}>Loading requests...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#fff" />
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
          <Ionicons name="people-outline" size={48} color="#fff" />
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
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  requestsList: {
    padding: 16,
  },
  requestItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
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
    color: '#fff',
    marginBottom: 2,
  },
  requestText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
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
});

export default FriendRequests;