import React, { useContext } from "react";
import { View, StyleSheet } from "react-native";
import { ChatContext } from "../context/ChatContext";
import ConversationList from './chat/ConversationList';
import Chat from './Chat';

const Chats = () => {
  const context = useContext(ChatContext);
  const dispatch = context?.dispatch || (() => {});

  // Handler for selecting a conversation
  const handleSelectConversation = (conversation) => {
    if (!conversation?.otherUser) {
      console.warn('No otherUser in conversation:', conversation);
      return;
    }
    
    // Ensure all values are properly typed
    const payload = {
      ...conversation.otherUser,
      uid: String(conversation.otherUser.uid || ''),
      displayName: String(conversation.otherUser.displayName || 'User'),
      photoURL: conversation.otherUser.photoURL || null,
      email: conversation.otherUser.email || null
    };
    
    console.log('Dispatching CHANGE_USER with payload:', payload);
    dispatch({ type: 'CHANGE_USER', payload });
  };

  return (
    <View style={styles.container}>
      <ConversationList onSelect={handleSelectConversation} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8fa',
    paddingVertical: 18,
    borderRadius: 18,
    marginHorizontal: 8,
    minWidth: 0,
    shadowColor: '#2c3e50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
});

export default Chats;