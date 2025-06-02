import React, { useContext, useEffect, useState } from 'react';
import { AuthContext } from '../../context/AuthContext';
// TODO: Adjust the import path if messageService is elsewhere
import { messageService } from '../../services/messageService';

const ConversationList = ({ onSelect }) => {
  const { currentUser } = useContext(AuthContext);
  const [conversations, setConversations] = useState([]);

  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsubscribe = messageService.subscribeToConversations(currentUser.uid, setConversations);
    return () => unsubscribe && unsubscribe();
  }, [currentUser]);

  return (
    <div>
      {conversations.length === 0 && <div>No conversations yet.</div>}
      {conversations.map(conv => (
        <div
          key={conv.id}
          onClick={() => onSelect && onSelect(conv)}
          style={{ cursor: 'pointer', padding: 8, borderBottom: '1px solid #eee' }}
        >
          {conv.otherUser?.displayName || conv.id}
        </div>
      ))}
    </div>
  );
};

export default ConversationList; 