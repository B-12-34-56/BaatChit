import React, { useContext, useState } from "react";
import Attach from "../img/attach.png";
import { AuthContext } from "../context/AuthContext";
import { ChatContext } from "../context/ChatContext";
import {
  arrayUnion,
  doc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db, storage, dbRealtime } from "../firebase";
import { v4 as uuid } from "uuid";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { ref as dbRef, push, serverTimestamp as rtdbTimestamp } from "firebase/database";
import { getImageTag } from '../services/getTagService';

function generateChatId(uid1, uid2) {
  return [uid1, uid2].sort().join("");
}

// Placeholder for S3 existence check
async function checkImageInS3(file) {
  // Use getImageTag to check if the image exists in S3 by filename
  if (!file) return false;
  const tagResult = await getImageTag(file.name);
  // You may need to adjust this logic depending on your API's response
  if (tagResult && (tagResult.duplicate || tagResult.exists)) {
    return true;
  }
  return false;
}

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);
  const [error, setError] = useState("");

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);

  const handleSend = async () => {
    setError("");
    if (!text && !img) return;
    const chatId = generateChatId(currentUser.uid, data.user.uid);
    // Ensure chat doc exists in Firestore
    const chatDocRef = doc(db, "userChats", chatId);
    const chatDocSnap = await getDoc(chatDocRef);
    if (!chatDocSnap.exists()) {
      await setDoc(chatDocRef, {
        users: [currentUser.uid, data.user.uid],
        createdAt: serverTimestamp(),
        participants: [currentUser.uid, data.user.uid],
      });
    }
    let imgUrl = null;
    if (img) {
      // S3 existence check
      const existsInS3 = await checkImageInS3(img);
      if (existsInS3) {
        setError("This image already exists in S3 and cannot be sent.");
        setImg(null);
        return;
      }
      const storageRef = ref(storage, uuid());
      await uploadBytesResumable(storageRef, img).then(() => {
        getDownloadURL(storageRef).then(async (downloadURL) => {
          imgUrl = downloadURL;
          await push(dbRef(dbRealtime, `userChats/${chatId}/messages`), {
            senderUid: currentUser.uid,
            text,
            img: imgUrl,
            timestamp: rtdbTimestamp(),
          });
        });
      });
    } else {
      await push(dbRef(dbRealtime, `userChats/${chatId}/messages`), {
        senderUid: currentUser.uid,
        text,
        timestamp: rtdbTimestamp(),
      });
    }
    // Update userChats metadata in Firestore for both users
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
        <input
          type="file"
          style={{ display: "none" }}
          id="file"
          accept="image/*"
          onChange={(e) => setImg(e.target.files[0])}
        />
        {/* AWS S3 icon for S3 filter/upload feature */}
        <label style={{ cursor: "pointer", display: 'flex', alignItems: 'center', padding: 6, borderRadius: 6, transition: 'background 0.2s' }} onClick={() => window.location.href = '/upload'}>
          <img src={require("../img/react-1-logo-black-and-white (1).png")} alt="Upload to S3" style={{ height: 22, width: 22 }} />
        </label>
        <button onClick={handleSend} style={{ padding: '8px 18px', fontWeight: 600, fontSize: 15, borderRadius: 6, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', marginLeft: 6, cursor: 'pointer', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }}>Send</button>
      </div>
      {error && <div style={{ color: '#e53e3e', fontSize: 13, marginTop: 4 }}>{error}</div>}
    </div>
  );
};

export default Input;
