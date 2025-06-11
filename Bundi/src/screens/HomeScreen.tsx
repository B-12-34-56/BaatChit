import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Chats from '../components/Chats';
import FriendRequests from '../components/friends/FriendRequests';
import FriendList from '../components/friends/FriendList';
import UserSearch from '../components/friends/UserSearch';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase.js';

const HomeScreen = () => {
  const [user] = useAuthState(auth);
  const [activeTab, setActiveTab] = useState('chats');

  const handleSelectFriend = (friend: any) => {
    // Handle friend selection
    console.log('Selected friend:', friend);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'chats':
        return <Chats />;
      case 'friends':
        return <FriendList onSelectFriend={handleSelectFriend} />;
      case 'requests':
        return <FriendRequests />;
      case 'search':
        return <UserSearch />;
      default:
        return <Chats />;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Bundi</Text>
      </View>

      <View style={styles.content}>
        {renderContent()}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'chats' && styles.activeTab]} 
          onPress={() => setActiveTab('chats')}
        >
          <Ionicons 
            name="chatbubbles" 
            size={24} 
            color={activeTab === 'chats' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'chats' && styles.activeTabText]}>Chats</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'friends' && styles.activeTab]} 
          onPress={() => setActiveTab('friends')}
        >
          <Ionicons 
            name="people" 
            size={24} 
            color={activeTab === 'friends' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'friends' && styles.activeTabText]}>Friends</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]} 
          onPress={() => setActiveTab('requests')}
        >
          <Ionicons 
            name="person-add" 
            size={24} 
            color={activeTab === 'requests' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'requests' && styles.activeTabText]}>Requests</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.tab, activeTab === 'search' && styles.activeTab]} 
          onPress={() => setActiveTab('search')}
        >
          <Ionicons 
            name="search" 
            size={24} 
            color={activeTab === 'search' ? '#007AFF' : '#666'} 
          />
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>Search</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  content: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fff',
    paddingBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  activeTab: {
    borderTopWidth: 2,
    borderTopColor: '#007AFF',
  },
  tabText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  activeTabText: {
    color: '#007AFF',
  },
});

export default HomeScreen; 