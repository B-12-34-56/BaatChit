// Input.jsx - Message input component to work with your existing structure
import React, { useContext, useState } from "react";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import { 
  arrayUnion, 
  doc, 
  serverTimestamp, 
  Timestamp, 
  updateDoc,
  setDoc,
  getDoc
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { v4 as uuid } from "uuid";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [sending, setSending] = useState(false);

  const { data } = useContext(ChatContext);

  const [currentUser] = useAuthState(auth);

  const handleSend = async () => {
    if (!text.trim() && !img) return;
    if (!data.chatId || !data.user?.uid) return;

    setSending(true);
    
    try {
      // Create message object
      const message = {
        id: uuid(),
        text: text.trim(),
        senderId: currentUser.uid,
        date: Timestamp.now(),
        timestamp: serverTimestamp(),
      };

      // Handle image upload if needed (you'll need to implement this)
      if (img) {
        // Upload image logic here
        // message.img = downloadURL;
      }

      // First, ensure the conversation exists
      const conversationRef = doc(db, "conversations", data.chatId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        await setDoc(conversationRef, {
          participants: [currentUser.uid, data.user.uid].sort(),
          createdAt: serverTimestamp(),
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: currentUser.uid
        });
      } else {
        // Update conversation with last message
        await updateDoc(conversationRef, {
          lastMessage: text,
          lastMessageTime: serverTimestamp(),
          lastMessageSender: currentUser.uid
        });
      }

      // Add message to messages subcollection
      await setDoc(doc(db, "conversations", data.chatId, "messages", message.id), {
        text: message.text,
        senderId: message.senderId,
        timestamp: serverTimestamp(),
        read: false
      });

      // Update userChats for both users
      await updateDoc(doc(db, "userChats", currentUser.uid), {
        [data.chatId + ".lastMessage"]: {
          text: text.trim(),
        },
        [data.chatId + ".date"]: serverTimestamp(),
      });

      await updateDoc(doc(db, "userChats", data.user.uid), {
        [data.chatId + ".lastMessage"]: {
          text: text.trim(),
        },
        [data.chatId + ".date"]: serverTimestamp(),
      });

      setText("");
      setImg(null);
    } catch (err) {
      console.error("Error sending message:", err);
      // You might want to show an error toast here
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.code === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      height: 65,
      background: '#fff',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: 15,
      borderTop: '1px solid #e9ecef',
      boxShadow: '0 -2px 10px rgba(0,0,0,0.05)'
    }}>
      <input
        type="text"
        placeholder="Type a message..."
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKey}
        value={text}
        disabled={sending}
        style={{
          flex: 1,
          border: 'none',
          outline: 'none',
          fontSize: 16,
          padding: '12px 20px',
          borderRadius: 25,
          background: '#f1f3f5',
          fontFamily: 'Inter, -apple-system, sans-serif',
          transition: 'all 0.2s',
        }}
        onFocus={(e) => e.target.style.background = '#e9ecef'}
        onBlur={(e) => e.target.style.background = '#f1f3f5'}
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Optional: Add image upload button */}
        {/* <input
          type="file"
          style={{ display: "none" }}
          id="file"
          onChange={(e) => setImg(e.target.files[0])}
        />
        <label htmlFor="file">
          <button style={{...buttonStyle}}>📷</button>
        </label> */}
        
        <button 
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{
            padding: '10px 20px',
            background: text.trim() && !sending ? 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)' : '#ddd',
            color: 'white',
            border: 'none',
            borderRadius: 25,
            cursor: text.trim() && !sending ? 'pointer' : 'not-allowed',
            fontSize: 15,
            fontWeight: 600,
            transition: 'all 0.2s',
            boxShadow: text.trim() && !sending ? '0 2px 10px rgba(102, 126, 234, 0.3)' : 'none',
          }}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
};

export default Input;