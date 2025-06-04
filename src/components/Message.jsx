import React, { useContext, useRef } from "react";
import { ChatContext } from "../context/ChatContext";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';

const Message = ({ message }) => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);

  const ref = useRef();

  const isOwner = message.senderUid === currentUser.uid;

  console.log('Rendering message:', message);
  const avatarUrl = isOwner
    ? (currentUser.photoURL || 'https://ui-avatars.com/api/?name=You&background=667eea&color=fff&bold=true')
    : (data.user.photoURL || 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&bold=true');

  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        flexDirection: isOwner ? 'row-reverse' : 'row',
        alignItems: 'flex-end',
        marginBottom: 18,
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: isOwner ? 'flex-end' : 'flex-start' }}>
        <img
          src={avatarUrl}
          alt="avatar"
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            objectFit: 'cover',
            boxShadow: '0 1px 4px rgba(44,62,80,0.10)',
            marginBottom: 4,
          }}
        />
        <span style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>just now</span>
      </div>
      <div style={{
        maxWidth: 340,
        background: isOwner ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' : '#f7f8fa',
        color: isOwner ? 'white' : '#222',
        borderRadius: isOwner ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
        padding: '12px 18px',
        fontSize: 15,
        fontWeight: 500,
        boxShadow: '0 2px 8px rgba(44,62,80,0.08)',
        wordBreak: 'break-word',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: isOwner ? 'flex-end' : 'flex-start',
      }}>
        <p style={{ margin: 0 }}>{message.text}</p>
        {message.img && <img src={message.img} alt="" style={{ marginTop: 8, maxWidth: 220, borderRadius: 10, boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />}
      </div>
    </div>
  );
};

export default Message;
