import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import React, { useContext, useEffect, useState } from 'react'
import { ChatContext } from '../context/ChatContext';
import { db } from '../utils/firebase';
import { db } from '../utils/firebase';
import Message from './Message'

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
      isMounted = false;
      unsub();
    };
  }, [data.chatId]);
    };
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