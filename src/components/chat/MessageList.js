import { useEffect, useRef, useState, useContext } from 'react';
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
  const dummy = useRef();
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
    if (dummy.current) {
      dummy.current.scrollIntoView({ behavior: 'smooth' });
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
    <div style={{ flex: 1, overflowY: 'auto', padding: '18px 0 0 0', display: 'flex', flexDirection: 'column' }}>
      {messages.map((m) => (
        <Message key={m.id} message={m} />
      ))}
      {isOtherUserTyping && (
        <div style={{ margin: '8px 0 8px 18px', color: '#667eea', fontSize: 14, fontWeight: 500 }}>
          {data.user?.displayName || 'User'} is typing…
        </div>
      )}
      <div ref={dummy} />
    </div>
  );
};

export default MessageList; 