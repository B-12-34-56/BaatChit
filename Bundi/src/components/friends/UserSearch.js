import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { searchUsers } from '../../services/userService';
import { friendRequestService } from '../../services/friendRequestService';
import Toast from 'react-native-toast-message';
import { messageService } from '../../services/messageService';
import { ChatContext } from '../../context/ChatContext';

// Debounced search with abort
function useDebouncedSearch(searchTerm, delay = 300) {
  const [results, setResults] = useState([]);
  const abortControllerRef = useRef();

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const timer = setTimeout(async () => {
      if (searchTerm) {
        try {
          const users = await searchUsers(searchTerm, {
            signal: abortControllerRef.current.signal
          });
          setResults(users);
        } catch (err) {
          if (err.name !== 'AbortError') throw err;
        }
      } else {
        setResults([]);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [searchTerm, delay]);

  return results;
}

const UserSearch = () => {
  const [currentUser] = useAuthState(auth);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const { dispatch } = useContext(ChatContext);
  const [chatLoading, setChatLoading] = useState('');

  // Fetch friends and outgoing requests for status
  useEffect(() => {
    async function fetchStatus() {
      if (!currentUser?.uid) return;
      const [friendsList, outgoingReqs] = await Promise.all([
        friendRequestService.getFriends(currentUser.uid),
        friendRequestService.getOutgoingRequests(currentUser.uid)
      ]);
      setFriends(friendsList.map(u => u.uid));
      setOutgoing(outgoingReqs.map(r => r.receiverId));
    }
    fetchStatus();
  }, [currentUser]);

  // Use debounced search with abort
  const results = useDebouncedSearch(query, 400);

  useEffect(() => {
    setLoading(!!query && results.length === 0);
  }, [query, results]);

  const getStatus = (user) => {
    if (friends.includes(user.uid)) return 'friend';
    if (outgoing.includes(user.uid)) return 'pending';
    return 'none';
  };

  const handleAddFriend = async (user) => {
    setActionLoading(user.uid);
    try {
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

  const renderUser = ({ item: user }) => {
    const status = getStatus(user);
    
    return (
      <View style={styles.userItem}>
        <View style={styles.userInfo}>
          <Image 
            source={{ 
              uri: user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'User') 
            }}
            style={styles.avatar}
          />
          <View>
            <Text style={styles.userName}>{user.displayName}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>
        <View>
          {status === 'friend' ? (
            <TouchableOpacity 
              onPress={() => handleStartChat(user)} 
              disabled={chatLoading === user.uid} 
              style={[
                styles.chatButton,
                { opacity: chatLoading === user.uid ? 0.7 : 1 }
              ]}
            >
              <Text style={styles.buttonText}>
                {chatLoading === user.uid ? 'Starting...' : 'Chat'}
              </Text>
            </TouchableOpacity>
          ) : status === 'pending' ? (
            <Text style={styles.pendingText}>Pending</Text>
          ) : (
            <TouchableOpacity 
              onPress={() => handleAddFriend(user)} 
              disabled={actionLoading === user.uid} 
              style={[
                styles.addButton,
                { opacity: actionLoading === user.uid ? 0.7 : 1 }
              ]}
            >
              <Text style={styles.buttonText}>
                {actionLoading === user.uid ? 'Sending...' : 'Add Friend'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Toast />
      <Text style={styles.title}>Find Users</Text>
      <TextInput
        placeholder="Search by name or email..."
        value={query}
        onChangeText={setQuery}
        style={styles.searchInput}
      />
      {loading ? (
        <Text>Searching...</Text>
      ) : results.length === 0 && query ? (
        <Text style={styles.emptyText}>No users found</Text>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.uid}
          renderItem={renderUser}
        />
      )}
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
  searchInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    marginBottom: 18,
  },
  userItem: {
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
  chatButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 6,
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
  },
  pendingText: {
    color: '#888',
    fontWeight: '600',
  },
  emptyText: {
    color: '#888',
    fontWeight: '500',
  },
});

export default UserSearch; 