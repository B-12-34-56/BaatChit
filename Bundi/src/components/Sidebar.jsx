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
  const [error, setError] = useState(null);
  const [currentUser] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    console.log('[DEBUG] Sidebar useEffect triggered');
    console.log('[DEBUG] currentUser:', {
      uid: currentUser?.uid,
      email: currentUser?.email,
      isAuthenticated: !!currentUser
    });
    
    if (!currentUser?.uid) {
      console.log('[DEBUG] No current user found, returning early');
      setLoading(false);
      return;
    }

    // Safety timeout to prevent infinite loading
    const safetyTimeout = setTimeout(() => {
      console.log('[DEBUG] Safety timeout triggered - forcing loading state to false');
      setError('Loading timed out. Please try again.');
      setLoading(false);
    }, 3000);

    let isMounted = true;

    const fetchFriends = async () => {
      if (!isMounted) return;
      
      console.log('[DEBUG] Starting to fetch friends for user:', currentUser.uid);
      setLoading(true);
      setError(null);
      
      try {
        console.log('[DEBUG] Attempting to fetch user document from Firestore');
        const userRef = doc(db, 'users', currentUser.uid);
        console.log('[DEBUG] User document reference created:', userRef.path);
        
        const userDoc = await getDoc(userRef);
        if (!isMounted) return;
        
        console.log('[DEBUG] User document fetch result:', {
          exists: userDoc.exists(),
          hasData: !!userDoc.data(),
          path: userDoc.ref.path
        });
        
        if (!userDoc.exists()) {
          console.log('[DEBUG] User document not found in Firestore');
          setError('User profile not found');
          setFriends([]);
          return;
        }

        const userData = userDoc.data();
        console.log('[DEBUG] User data retrieved:', { 
          hasFriends: !!userData.friends, 
          friendsCount: userData.friends?.length || 0,
          friendsArray: userData.friends || []
        });

        const friendUids = userData.friends || [];
        
        if (!friendUids.length) {
          console.log('[DEBUG] No friends found in user document');
          setFriends([]);
          return;
        }

        console.log('[DEBUG] Starting to fetch profiles for friends:', friendUids);
        const friendProfiles = [];
        
        for (const uid of friendUids) {
          if (!isMounted) return;
          
          try {
            console.log('[DEBUG] Fetching profile for friend:', uid);
            const friendRef = doc(db, 'users', uid);
            const friendDoc = await getDoc(friendRef);
            
            if (!isMounted) return;
            
            console.log('[DEBUG] Friend document fetch result:', {
              uid,
              exists: friendDoc.exists(),
              hasData: !!friendDoc.data()
            });
            
            if (friendDoc.exists()) {
              const friendData = friendDoc.data();
              friendProfiles.push({ uid, ...friendData });
              console.log('[DEBUG] Successfully fetched profile for:', {
                uid,
                displayName: friendData.displayName || 'No name',
                email: friendData.email || 'No email'
              });
            } else {
              console.log('[DEBUG] Friend document not found for uid:', uid);
            }
          } catch (err) {
            console.error('[DEBUG] Error fetching individual friend profile:', {
              uid,
              error: err.message,
              code: err.code,
              stack: err.stack
            });
          }
        }

        if (!isMounted) return;

        console.log('[DEBUG] Friend fetching complete:', {
          totalFriends: friendUids.length,
          successfulFetches: friendProfiles.length,
          failedFetches: friendUids.length - friendProfiles.length
        });
        
        setFriends(friendProfiles);
      } catch (err) {
        console.error('[DEBUG] Error in fetchFriends:', {
          message: err.message,
          code: err.code,
          stack: err.stack
        });
        if (isMounted) {
          setError(err.message || 'Failed to load friends');
          setFriends([]);
        }
      } finally {
        if (isMounted) {
          console.log('[DEBUG] Clearing loading state and safety timeout');
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }
    };

    fetchFriends().catch(err => {
      console.error('[DEBUG] Unhandled error in fetchFriends:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      if (isMounted) {
        setError(err.message || 'Failed to load friends');
        clearTimeout(safetyTimeout);
        setLoading(false);
      }
    });

    return () => {
      console.log('[DEBUG] Sidebar useEffect cleanup');
      isMounted = false;
      clearTimeout(safetyTimeout);
      setLoading(false);
      setError(null);
    };
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
        <View style={{ 
          marginVertical: 10,
          backgroundColor: '#f8f9fa',
          borderRadius: 12,
          padding: 12,
          borderWidth: 1,
          borderColor: '#e0e0e0',
        }}>
          <Text style={{
            fontSize: 16,
            fontWeight: '600',
            color: '#333',
            marginBottom: 8,
          }}>
            Friend Requests
          </Text>
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
        ) : error ? (
          <View style={{ padding: 10, alignItems: 'center' }}>
            <Text style={{ color: '#ff4444', marginBottom: 10, textAlign: 'center' }}>
              {error}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setError(null);
                setLoading(true);
                // Re-trigger the useEffect by updating a dependency
                setFriends([]);
              }}
              style={{
                backgroundColor: '#667eea',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>
                Try Again
              </Text>
            </TouchableOpacity>
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