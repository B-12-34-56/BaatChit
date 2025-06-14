import React, { useContext } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MessageList from './chat/MessageList'
import MessageInput from './chat/MessageInput'
import { ChatContext } from '../context/ChatContext'
import { useRouter } from 'expo-router'

const Chat = () => {
  // Safe context access with fallback
  const context = useContext(ChatContext);
  const data = context?.data || { user: {}, chatId: null };
  const router = useRouter();

  // Safe access to displayName and user data
  const displayName = data?.user?.displayName || 'Chat';
  const userData = data?.user || {};

  const handleViewProfile = () => {
    router.push({
      pathname: '/profile/[id]',
      params: { id: userData.uid }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleViewProfile} style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={24} color="#667eea" />
        </TouchableOpacity>
        <Text style={styles.title}>{displayName}</Text>
      </View>

      <MessageList />
      <MessageInput />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  profileButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
    color: '#333',
  },
});

export default Chat;