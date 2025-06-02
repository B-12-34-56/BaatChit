import React, { useContext, useState } from "react";
import Attach from "../img/attach.png";
import ReactLogo from "../img/react-1-logo-black-and-white (1).png";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import {
  doc,
  serverTimestamp,
  updateDoc,
  getDoc,
  setDoc,
  collection,
  addDoc
} from "firebase/firestore";
import { db, storage } from "../utils/firebase";
import { v4 as uuid } from "uuid";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useNavigate } from "react-router-dom";

function generateChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("");
}

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [error, setError] = useState("");

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);
  const navigate = useNavigate();

  const handleSend = async () => {
    setError("");
    if (!text && !img) return;
    const chatId = generateChatId(currentUser.uid, data.user.uid);
    // Ensure conversation doc exists in Firestore
    const conversationRef = doc(db, "conversations", chatId);
    const conversationSnap = await getDoc(conversationRef);
    if (!conversationSnap.exists()) {
      await setDoc(conversationRef, {
        participants: [currentUser.uid, data.user.uid],
        createdAt: serverTimestamp(),
      });
    }
    let imgUrl = null;
    if (img) {
      const storageRef = ref(storage, uuid());
      await uploadBytesResumable(storageRef, img).then(async (snapshot) => {
        imgUrl = await getDownloadURL(snapshot.ref);
        await addDoc(collection(db, "conversations", chatId, "messages"), {
          senderUid: currentUser.uid,
          text,
          img: imgUrl,
          timestamp: serverTimestamp(),
        });
      });
    } else {
      await addDoc(collection(db, "conversations", chatId, "messages"), {
        senderUid: currentUser.uid,
        text,
        timestamp: serverTimestamp(),
      });
    }
    // Optionally update lastMessage and date in userChats for both users
    await updateDoc(doc(db, "userChats", currentUser.uid), {
      [chatId + ".lastMessage"]: { text },
      [chatId + ".date"]: serverTimestamp(),
    });
    await updateDoc(doc(db, "userChats", data.user.uid), {
      [chatId + ".lastMessage"]: { text },
      [chatId + ".date"]: serverTimestamp(),
    });
    setText("");
    setImg(null);
  };

  const handleKey = (e) => {
    e.code === "Enter" && handleSend();
  };
  
  return (
    <div className="input" style={{ display: 'flex', alignItems: 'center', padding: 10, background: 'white', borderRadius: 8, boxShadow: '0 1px 4px rgba(44,62,80,0.06)' }}>
      <input
        type="text"
        placeholder="Type something..."
        onKeyDown={handleKey}
        onChange={(e) => setText(e.target.value)}
        value={text}
        style={{ flex: 1, border: 'none', outline: 'none', fontSize: 15, padding: '10px 12px', borderRadius: 6, background: 'transparent', marginRight: 12 }}
      />
      <div className="send" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Paperclip icon triggers file input */}
        <label htmlFor="file" style={{ cursor: "pointer", display: 'flex', alignItems: 'center', padding: 6, borderRadius: 6, transition: 'background 0.2s' }}>
          <img src={Attach} alt="Attach" style={{ height: 22, width: 22 }} />
        </label>
        <img src={ReactLogo} alt="React Logo" title="Upload" style={{ height: 22, width: 22, cursor: 'pointer', opacity: 1, filter: 'brightness(0.7)', transition: 'filter 0.2s' }} onClick={() => navigate('/upload')} onMouseOver={e => e.currentTarget.style.filter = 'brightness(1)'} onMouseOut={e => e.currentTarget.style.filter = 'brightness(0.7)'} />
        <input
          type="file"
          style={{ display: "none" }}
          id="file"
          accept="image/*"
          onChange={(e) => setImg(e.target.files[0])}
        />
        <button onClick={handleSend} style={{ padding: '8px 18px', fontWeight: 600, fontSize: 15, borderRadius: 6, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', marginLeft: 6, cursor: 'pointer', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }}>Send</button>
      </div>
      {error && <div style={{ color: '#e53e3e', fontSize: 13, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

export default Input;
