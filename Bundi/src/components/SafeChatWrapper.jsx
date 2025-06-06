import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { ChatContext } from '../context/ChatContext';
import Chat from './Chat';

// This wrapper ensures the Chat component only renders when context is properly loaded
const SafeChatWrapper = () => {
  const context = React.useContext(ChatContext);
  
  // Check if context is properly loaded
  if (!context || context.loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading chat...</Text>
      </View>
    );
  }
  
  // Check if we have a valid chat selected
  if (!context.data?.chatId) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Select a conversation to start chatting</Text>
      </View>
    );
  }
  
  // Render the actual Chat component only when everything is ready
  return <Chat />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
});

export default SafeChatWrapper; 