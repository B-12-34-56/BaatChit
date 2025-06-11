// Sidebar.jsx - React Native version
import React, { useContext, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { db } from '../utils/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { ChatContext } from '../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Navbar from './Navbar';
import Chats from './Chats';
import FriendRequestsDropdown from './friends/FriendRequests';

const Sidebar = () => {
  const { dispatch } = useContext(ChatContext);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentUser] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    if (!currentUser?.uid) return;
    const fetchFriends = async () => {
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const friendUids = userDoc.exists() ? (userDoc.data().friends || []) : [];
        const friendProfiles = [];
        for (const uid of friendUids) {
          const friendDoc = await getDoc(doc(db, 'users', uid));
          if (friendDoc.exists()) {
            friendProfiles.push({ uid, ...friendDoc.data() });
          }
        }
        setFriends(friendProfiles);
      } catch (err) {
        setFriends([]);
      }
      setLoading(false);
    };
    fetchFriends();
  }, [currentUser]);

  const renderFriendItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => dispatch({ type: 'CHANGE_USER', payload: item })}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
      }}
    >
      <Image 
        source={{ uri: item.photoURL || 'https://ui-avatars.com/api/?name=' + (item.displayName || 'User') }} 
        style={{ 
          width: 28, 
          height: 28, 
          borderRadius: 14,
          marginRight: 10,
        }} 
      />
      <View style={{ flex: 1 }}>
        <Text style={{ 
          fontWeight: '600', 
          fontSize: 14,
          color: '#333',
        }}>
          {item.displayName || item.email}
        </Text>
        <Text style={{ 
          fontSize: 12, 
          color: '#888',
        }}>
          {item.email}
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
        <View style={{ marginVertical: 10 }}>
          <FriendRequestsDropdown />
        </View>
      </View>

      {/* Friends and Search Section */}
      <View style={{
        paddingHorizontal: 18,
        paddingTop: 18,
        paddingBottom: 10,
        borderBottomWidth: 1.5,
        borderBottomColor: '#e0e0e0',
        backgroundColor: 'rgba(255,255,255,0.92)',
      }}>
        <View style={{ 
          flexDirection: 'row', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 8,
        }}>
          <Text style={{ 
            fontWeight: '700', 
            fontSize: 15, 
            color: '#667eea',
          }}>
            Friends
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/search')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: '#667eea',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
            }}
          >
            <Ionicons name="search" size={16} color="#fff" style={{ marginRight: 4 }} />
            <Text style={{ 
              color: '#fff',
              fontSize: 13,
              fontWeight: '600',
            }}>
              Search
            </Text>
          </TouchableOpacity>
        </View>
        {loading ? (
          <View style={{ padding: 10, alignItems: 'center' }}>
            <ActivityIndicator size="small" color="#667eea" />
          </View>
        ) : friends.length === 0 ? (
          <Text style={{ fontSize: 13, color: '#aaa', textAlign: 'center', padding: 10 }}>
            No friends yet. Use the search button to find friends!
          </Text>
        ) : (
          <FlatList
            data={friends}
            renderItem={renderFriendItem}
            keyExtractor={(item) => item.uid}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Chats Section */}
      <View style={{ 
        flex: 1,
        minHeight: 0,
      }}>
        <Chats />
      </View>
    </LinearGradient>
  );
};

export default Sidebar;