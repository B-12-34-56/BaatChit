import { doc, onSnapshot } from "firebase/firestore";
import React, { useContext, useEffect, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { db } from "../utils/firebase";

const Chats = () => {
  const [chats, setChats] = useState({});

  const { currentUser } = useContext(AuthContext);
  const { dispatch } = useContext(ChatContext);

  useEffect(() => {
    if (!currentUser?.uid) return;

    const unsub = onSnapshot(doc(db, "userChats", currentUser.uid), (doc) => {
      setChats(doc.data() || {});
    });

    return () => unsub();
  }, [currentUser?.uid]);

  if (!currentUser?.uid) {
    return <div style={{ padding: 24, textAlign: 'center', color: '#667eea', fontWeight: 600 }}>Loading chats...</div>;
  }

  const handleSelect = (userInfo, chatId) => {
    // FIXED: Now passing both userInfo AND chatId
    dispatch({ 
      type: "CHANGE_USER", 
      payload: {
        ...userInfo,
        chatId: chatId  // This is critical!
      }
    });
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
      {Object.entries(chats || {})
        ?.sort((a, b) => b[1].date - a[1].date)
        .map((chat) => (
          <div
            key={chat[0]}
            onClick={() => handleSelect(chat[1].userInfo, chat[0])} // FIXED: Pass chatId (chat[0])
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '12px 18px',
              borderRadius: 14,
              margin: '0 10px 10px 10px',
              background: '#fff',
              boxShadow: '0 1px 4px rgba(44,62,80,0.04)',
              cursor: 'pointer',
              transition: 'background 0.18s, box-shadow 0.18s',
              fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
              fontWeight: 500,
              fontSize: 16,
              color: '#222',
              outline: 'none',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#f0f4ff'}
            onMouseOut={e => e.currentTarget.style.background = '#fff'}
          >
            <img src={chat[1].userInfo.photoURL} alt="" style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: '#3a3a5a' }}>{chat[1].userInfo.displayName}</span>
              <p style={{ fontSize: 14, color: '#888', margin: '2px 0 0 0', fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{chat[1].lastMessage?.text}</p>
            </div>
          </div>
        ))}
    </div>
  );
};

export default Chats;