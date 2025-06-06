import React, { useEffect, useState, useContext } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet } from 'react-native';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { ChatContext } from '../../context/ChatContext';

const FriendList = () => {
  const [currentUser] = useAuthState(auth);
  const [friends, setFriends] = useState([]);
  const { dispatch } = useContext(ChatContext);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'users'),
      where('uid', '!=', currentUser.uid)
    );
    const unsub = onSnapshot(q, (querySnapshot) => {
      setFriends(querySnapshot.docs.map(doc => doc.data()));
    });
    return () => unsub();
  }, [currentUser]);

  const handleSelect = (user) => {
    dispatch({ type: 'CHANGE_USER', payload: user });
  };

  const renderFriend = ({ item: user }) => (
    <TouchableOpacity
      onPress={() => handleSelect(user)}
      style={styles.friendItem}
    >
      <Image
        source={{ 
          uri: user.photoURL || `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&bold=true`
        }}
        style={styles.avatar}
      />
      <Text style={styles.friendName}>{user.displayName || 'User'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Friends</Text>
      {friends.length === 0 ? (
        <Text style={styles.emptyText}>No friends found.</Text>
      ) : (
        <FlatList
          data={friends}
          keyExtractor={(item) => item.uid}
          renderItem={renderFriend}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 18,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#667eea',
  },
  friendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#222',
  },
  emptyText: {
    color: '#aaa',
    fontSize: 14,
  },
});

export default FriendList;