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
  Animated,
  Alert,
  TextInput,
  Modal
} from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { friendRequestService } from '../../services/friendRequestService';
import { userService } from '../../services/userService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';

const FriendList = ({ onSelectFriend }) => {
  const [currentUser] = useAuthState(auth);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(0);

  const loadFriends = useCallback(async () => {
    if (!currentUser?.uid) return;
    
    try {
      setError(null);
      const friendsList = await friendRequestService.getFriends(currentUser.uid);
      setFriends(friendsList || []);
    } catch (err) {
      console.error('Error loading friends:', err);
      setError('Failed to load friends');
      Toast.show({
        type: 'error',
        text1: 'Error loading friends',
        text2: err.message
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser]);

  useFocusEffect(
    useCallback(() => {
      loadFriends();
      
      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, [loadFriends])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadFriends();
  }, [loadFriends]);

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
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await friendRequestService.removeFriend(currentUser.uid, friend.uid);
              setFriends(friends.filter(f => f.uid !== friend.uid));
              Toast.show({
                type: 'success',
                text1: 'Friend removed',
              });
            } catch (err) {
              console.error('Error removing friend:', err);
              Toast.show({
                type: 'error',
                text1: 'Failed to remove friend',
                text2: err.message
              });
            }
          },
        },
      ]
    );
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
          onPress={() => onSelectFriend(friend)}
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
              {friend.phoneNumber || friend.status || 'Available'}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => handleRemoveFriend(friend)}
        >
          <Ionicons name="close-circle" size={24} color="#ff4444" />
        </TouchableOpacity>
      </Animated.View>
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
        <Text style={styles.title}>Friends</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
        >
          <Ionicons name="person-add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color="#fff" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={loadFriends}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : friends.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="people" size={48} color="#fff" />
          <Text style={styles.emptyText}>No friends yet</Text>
          <Text style={styles.emptySubtext}>
            Add friends by their phone number to start chatting
          </Text>
          <TouchableOpacity
            style={styles.addFirstButton}
            onPress={() => setAddModalVisible(true)}
          >
            <Text style={styles.addFirstButtonText}>Add Friend</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={friends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.friendsList}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
        />
      )}

      <Modal
        visible={addModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Friend</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setAddModalVisible(false)}
              >
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="call" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter phone number"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <TouchableOpacity
              style={[styles.addFriendButton, addingFriend && styles.addFriendButtonDisabled]}
              onPress={handleAddFriend}
              disabled={addingFriend}
            >
              {addingFriend ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.addFriendButtonText}>Add Friend</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
  emptySubtext: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
    textAlign: 'center',
  },
  addFirstButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  addFirstButtonText: {
    color: '#667eea',
    fontSize: 16,
    fontWeight: '600',
  },
  friendsList: {
    padding: 16,
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  friendInfo: {
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
  friendDetails: {
    flex: 1,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  friendStatus: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  removeButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
  },
  closeButton: {
    padding: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: '#333',
  },
  addFriendButton: {
    backgroundColor: '#667eea',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addFriendButtonDisabled: {
    opacity: 0.7,
  },
  addFriendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default FriendList;