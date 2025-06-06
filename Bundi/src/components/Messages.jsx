// Messages.jsx - React Native version
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useContext, useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { ChatContext } from '../context/ChatContext';
import { db } from '../utils/firebase';
import Message from './Message';

const Messages = () => {
  const { data } = useContext(ChatContext);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!data.chatId || typeof data.chatId !== 'string' || !data.chatId.trim()) return;
    
    let isMounted = true;
    const q = query(
      collection(db, 'conversations', data.chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    
    const unsub = onSnapshot(q, 
      (querySnapshot) => {
        if (!isMounted) return;
        const msgArr = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log('Fetched messages:', msgArr);
        setMessages(msgArr);
      },
      (error) => {
        if (!isMounted) return;
        console.error('Message listener error:', error);
      }
    );
    
    return () => {
      isMounted = false;
      unsub();
    };
  }, [data.chatId]);

  const renderMessage = ({ item }) => (
    <Message key={item.id} message={item} />
  );

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={{ flex: 1, paddingVertical: 10 }}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10,
        }}
      />
    </View>
  );
};

export default Messages;