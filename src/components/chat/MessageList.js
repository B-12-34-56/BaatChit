import React, { useContext, useRef, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { db } from '../../utils/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import Message from '../Message';

const MessageList = () => {
  const { data } = useContext(ChatContext);
  const dummy = useRef();

  const messagesRef = data.chatId
    ? collection(db, 'conversations', data.chatId, 'messages')
    : null;
  const q = data.chatId ? query(messagesRef, orderBy('timestamp', 'asc')) : null;
  const [messages] = useCollectionData(q, { idField: 'id' });

  useEffect(() => {
    if (dummy.current) {
      dummy.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!data.chatId) return <div style={{padding: 24, color: '#888'}}>Select a chat to start messaging.</div>;
  if (!messages) return <div>No messages yet.</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
      {messages.length === 0 && <div>No messages yet.</div>}
      {messages.map(msg => (
        <Message key={msg.id} message={msg} />
      ))}
      <div ref={dummy}></div>
    </div>
  );
};

export default MessageList; 