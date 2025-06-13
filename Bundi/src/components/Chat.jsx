import React, { useContext, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MessageList from './chat/MessageList'
import MessageInput from './chat/MessageInput'
import { ChatContext } from '../context/ChatContext'
import { useRouter } from 'expo-router'
import AddFriend from './AddFriend'

const Chat = () => {
  // Safe context access with fallback
  const context = useContext(ChatContext);
  const data = context?.data || { user: {}, chatId: null };
  
  const [menuOpen, setMenuOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const router = useRouter();

  const handleMenuClick = () => setMenuOpen((open) => !open);
  const handleProfile = () => { 
    setMenuOpen(false); 
    router.push('/profile'); 
  };
  const handleAddFriend = () => {
    setMenuOpen(false);
    router.push('/add-friend');
  };
  const closeAddFriend = () => setAddFriendOpen(false);

  // Safe access to displayName
  const displayName = data?.user?.displayName || 'Chat';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleMenuClick} style={styles.menuButton}>
          <Ionicons name="menu" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{displayName}</Text>
      </View>

      <MessageList />
      <MessageInput />

      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuOpen(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpen(false)}
        >
          <View style={styles.menuContent}>
            <View style={styles.menuDivider} />
            <TouchableOpacity 
              style={[styles.menuItem, styles.menuItemBottom]}
              onPress={handleProfile}
            >
              <Ionicons name="person" size={24} color="#333" />
              <Text style={styles.menuText}>Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.menuItem, styles.menuItemBottom]}
              onPress={handleAddFriend}
            >
              <Ionicons name="person-add" size={24} color="#333" />
              <Text style={styles.menuText}>Add Friend</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
  },
  menuButton: {
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  menuContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    padding: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  menuText: {
    fontSize: 16,
    marginLeft: 16,
    color: '#333',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 8,
  },
  menuItemBottom: {
    borderBottomWidth: 0,
  },
});

export default Chat;