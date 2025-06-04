import React, { useContext, useEffect, useRef } from "react";
import { ChatContext } from "../context/ChatContext";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';

const Message = ({ message }) => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);

  const ref = useRef();

  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth" });
  }, [message]);

  const isOwner = message.senderUid === currentUser.uid;

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
          src={isOwner ? currentUser.photoURL : data.user.photoURL}
          alt=""
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
        {/* Show text if it exists and it's not just an image placeholder */}
        {message.text && !message.text.startsWith('[Image:') && (
          <p style={{ margin: 0 }}>{message.text}</p>
        )}
        
        {/* Handle new image format with imageUrl */}
        {message.type === 'image' && message.imageUrl && (
          <div style={{ marginTop: message.text && !message.text.startsWith('[Image:') ? 8 : 0 }}>
            <img 
              src={message.imageUrl} 
              alt={message.imageName || "Shared image"}
              style={{ 
                maxWidth: 220, 
                borderRadius: 10, 
                boxShadow: '0 1px 4px rgba(44,62,80,0.10)',
                cursor: 'pointer'
              }}
              onClick={() => window.open(message.imageUrl, '_blank')}
            />
            {message.imageTag && (
              <div style={{ 
                marginTop: 4,
                fontSize: 11,
                fontWeight: 600,
                color: message.imageTag === 'duplicate' ? '#ff9800' : '#4caf50',
                textAlign: 'center',
                textTransform: 'uppercase'
              }}>
                [{message.imageTag}]
              </div>
            )}
          </div>
        )}
        
        {/* Support old format if any messages still use it */}
        {message.img && !message.imageUrl && (
          <img src={message.img} alt="" style={{ marginTop: 8, maxWidth: 220, borderRadius: 10, boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
        )}
      </div>
    </div>
  );
};

export default Message;