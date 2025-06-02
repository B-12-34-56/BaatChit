import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useContext, useEffect, useState } from 'react'
import { ChatContext } from '../context/ChatContext';
import { db } from '../utils/firebase';
import Message from './Message'

const Messages = () => {
  const { data } = useContext(ChatContext);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!data.chatId || typeof data.chatId !== 'string' || !data.chatId.trim()) return;
    // Listen to messages in Firestore
    const q = query(
      collection(db, 'conversations', data.chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsub = onSnapshot(q, (querySnapshot) => {
      const msgArr = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMessages(msgArr);
    });
    return () => unsub();
  }, [data.chatId]);

  return (
    <div className='messages'>
        {messages.map((m) => (
          <Message key={m.id} message={m} />
        ))}
    </div>
  )
}

export default Messages