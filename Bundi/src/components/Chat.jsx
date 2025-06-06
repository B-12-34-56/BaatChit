import React, { useContext, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import MessageList from './chat/MessageList'
import MessageInput from './chat/MessageInput'
import { ChatContext } from '../context/ChatContext'
import { useRouter } from 'expo-router'
import { signOut } from 'firebase/auth'
import { auth } from '../utils/firebase'
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
  const handleLogout = () => { 
    setMenuOpen(false); 
    signOut(auth); 
  };
  const handleAddFriend = () => setAddFriendOpen(true);
  const closeAddFriend = () => setAddFriendOpen(false);

  // Safe access to displayName
  const displayName = data?.user?.displayName || 'Chat';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{displayName}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => {}}>
            <Ionicons name="videocam" size={22} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleAddFriend}>
            <Ionicons name="person-add" size={22} color="#667eea" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleMenuClick}>
            <Ionicons name="ellipsis-vertical" size={22} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Menu Modal */}
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuOpen(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={() => setMenuOpen(false)}
          >
            <View style={styles.menuDropdown}>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleProfile}
              >
                <Text style={styles.menuItemText}>Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.menuItem}
                onPress={handleLogout}
              >
                <Text style={[styles.menuItemText, { color: '#e53e3e' }]}>Logout</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Add Friend Modal */}
        <Modal
          visible={addFriendOpen}
          transparent
          animationType="slide"
          onRequestClose={closeAddFriend}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            onPress={closeAddFriend}
          >
            <View style={styles.addFriendModal}>
              <View style={styles.addFriendHeader}>
                <TouchableOpacity onPress={closeAddFriend}>
                  <Text style={styles.closeButton}>×</Text>
                </TouchableOpacity>
              </View>
              <AddFriend />
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
      
      <View style={styles.chatContent}>
        <View style={styles.messageListContainer}>
          <MessageList />
        </View>
        <MessageInput />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 18,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontWeight: '700',
    fontSize: 18,
    color: '#3a3a5a',
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(44,62,80,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDropdown: {
    backgroundColor: 'white',
    borderRadius: 10,
    minWidth: 120,
    paddingVertical: 8,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 12,
    elevation: 5,
  },
  menuItem: {
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  menuItemText: {
    color: '#3a3a5a',
    fontWeight: '600',
    fontSize: 15,
    textAlign: 'left',
  },
  addFriendModal: {
    backgroundColor: 'white',
    borderRadius: 18,
    padding: 32,
    minWidth: 320,
    maxWidth: '90%',
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  addFriendHeader: {
    position: 'absolute',
    top: 10,
    right: 16,
    zIndex: 1,
  },
  closeButton: {
    fontSize: 22,
    color: '#888',
    fontWeight: 'bold',
  },
  chatContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  messageListContainer: {
    flex: 1,
  },
});

export default Chat;