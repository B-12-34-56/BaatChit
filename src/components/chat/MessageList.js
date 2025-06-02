import React, { useContext, useEffect, useState } from 'react';
import { ChatContext } from '../../context/ChatContext';
// TODO: Adjust the import path if messageService is elsewhere
import { messageService } from '../../services/messageService';

const MessageList = () => {
  const { data } = useContext(ChatContext);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!data.chatId) return;
    const unsubscribe = messageService.subscribeToMessages(data.chatId, setMessages);
    return () => unsubscribe && unsubscribe();
  }, [data.chatId]);

  return (
    <div>
      {messages.length === 0 && <div>No messages yet.</div>}
      {messages.map(msg => (
        <div key={msg.id}>{msg.text}</div>
      ))}
    </div>
  );
};

export default MessageList; 