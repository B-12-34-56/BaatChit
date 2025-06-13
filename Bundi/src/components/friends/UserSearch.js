import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Keyboard,
  Platform
} from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { ChatContext } from '../../context/ChatContext';
import { friendRequestService } from '../../services/friendRequestService';
import { messageService } from '../../services/messageService';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useDebouncedCallback } from 'use-debounce';
import { userService } from '../../services/userService';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../utils/firebase';

const UserSearch = () => {
  const [currentUser] = useAuthState(auth);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const { dispatch } = useContext(ChatContext);
  const [chatLoading, setChatLoading] = useState('');
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [searchFocused, setSearchFocused] = useState(false);
  const [searchType, setSearchType] = useState('name'); // 'name' or 'phone'

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(0);

  // Debounced search function
  const debouncedSearch = useDebouncedCallback(async (searchQuery) => {
    if (!searchQuery.trim() || !currentUser?.uid) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let searchResults = [];
      
      if (searchType === 'name') {
        // Search by display name (case-insensitive partial match)
        const nameQuery = query(
          collection(db, 'users'),
          where('displayName', '>=', searchQuery.toLowerCase()),
          where('displayName', '<=', searchQuery.toLowerCase() + '\uf8ff')
        );
        const nameSnapshot = await getDocs(nameQuery);
        
        // Also search by email for partial matches
        const emailQuery = query(
          collection(db, 'users'),
          where('email', '>=', searchQuery.toLowerCase()),
          where('email', '<=', searchQuery.toLowerCase() + '\uf8ff')
        );
        const emailSnapshot = await getDocs(emailQuery);

        // Combine and deduplicate results
        const nameResults = nameSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }));
        const emailResults = emailSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }));

        // Merge results and remove duplicates
        const mergedResults = [...nameResults, ...emailResults];
        searchResults = mergedResults.filter((user, index, self) =>
          index === self.findIndex((u) => u.uid === user.uid)
        );
      } else {
        // Search by phone number (partial match)
        const phoneQuery = query(
          collection(db, 'users'),
          where('phoneNumber', '>=', searchQuery),
          where('phoneNumber', '<=', searchQuery + '\uf8ff')
        );
        const phoneSnapshot = await getDocs(phoneQuery);
        searchResults = phoneSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data()
        }));
      }

      // Filter out current user and existing friends
      searchResults = searchResults.filter(user => 
        user.uid !== currentUser.uid && 
        !friends.includes(user.uid) &&
        !outgoing.includes(user.uid)
      );

      setResults(searchResults);
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to search users');
      Toast.show({
        type: 'error',
        text1: 'Search failed',
        text2: err.message
      });
    } finally {
      setLoading(false);
    }
  }, 300);

  // Update search results when query changes
  useEffect(() => {
    debouncedSearch(query);
  }, [query, searchType]);

  // Subscribe to real-time friend updates
  useEffect(() => {
    if (!currentUser?.uid) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const userData = doc.data();
        setFriends(userData.friends || []);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Subscribe to real-time outgoing requests
  useEffect(() => {
    if (!currentUser?.uid) return;

    const requestsQuery = query(
      collection(db, 'friendRequests'),
      where('from', '==', currentUser.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requestIds = snapshot.docs.map(doc => doc.data().receiverId);
      setOutgoing(requestIds);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const getStatus = (user) => {
    if (!user?.uid) return 'none';
    if (friends.includes(user.uid)) return 'friend';
    if (outgoing.includes(user.uid)) return 'pending';
    return 'none';
  };

  const handleAddFriend = async (user) => {
    setActionLoading(user.uid);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const result = await friendRequestService.sendFriendRequest(currentUser.uid, user.uid);
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
        setOutgoing([...outgoing, user.uid]);
      }
    } catch (err) {
      Toast.show({
        type: 'error',
        text1: 'Error: ' + err.message,
      });
    }
    setActionLoading('');
  };

  const handleStartChat = async (user) => {
    setChatLoading(user.uid);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // 1. Create/get conversation
      const conversationId = await messageService.createConversation(currentUser.uid, user.uid);
      
      // 2. Update chat context to open the chat
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

  const renderUser = ({ item: user, index }) => {
    const status = getStatus(user);
    const isLoading = actionLoading === user.uid;
    const isChatLoading = chatLoading === user.uid;

    return (
      <Animated.View
        style={[
          styles.userItem,
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
        <Image
          source={{ 
            uri: user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'User')}&background=667eea&color=fff&bold=true`
          }}
          style={styles.avatar}
        />
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user.displayName || 'Unknown User'}</Text>
          <Text style={styles.userStatus}>
            {user.phoneNumber || user.status || 'Available'}
          </Text>
        </View>
        <View style={styles.actions}>
          {status === 'friend' ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.chatButton]}
              onPress={() => handleStartChat(user)}
              disabled={isChatLoading}
            >
              {isChatLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="chatbubble" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          ) : status === 'pending' ? (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingText}>Pending</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={() => handleAddFriend(user)}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="person-add" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          )}
        </View>
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
        <Text style={styles.title}>Find Friends</Text>
        <Text style={styles.subtitle}>
          Search by name or phone number
        </Text>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchTypeContainer}>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'name' && styles.searchTypeButtonActive
            ]}
            onPress={() => setSearchType('name')}
          >
            <Text style={[
              styles.searchTypeText,
              searchType === 'name' && styles.searchTypeTextActive
            ]}>Name</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.searchTypeButton,
              searchType === 'phone' && styles.searchTypeButtonActive
            ]}
            onPress={() => setSearchType('phone')}
          >
            <Text style={[
              styles.searchTypeText,
              searchType === 'phone' && styles.searchTypeTextActive
            ]}>Phone</Text>
          </TouchableOpacity>
        </View>

        <View style={[
          styles.searchInputContainer,
          searchFocused && styles.searchInputContainerFocused
        ]}>
          <Ionicons 
            name={searchType === 'phone' ? 'call' : 'search'} 
            size={20} 
            color={searchFocused ? '#667eea' : '#666'} 
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={searchType === 'phone' ? "Enter phone number..." : "Search users..."}
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={searchType === 'phone' ? 'phone-pad' : 'default'}
          />
          {query.length > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setQuery('');
                Keyboard.dismiss();
              }}
            >
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          )}
        </View>
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
            onPress={() => debouncedSearch(query)}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : query.length > 0 && results.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={48} color="#fff" />
          <Text style={styles.emptyText}>No users found</Text>
          <Text style={styles.emptySubtext}>
            {searchType === 'phone' 
              ? 'Make sure the phone number is correct and registered'
              : 'Try searching with a different name or phone number'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={results}
          renderItem={renderUser}
          keyExtractor={(item) => item.uid}
          contentContainerStyle={styles.resultsList}
          keyboardShouldPersistTaps="handled"
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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
  searchContainer: {
    padding: 16,
  },
  searchTypeContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 4,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  searchTypeButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchTypeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '600',
  },
  searchTypeTextActive: {
    color: '#fff',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInputContainerFocused: {
    borderWidth: 2,
    borderColor: '#667eea',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    padding: 0,
  },
  clearButton: {
    padding: 4,
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
  resultsList: {
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  userStatus: {
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
  },
  addButton: {
    backgroundColor: '#4CAF50',
  },
  chatButton: {
    backgroundColor: '#667eea',
  },
  pendingBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pendingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default UserSearch;
