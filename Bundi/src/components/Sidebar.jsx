// Sidebar.jsx - React Native version
import React, { useContext, useEffect, useState, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator, ScrollView } from 'react-native';
import { db } from '../utils/firebase';
import { doc, getDoc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { ChatContext } from '../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Navbar from './Navbar';
import Chats from './Chats';
import FriendRequestsDropdown from './FriendRequestsDropdown';
import Toast from 'react-native-toast-message';
import { messageService } from '../services/messageService';
import { friendRequestService } from '../services/friendRequestService';
import ConversationList from './chat/ConversationList';

const Sidebar = () => {
  const { dispatch } = useContext(ChatContext);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentUser] = useAuthState(auth);
  const router = useRouter();
  const isMounted = useRef(true);
  const lastUpdate = useRef(Date.now());

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Subscribe to user document for real-time friend updates
    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribeUser = onSnapshot(userRef, async (userDoc) => {
      if (!isMounted.current) return;

      try {
        if (!userDoc.exists()) {
          setError('User profile not found');
          setFriends([]);
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const friendUids = userData.friends || [];

        if (!friendUids.length) {
          setFriends([]);
          setLoading(false);
          return;
        }

        // Create a query to get all friends' documents
        const friendsQuery = query(
          collection(db, 'users'),
          where('uid', 'in', friendUids)
        );

        // Subscribe to friends' documents
        const unsubscribeFriends = onSnapshot(friendsQuery, (snapshot) => {
          if (!isMounted.current) return;

          const friendProfiles = snapshot.docs.map(doc => ({
            uid: doc.id,
            ...doc.data()
          }));

          setFriends(friendProfiles);
          setLoading(false);
        }, (error) => {
          console.error('Error in friends listener:', error);
          if (isMounted.current) {
            setError('Failed to load friends');
            setLoading(false);
          }
        });

        return () => {
          unsubscribeFriends();
        };
      } catch (err) {
        console.error('Error in user listener:', err);
        if (isMounted.current) {
          setError(err.message || 'Failed to load friends');
          setLoading(false);
        }
      }
    });

    return () => {
      isMounted.current = false;
      unsubscribeUser();
    };
  }, [currentUser]);

  const handleStartChat = async (friend) => {
    try {
      const conversationId = await messageService.createConversation(currentUser.uid, friend.uid);
      
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
        text1: 'Failed to start chat: ' + (err.message || 'Unknown error'),
      });
    }
  };

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => handleStartChat(item)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e0e0e0',
      }}
    >
      <Image 
        source={{ uri: item.photoURL || 'https://ui-avatars.com/api/?name=' + (item.displayName || 'User') }} 
        style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 20,
          marginRight: 12,
        }} 
      />
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontWeight: '600', 
          fontSize: 16,
          color: '#333',
          marginBottom: 2,
        }}>
          {item.displayName || item.email}
        </Text>
        <Text style={{ 
          fontSize: 14, 
          color: '#666',
        }}>
          {item.isOnline ? 'Online' : 'Offline'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (!currentUser?.uid) {
    return (
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#667eea" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#e3e6f3', '#f7f8fa']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        width: 320,
        flex: 1,
        borderRightWidth: 1.5,
        borderRightColor: '#e0e0e0',
      }}
    >
      {/* Header Section */}
      <View style={{
        paddingHorizontal: 18,
        paddingTop: 24,
        paddingBottom: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#e0e0e0',
        backgroundColor: 'rgba(255,255,255,0.95)',
      }}>
        <Navbar />
        <View style={{ 
          marginVertical: 10,
          backgroundColor: '#f8f9fa',
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: '#e0e0e0',
        }}>
          <FriendRequestsDropdown />
        </View>
      </View>

      {/* Friends Section */}
      <View style={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#e0e0e0',
        backgroundColor: 'rgba(255,255,255,0.92)',
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: '#333',
          marginBottom: 12,
        }}>
          Friends
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color="#667eea" />
        ) : error ? (
          <Text style={{ color: '#f44336', marginBottom: 12 }}>{error}</Text>
        ) : friends.length === 0 ? (
          <View style={{
            padding: 16,
            backgroundColor: '#f8f9fa',
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#e0e0e0',
          }}>
            <Text style={{
              color: '#666',
              textAlign: 'center',
            }}>
              No friends yet. Add some friends to start chatting!
            </Text>
          </View>
        ) : (
          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={item => item.uid}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 12 }}
          />
        )}
      </View>

      {/* Search Section */}
      <View style={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#e0e0e0',
        backgroundColor: 'rgba(255,255,255,0.92)',
      }}>
        <TouchableOpacity
          onPress={() => router.push('/search')}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#f8f9fa',
            borderRadius: 12,
            padding: 12,
            borderWidth: 1,
            borderColor: '#e0e0e0',
          }}
        >
          <Ionicons name="search" size={20} color="#667eea" />
          <Text style={{
            marginLeft: 8,
            fontSize: 16,
            color: '#667eea',
            fontWeight: '600',
          }}>
            Search Users
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conversations Section */}
      <View style={{
        flex: 1,
        paddingHorizontal: 18,
        paddingTop: 18,
        backgroundColor: 'rgba(255,255,255,0.92)',
      }}>
        <Text style={{
          fontSize: 18,
          fontWeight: '600',
          color: '#333',
          marginBottom: 12,
        }}>
          Conversations
        </Text>
        <ConversationList 
          onSelect={(conv) => {
            if (conv?.otherUser) {
              dispatch({
                type: 'CHANGE_USER',
                payload: {
                  uid: conv.otherUser.uid,
                  displayName: conv.otherUser.displayName,
                  photoURL: conv.otherUser.photoURL,
                  chatId: conv.id
                }
              });
            }
          }} 
        />
      </View>
    </LinearGradient>
  );
};

export default Sidebar;
