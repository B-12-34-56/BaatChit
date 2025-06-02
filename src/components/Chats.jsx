import React, { useContext } from "react";
import { ChatContext } from "../context/ChatContext";
import ConversationList from './chat/ConversationList';

const Chats = () => {
  const { dispatch } = useContext(ChatContext);

  // Handler for selecting a conversation
  const handleSelectConversation = (conversation) => {
    // conversation.otherUser should be the user object for the other participant
    dispatch({ type: 'CHANGE_USER', payload: conversation.otherUser });
  };

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      background: 'linear-gradient(135deg, #f7f8fa 0%, #e3e6f3 100%)',
      padding: '18px 0',
      borderRadius: 18,
      boxShadow: '0 2px 8px rgba(44,62,80,0.06)',
      margin: '0 8px',
      minWidth: 0,
    }}>
      <ConversationList onSelect={handleSelectConversation} />
    </div>
  );
};

export default Chats;