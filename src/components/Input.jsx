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
} from "firebase/firestore";
import { db, storage, dbRealtime } from "../firebase";
import { v4 as uuid } from "uuid";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { ref as dbRef, push, serverTimestamp as rtdbTimestamp } from "firebase/database";

const Input = () => {
  const [text, setText] = useState("");
  const [img, setImg] = useState(null);

  const { currentUser } = useContext(AuthContext);
  const { data } = useContext(ChatContext);

  const handleSend = async () => {
    let imgUrl = null;
    if (img) {
      const storageRef = ref(storage, uuid());
      await uploadBytesResumable(storageRef, img).then(() => {
        getDownloadURL(storageRef).then(async (downloadURL) => {
          imgUrl = downloadURL;
          // After upload, send message to Realtime DB
          await push(dbRef(dbRealtime, `userChats/${data.chatId}/messages`), {
            senderUid: currentUser.uid,
            text,
            img: imgUrl,
            timestamp: rtdbTimestamp(),
          });
        });
      });
    } else {
      // Send message to Realtime DB
      await push(dbRef(dbRealtime, `userChats/${data.chatId}/messages`), {
        senderUid: currentUser.uid,
        text,
        timestamp: rtdbTimestamp(),
      });
    }

    // Update userChats metadata in Firestore
    await updateDoc(doc(db, "userChats", currentUser.uid), {
      [data.chatId + ".lastMessage"]: {
        text,
      },
      [data.chatId + ".date"]: serverTimestamp(),
    });

    await updateDoc(doc(db, "userChats", data.user.uid), {
      [data.chatId + ".lastMessage"]: {
        text,
      },
      [data.chatId + ".date"]: serverTimestamp(),
    });

    setText("");
    setImg(null);
  };

  const handleKey = (e) => {
    e.code === "Enter" && handleSend();
  };
  
  return (
    <div className="input">
      <input
        type="text"
        placeholder="Type something..."
        onKeyDown={handleKey}
        onChange={(e) => setText(e.target.value)}
        value={text}
      />
      <div className="send">
        <img src={Attach} alt="" />
        <label htmlFor="file" style={{ cursor: "pointer" }} onClick={() => window.location.href = '/upload'}>
          <img src={require("../img/react-1-logo-black-and-white (1).png")} alt="Upload to S3" />
        </label>
        <input
          type="file"
          style={{ display: "none" }}
          id="file"
          onChange={(e) => setImg(e.target.files[0])}
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
};

export default Input;
