import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';

const ConversationList = ({ onSelect }) => {
  const [currentUser] = useAuthState(auth);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid || typeof currentUser.uid !== 'string' || !currentUser.uid.trim()) return;
    
    let isMounted = true;
    
    const unsubscribe = messageService.subscribeToConversations(
      currentUser.uid, 
      setConversations,
      () => isMounted
    );
    
    return () => {
      isMounted = false;
      unsubscribe && unsubscribe();
    };
  }, [currentUser]);

  const renderItem = ({ item: conv }) => (
    <TouchableOpacity
      onPress={() => onSelect && onSelect(conv)}
      style={styles.conversationItem}
    >
      <Text style={styles.conversationText}>
        {conv?.otherUser?.displayName || conv?.id || 'Unknown User'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {conversations.length === 0 ? (
        <Text style={styles.emptyText}>No conversations yet.</Text>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  conversationItem: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  conversationText: {
    fontSize: 16,
    color: '#333',
  },
  emptyText: {
    padding: 16,
    color: '#999',
    textAlign: 'center',
  },
});

export default ConversationList;
