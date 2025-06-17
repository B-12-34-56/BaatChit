import React, { useState, useEffect, useCallback, useContext } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Alert,
  TextInput,
  Modal,
  Platform
} from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../../utils/firebase';
import { friendRequestService } from '../../services/friendRequestService';
import { userService } from '../../services/userService';
import { messageService } from '../../services/messageService';
import { ChatContext } from '../../context/ChatContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { doc, onSnapshot, collection, query, where, getDocs, runTransaction, getDoc } from 'firebase/firestore';

const FriendList = () => {
  const [currentUser] = useAuthState(auth);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [chatLoading, setChatLoading] = useState('');
  const { dispatch } = useContext(ChatContext);

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(0);

  // Subscribe to real-time friend updates
  useEffect(() => {
    if (!currentUser?.uid) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    // Subscribe to user document for friend list updates
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, async (userDoc) => {
      if (!isMounted) return;

      try {
        if (!userDoc.exists()) {
          console.log('User document not found');
          setFriends([]);
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const friendUids = userData.friends || [];
        console.log('Friend UIDs:', friendUids);

        if (!friendUids.length) {
          console.log('No friends found');
          setFriends([]);
          setLoading(false);
          return;
        }

        // Get friend documents one by one
        const friendsList = [];
        for (const friendUid of friendUids) {
          try {
            const friendDoc = await getDoc(doc(db, 'users', friendUid));
            if (friendDoc.exists()) {
              friendsList.push({
                uid: friendDoc.id,
                ...friendDoc.data()
              });
            }
          } catch (err) {
            console.error(`Error fetching friend ${friendUid}:`, err);
            // Continue with other friends even if one fails
          }
        }

        if (isMounted) {
          setFriends(friendsList);
          setError(null);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching friends:', err);
        if (isMounted) {
          setError('Failed to load friends');
          setLoading(false);
          setRefreshing(false);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }, (error) => {
      console.error('Error in friends listener:', error);
      if (isMounted) {
        setError('Failed to load friends');
        setLoading(false);
        setRefreshing(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [currentUser]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The real-time listener will handle the refresh
  }, []);

  const handleRemoveFriend = async (friend) => {
    Alert.alert(
      'Remove Friend',
      `Are you sure you want to remove ${friend.displayName} from your friends?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              if (Platform.OS === 'ios') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              }
              
              const result = await friendRequestService.removeFriend(currentUser.uid, friend.uid);
              
              if (result.success) {
                Toast.show({
                  type: 'success',
                  text1: 'Friend removed successfully',
                  text2: 'You can add them back anytime'
                });
              } else {
                throw new Error(result.message);
              }
            } catch (err) {
              console.error('Error removing friend:', err);
              Toast.show({
                type: 'error',
                text1: 'Failed to remove friend',
                text2: err.message || 'Please try again later'
              });
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleStartChat = async (friend) => {
    setChatLoading(friend.uid);
    try {
      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      
      // Create/get conversation using transaction
      const conversationId = await runTransaction(db, async (transaction) => {
        const conversationId = [currentUser.uid, friend.uid].sort().join('_');
        const conversationRef = doc(db, 'conversations', conversationId);
        const conversationDoc = await transaction.get(conversationRef);
        
        if (!conversationDoc.exists()) {
          transaction.set(conversationRef, {
            participants: [currentUser.uid, friend.uid],
            createdAt: new Date(),
            lastMessage: null,
            lastMessageTime: null
          });
        }
        
        return conversationId;
      });
      
      // Update chat context to open the chat
      dispatch({
        type: 'CHANGE_USER',
        payload: {
          uid: friend.uid,
          displayName: friend.displayName,
          photoURL: friend.photoURL,
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
        text1: 'Failed to start chat',
        text2: err.message || 'Please try again later'
      });
    } finally {
      setChatLoading('');
    }
  };

  const handleAddFriend = async () => {
    if (!phoneNumber.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Please enter a phone number',
      });
      return;
    }

    setAddingFriend(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // First, find the user by phone number
      const user = await userService.searchUsersByPhone(phoneNumber);
      
      if (!user || user.length === 0) {
        Toast.show({
          type: 'error',
          text1: 'No user found with this phone number',
        });
        return;
      }

      const targetUser = user[0];
      
      // Check if already friends
      const isFriend = friends.some(f => f.uid === targetUser.uid);
      if (isFriend) {
        Toast.show({
          type: 'error',
          text1: 'Already friends with this user',
        });
        return;
      }

      // Send friend request
      const result = await friendRequestService.sendFriendRequest(currentUser.uid, targetUser.uid);
      
      if (!result.success) {
        Toast.show({
          type: 'error',
          text1: result.message || 'Failed to send friend request',
        });
      } else {
        Toast.show({
          type: 'success',
          text1: 'Friend request sent!',
        });
        setAddModalVisible(false);
        setPhoneNumber('');
      }
    } catch (err) {
      console.error('Error adding friend:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to add friend',
        text2: err.message
      });
    } finally {
      setAddingFriend(false);
    }
  };

  const renderFriend = ({ item: friend, index }) => {
    const isChatLoading = chatLoading === friend.uid;

    return (
      <Animated.View
        style={[
          styles.friendItem,
          {
            opacity: fadeAnim,
            transform: [
              { translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [50, 0]
              })}
            ]
          }
        ]}
      >
        <TouchableOpacity
          style={styles.friendInfo}
          onPress={() => handleStartChat(friend)}
          disabled={isChatLoading}
        >
          <Image
            source={{ 
              uri: friend.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(friend.displayName || 'User')}&background=667eea&color=fff&bold=true`
            }}
            style={styles.avatar}
          />
          <View style={styles.friendDetails}>
            <Text style={styles.friendName}>{friend.displayName || 'Unknown User'}</Text>
            <Text style={styles.friendStatus}>
              {friend.isOnline ? 'Online' : 'Offline'}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionButton, styles.chatButton]}
            onPress={() => handleStartChat(friend)}
            disabled={isChatLoading}
          >
            {isChatLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="chatbubble-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveFriend(friend)}
          >
            <Ionicons name="person-remove-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={{ marginTop: 12, color: '#888' }}>Loading friends...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: '#f44336' }}>{error}</Text>
      </View>
    );
  }

  if (!friends.length) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="people-outline" size={48} color="#667eea" />
        <Text style={{ color: '#888', marginTop: 12 }}>No friends yet. Add some friends to start chatting!</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={friends}
        renderItem={renderFriend}
        keyExtractor={item => item.uid}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
      />

      <Modal
        visible={addModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Friend</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter phone number"
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setAddModalVisible(false);
                  setPhoneNumber('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={handleAddFriend}
                disabled={addingFriend}
              >
                {addingFriend ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Add</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  friendInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#667eea',
  },
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 4,
  },
  friendStatus: {
    fontSize: 14,
    color: '#718096',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chatButton: {
    backgroundColor: '#667eea',
  },
  removeButton: {
    backgroundColor: '#f56565',
  },
  errorText: {
    color: '#e53e3e',
    textAlign: 'center',
    margin: 20,
    fontSize: 16,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#718096',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 24,
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 420,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: '#2d3748',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: '#f8fafc',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 100,
  },
  cancelButton: {
    backgroundColor: '#f56565',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default FriendList;