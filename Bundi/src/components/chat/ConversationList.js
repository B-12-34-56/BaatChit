// Add this temporary debug code to your ConversationList component
// to help identify where the text string error is coming from

import React, { useContext, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';

// Debug wrapper component to catch text rendering errors
const SafeView = ({ children }) => {
  if (typeof children === 'string' || typeof children === 'number') {
    console.error('Found unwrapped text:', children);
    return <Text>{children}</Text>;
  }
  return <>{children}</>;
};

const ConversationList = ({ onSelect }) => {
  const [currentUser] = useAuthState(auth);
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser?.uid || typeof currentUser.uid !== 'string' || !currentUser.uid.trim()) {
      setLoading(false);
      return;
    }
    
    let isMounted = true;
    
    try {
      const unsubscribe = messageService.subscribeToConversations(
        currentUser.uid,
        (convs) => {
          console.log('Received conversations:', convs); // Debug log
          if (isMounted) {
            // Validate and process the data structure
            if (Array.isArray(convs)) {
              const processedConvs = convs
                .filter(c => c.lastMessage?.trim()) // hide threads that never had a message
                .reduce((uniq, c) => // collapse any dup IDs that slipped through
                  uniq.some(u => u.otherUser?.uid === c.otherUser?.uid) ? uniq : [...uniq, c], []);
              setConversations(processedConvs);
            } else {
              console.error('Conversations is not an array:', convs);
              setConversations([]);
            }
            setLoading(false);
          }
        },
        () => isMounted
      );
      
      return () => {
        isMounted = false;
        unsubscribe && unsubscribe();
      };
    } catch (error) {
      console.error('Error in subscribeToConversations:', error);
      setLoading(false);
    }
  }, [currentUser]);

  const renderItem = ({ item: conv }) => {
    // Ensure we have valid data before rendering
    if (!conv) return null;
    
    const displayName = conv?.otherUser?.displayName || conv?.id || 'Unknown User';
    
    return (
      <TouchableOpacity
        onPress={() => onSelect && onSelect(conv)}
        style={styles.conversationItem}
      >
        <SafeView>
          <Text style={styles.conversationText}>
            {String(displayName)}
          </Text>
        </SafeView>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeView>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#667eea" />
        </View>
      </SafeView>
    );
  }

  return (
    <SafeView>
      <View style={styles.container}>
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No conversations yet.</Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            keyExtractor={(item) => item?.id || Math.random().toString()}
            renderItem={renderItem}
            removeClippedSubviews={false}
            initialNumToRender={10}
          />
        )}
      </View>
    </SafeView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationItem: {
    padding: 12,
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
