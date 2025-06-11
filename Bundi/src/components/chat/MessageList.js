import React, { useEffect, useRef, useState, useContext } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ChatContext } from '../../context/ChatContext';
import { db } from '../../utils/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Message from '../Message';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';

const MessageList = () => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);
  const scrollViewRef = useRef();
  const [messages, setMessages] = useState([]);
  const [typingStatus, setTypingStatus] = useState({});

  useEffect(() => {
    if (!data.chatId) return;
    const q = query(
      collection(db, 'conversations', data.chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (querySnapshot) => {
      setMessages(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, [data.chatId]);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollToEnd({ animated: true });
    }
  }, [messages]);

  useEffect(() => {
    if (!data.chatId) return;
    const unsub = messageService.subscribeToTyping(data.chatId, setTypingStatus);
    return () => unsub && unsub();
  }, [data.chatId]);

  const otherUserId = data.user?.uid;
  const isOtherUserTyping = otherUserId && typingStatus[otherUserId];

  return (
    <ScrollView 
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
    >
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {isOtherUserTyping && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>
            {data.user?.displayName || 'User'} is typing…
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 18,
    paddingBottom: 10,
  },
  typingIndicator: {
    marginVertical: 8,
    marginHorizontal: 18,
  },
  typingText: {
    color: '#667eea',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MessageList;
