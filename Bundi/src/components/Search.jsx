// Search.jsx - React Native version
import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Image,
  FlatList,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback
} from "react-native";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { Ionicons } from '@expo/vector-icons';
import { searchUsers } from '../services/userService';
import { friendRequestService } from '../services/friendRequestService';
import Toast from 'react-native-toast-message';

const UserSearchComponent = () => {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const [err, setErr] = useState(false);
  const [currentUser] = useAuthState(auth);
  const [loading, setLoading] = useState(false);
  const [friendRequests, setFriendRequests] = useState({
    incoming: [],
    outgoing: []
  });
  const searchTimeout = React.useRef(null);

  useEffect(() => {
    loadFriendRequests();
  }, [currentUser?.uid]);

  const loadFriendRequests = async () => {
    if (!currentUser?.uid) return;
    try {
      const [incoming, outgoing] = await Promise.all([
        friendRequestService.getIncomingRequests(currentUser.uid),
        friendRequestService.getOutgoingRequests(currentUser.uid)
      ]);

      // Fetch user details for outgoing requests
      const outgoingWithDetails = await Promise.all(
        outgoing.map(async (request) => {
          const userDoc = await getDoc(doc(db, 'users', request.receiverId));
          const userData = userDoc.data();
          return {
            ...request,
            receiverInfo: {
              displayName: userData?.displayName || 'Unknown User',
              email: userData?.email || '',
              phoneNumber: userData?.phoneNumber || '',
              photoURL: userData?.photoURL || null
            }
          };
        })
      );

      setFriendRequests({
        incoming,
        outgoing: outgoingWithDetails
      });
    } catch (error) {
      console.error('Error loading friend requests:', error);
    }
  };

  const handleSearch = async () => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    searchTimeout.current = setTimeout(async () => {
      if (!username.trim()) {
        setUser(null);
        setLoading(false);
        return;
      }

      setErr(false);
      setUser(null);
      setLoading(true);
      
      try {
        // Don't search if query is too short
        if (username.length < 3) {
          setLoading(false);
          return;
        }

        const results = await searchUsers(username);
        if (results.length === 0) {
          setErr(true);
        } else {
          // Filter out current user and users with pending requests
          const filteredResults = results.filter(u => 
            u.uid !== currentUser?.uid && 
            !friendRequests.outgoing.some(req => req.receiverId === u.uid) &&
            !friendRequests.incoming.some(req => req.from === u.uid)
          );
          setUser(filteredResults);
        }
      } catch (error) {
        console.error('Search error:', error);
        setErr(true);
      } finally {
        setLoading(false);
      }
    }, 300); // Reduced debounce time for better responsiveness
  };

  const handleFriendRequest = async (selectedUser) => {
    try {
      const result = await friendRequestService.sendFriendRequest(currentUser.uid, selectedUser.uid);
      
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request sent!',
        });
        setUser(null);
        setUsername("");
      } else {
        Toast.show({
          type: 'error',
          text1: result.message || 'Failed to send friend request',
        });
      }
    } catch (err) {
      console.error('Error sending friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to send friend request',
      });
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const result = await friendRequestService.acceptFriendRequest(requestId, currentUser.uid);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request accepted!',
        });
        loadFriendRequests();
      } else {
        Toast.show({
          type: 'error',
          text1: result.message || 'Failed to accept friend request',
        });
      }
    } catch (err) {
      console.error('Error accepting friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to accept friend request',
      });
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const result = await friendRequestService.rejectFriendRequest(requestId, currentUser.uid);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request rejected',
        });
        loadFriendRequests();
      } else {
        Toast.show({
          type: 'error',
          text1: result.message || 'Failed to reject friend request',
        });
      }
    } catch (err) {
      console.error('Error rejecting friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to reject friend request',
      });
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      const result = await friendRequestService.cancelFriendRequest(requestId, currentUser.uid);
      if (result.success) {
        Toast.show({
          type: 'success',
          text1: 'Friend request cancelled',
        });
        loadFriendRequests();
      } else {
        Toast.show({
          type: 'error',
          text1: result.message || 'Failed to cancel friend request',
        });
      }
    } catch (err) {
      console.error('Error cancelling friend request:', err);
      Toast.show({
        type: 'error',
        text1: 'Failed to cancel friend request',
      });
    }
  };

  const renderUserItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleFriendRequest(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: '#fff',
        marginTop: 8,
        shadowColor: '#2c3e50',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}
    >
      <Image 
        source={{ uri: item.photoURL || 'https://ui-avatars.com/api/?name=' + (item.displayName || 'User') }} 
        style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18,
          marginRight: 14,
        }} 
      />
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontWeight: '700', 
          fontSize: 15, 
          color: '#3a3a5a' 
        }}>
          {item.displayName || 'Unknown User'}
        </Text>
        {item.email && (
          <Text style={{ 
            fontSize: 13, 
            color: '#888',
            marginTop: 2
          }}>
            {item.email}
          </Text>
        )}
      </View>
      <TouchableOpacity
        onPress={() => handleFriendRequest(item)}
        style={{
          backgroundColor: '#667eea',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
          Add Friend
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFriendRequestItem = ({ item }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#fff',
      marginTop: 8,
      shadowColor: '#2c3e50',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    }}>
      <Image 
        source={{ uri: item.senderInfo?.photoURL || 'https://ui-avatars.com/api/?name=' + (item.senderInfo?.displayName || 'User') }} 
        style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18,
          marginRight: 14,
        }} 
      />
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontWeight: '700', 
          fontSize: 15, 
          color: '#3a3a5a' 
        }}>
          {item.senderInfo?.displayName || 'Unknown User'}
        </Text>
        <Text style={{ 
          fontSize: 13, 
          color: '#888',
          marginTop: 2
        }}>
          {item.senderInfo?.email || item.senderInfo?.phoneNumber || 'No contact info'}
        </Text>
        <Text style={{ 
          fontSize: 13, 
          color: '#888',
          marginTop: 2
        }}>
          Wants to be your friend
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity
          onPress={() => handleAcceptRequest(item.id)}
          style={{
            backgroundColor: '#48bb78',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
            Accept
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleRejectRequest(item.id)}
          style={{
            backgroundColor: '#f56565',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 6,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
            Reject
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPendingRequestItem = ({ item }) => (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: '#fff',
      marginTop: 8,
      shadowColor: '#2c3e50',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      elevation: 2,
    }}>
      <Image 
        source={{ uri: item.receiverInfo?.photoURL || 'https://ui-avatars.com/api/?name=' + (item.receiverInfo?.displayName || 'User') }} 
        style={{ 
          width: 36, 
          height: 36, 
          borderRadius: 18,
          marginRight: 14,
        }} 
      />
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontWeight: '700', 
          fontSize: 15, 
          color: '#3a3a5a' 
        }}>
          {item.receiverInfo?.displayName || 'Unknown User'}
        </Text>
        <Text style={{ 
          fontSize: 13, 
          color: '#888',
          marginTop: 2
        }}>
          {item.receiverInfo?.email || item.receiverInfo?.phoneNumber || 'No contact info'}
        </Text>
        <Text style={{ 
          fontSize: 13, 
          color: '#888',
          marginTop: 2
        }}>
          Friend request sent
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => handleCancelRequest(item.id)}
        style={{
          backgroundColor: '#f56565',
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 6,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: 13 }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={{ flex: 1, paddingTop: 16 }}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f7f8fa',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 6,
        marginHorizontal: 16,
        marginBottom: 10,
        shadowColor: '#2c3e50',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
      }}>
        <Ionicons name="search" size={20} color="#667eea" style={{ opacity: 0.6, marginRight: 8 }} />
        <TextInput
          placeholder="Search by name, email, or phone number"
          onChangeText={(text) => {
            setUsername(text);
            handleSearch();
          }}
          value={username}
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: '500',
            color: '#222',
            paddingVertical: 8,
          }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          returnKeyType="search"
        />
        {loading && (
          <ActivityIndicator size="small" color="#667eea" style={{ marginLeft: 8 }} />
        )}
      </View>
      
      {err && (
        <Text style={{ 
          color: "#e53e3e", 
          fontSize: 13, 
          fontWeight: '500',
          marginTop: 4,
          marginHorizontal: 16,
        }}>
          No users found! Try searching by name, email, or phone number.
        </Text>
      )}
      
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Incoming Friend Requests Section */}
        {friendRequests.incoming.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#333',
              marginBottom: 12,
            }}>
              Incoming Friend Requests
            </Text>
            {friendRequests.incoming.map(request => (
              <View key={request.id}>
                {renderFriendRequestItem({ item: request })}
              </View>
            ))}
          </View>
        )}

        {/* Pending Friend Requests Section */}
        {friendRequests.outgoing.length > 0 && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#333',
              marginBottom: 12,
            }}>
              Pending Friend Requests
            </Text>
            {friendRequests.outgoing.map(request => (
              <View key={request.id}>
                {renderPendingRequestItem({ item: request })}
              </View>
            ))}
          </View>
        )}

        {/* Search Results Section */}
        {user && Array.isArray(user) && (
          <View>
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: '#333',
              marginBottom: 12,
            }}>
              Search Results
            </Text>
            <FlatList
              data={user}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.uid}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default UserSearchComponent;