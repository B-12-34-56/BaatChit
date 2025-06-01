import { doc, onSnapshot } from 'firebase/firestore';
import React, { useContext, useEffect, useState } from 'react'
import { ChatContext } from '../context/ChatContext';
import { db } from '../firebase';
import Message from './Message'
import { dbRealtime } from '../firebase';
import { ref as dbRef, onValue } from 'firebase/database';

const Messages = () => {
  const { data } = useContext(ChatContext);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    // Listen to messages in Realtime Database
    const messagesRef = dbRef(dbRealtime, `userChats/${data.chatId}/messages`);
    const unsub = onValue(messagesRef, (snapshot) => {
      const msgs = snapshot.val();
      const msgArr = msgs ? Object.entries(msgs).map(([id, val]) => ({ id, ...val })) : [];
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