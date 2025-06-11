// Input.jsx - React Native version for message input component
import React, { useContext, useState } from "react";
import { View, TextInput, TouchableOpacity, Text, Alert } from "react-native";
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
        senderUid: currentUser.uid,
        date: Timestamp.now(),
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
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
        senderUid: message.senderUid,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
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
      Alert.alert("Error", "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={{
      height: 65,
      backgroundColor: '#fff',
      paddingHorizontal: 20,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      borderTopWidth: 1,
      borderTopColor: '#e9ecef',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 5,
    }}>
      <TextInput
        placeholder="Type a message..."
        onChangeText={setText}
        value={text}
        editable={!sending}
        multiline
        style={{
          flex: 1,
          borderWidth: 0,
          fontSize: 16,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 25,
          backgroundColor: '#f1f3f5',
          fontFamily: 'System',
          marginRight: 15,
        }}
        onFocus={() => {}}
        onBlur={() => {}}
      />
      
      <TouchableOpacity 
        onPress={handleSend}
        disabled={!text.trim() || sending}
        style={{
          paddingHorizontal: 20,
          paddingVertical: 10,
          backgroundColor: text.trim() && !sending ? '#667eea' : '#ddd',
          borderRadius: 25,
          shadowColor: text.trim() && !sending ? '#667eea' : 'transparent',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: text.trim() && !sending ? 5 : 0,
        }}
      >
        <Text style={{
          color: 'white',
          fontSize: 15,
          fontWeight: '600',
        }}>
          {sending ? '...' : 'Send'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default Input;