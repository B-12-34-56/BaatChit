import React, { useContext, useState } from 'react'
import { View, Text, TouchableOpacity, Modal, StyleSheet, SafeAreaView, Image, KeyboardAvoidingView, Platform } from 'react-native'
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
  const handleAddFriend = () => setAddFriendOpen(true);
  const closeAddFriend = () => setAddFriendOpen(false);

  // Safe access to displayName
  const displayName = data?.user?.displayName || 'Chat';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.chatHeader}>
          <View style={styles.userInfo}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.replace('/')}
            >
              <Ionicons name="arrow-back" size={24} color="#667eea" />
            </TouchableOpacity>
            <Image 
              source={{ 
                uri: data.user?.photoURL || 'https://ui-avatars.com/api/?name=' + (data.user?.displayName || 'User') 
              }}
              style={styles.avatar}
            />
            <View>
              <Text style={styles.userName}>{data.user?.displayName}</Text>
              <Text style={styles.userStatus}>Online</Text>
            </View>
          </View>
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/profile',
              params: { userId: data.user?.uid }
            })}
            style={styles.profileButton}
          >
            <Ionicons name="person-circle-outline" size={24} color="#667eea" />
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
      
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.chatContent}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      >
        <View style={styles.messageListContainer}>
          <MessageList />
        </View>
        <MessageInput />
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingTop: 8,
    paddingBottom: 8,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2d3748',
  },
  userStatus: {
    fontSize: 13,
    color: '#718096',
  },
  profileButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuDropdown: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    padding: 12,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 16,
    color: '#2d3748',
  },
  addFriendModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addFriendHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    fontSize: 24,
    color: '#718096',
    padding: 8,
  },
  chatContent: {
    flex: 1,
  },
  messageListContainer: {
    flex: 1,
  },
});

export default Chat;