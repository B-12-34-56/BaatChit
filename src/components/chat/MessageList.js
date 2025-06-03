import React, { useContext, useRef, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { db } from '../../utils/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { useCollectionData } from 'react-firebase-hooks/firestore';
import Message from '../Message';
import { VariableSizeList } from 'react-window';

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

  const getMessageHeight = (msg) => {
    // Estimate or calculate message height based on content
    if (!msg) return 48;
    if (msg.text && msg.text.length > 120) return 96;
    if (msg.text && msg.text.length > 40) return 72;
    return 48;
  };

  if (!data.chatId) return <div style={{padding: 24, color: '#888'}}>Select a chat to start messaging.</div>;
  if (!messages) return <div>No messages yet.</div>;

  if (messages.length === 0) return <div>No messages yet.</div>;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0', height: 600 }}>
      <VariableSizeList
        height={600}
        itemCount={messages.length}
        itemSize={index => getMessageHeight(messages[index])}
        width="100%"
      >
        {({ index, style }) => (
          <div style={style}>
            <Message message={messages[index]} />
          </div>
        )}
      </VariableSizeList>
      <div ref={dummy}></div>
    </div>
  );
};

export default MessageList; 