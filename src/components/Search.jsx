import React, { useContext, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';

const Search = () => {
  const [username, setUsername] = useState("");
  const [user, setUser] = useState(null);
  const [err, setErr] = useState(false);

  const [currentUser] = useAuthState(auth);

  const handleSearch = async () => {
    setErr(false);
    setUser(null);
    let q = query(collection(db, "users"));
    try {
      const querySnapshot = await getDocs(q);
      let results = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (!username) {
          results.push({ uid: docSnap.id, ...data });
        } else if (username.includes('@')) {
          if (data.email && data.email.toLowerCase() === username.toLowerCase()) {
            results.push({ uid: docSnap.id, ...data });
          }
        } else {
          if (data.displayName && data.displayName.toLowerCase().includes(username.toLowerCase())) {
            results.push({ uid: docSnap.id, ...data });
          }
        }
      });
      if (results.length === 0) {
        setErr(true);
      } else {
        setUser(results);
      }
    } catch (error) {
      setErr(true);
    }
  };

  const handleKey = (e) => {
    e.code === "Enter" && handleSearch();
  };

  const handleSelect = async (selectedUser) => {
    // check whether the group(chats in firestore) exists, if not create
    const combinedId =
      currentUser.uid > selectedUser.uid
        ? currentUser.uid + selectedUser.uid
        : selectedUser.uid + currentUser.uid;
    try {
      const res = await getDoc(doc(db, "chats", combinedId));

      if (!res.exists()) {
        // create a chat in chats collection
        await setDoc(doc(db, "chats", combinedId), {
          messages: [],
        });

        // create user chats
        await updateDoc(
          doc(db, "userChats", currentUser.uid), {
            [combinedId + ".userInfo"]: {
              uid: selectedUser.uid,
              displayName: selectedUser.displayName,
              photoURL: selectedUser.photoURL,
            },
            [combinedId + ".date"]: serverTimestamp(),
        });

        await updateDoc(
          doc(db, "userChats", selectedUser.uid), {
            [combinedId + ".userInfo"]: {
              uid: currentUser.uid,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
            },
            [combinedId + ".date"]: serverTimestamp(),
        });
      }
    } catch (err) {}

    setUser(null);
    setUsername("");
  };

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        background: '#f7f8fa',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(44,62,80,0.06)',
        padding: '6px 12px',
        marginBottom: 10,
        gap: 8,
      }}>
        <svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{ opacity: 0.6 }}><circle cx="11" cy="11" r="7" stroke="#667eea" strokeWidth="2"/><path d="M20 20l-3.5-3.5" stroke="#667eea" strokeWidth="2" strokeLinecap="round"/></svg>
        <input
          type="text"
          placeholder="Find a user"
          onKeyDown={handleKey}
          onChange={(e) => setUsername(e.target.value)}
          value={username}
          style={{
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 15,
            fontWeight: 500,
            color: '#222',
            flex: 1,
            padding: '8px 0',
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '6px 14px',
            fontWeight: 600,
            fontSize: 14,
            cursor: 'pointer',
            marginLeft: 6,
            boxShadow: '0 1px 4px rgba(44,62,80,0.10)',
            transition: 'background 0.2s',
          }}
        >
          Search
        </button>
      </div>
      {err && (
        <span style={{ color: "#e53e3e", fontSize: "13px", fontWeight: 500, display: 'block', marginTop: 4 }}>
          User not found!
        </span>
      )}
      {user && Array.isArray(user) && user.map(u => (
        <div
          key={u.uid}
          onClick={() => handleSelect(u)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: '#fff',
            boxShadow: '0 1px 4px rgba(44,62,80,0.06)',
            cursor: 'pointer',
            marginTop: 8,
            fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
            fontWeight: 500,
            fontSize: 15,
            color: '#222',
            outline: 'none',
            transition: 'background 0.18s, box-shadow 0.18s',
          }}
          onMouseOver={e => e.currentTarget.style.background = '#f0f4ff'}
          onMouseOut={e => e.currentTarget.style.background = '#fff'}
        >
          <img src={u.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
          <div>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#3a3a5a' }}>{u.displayName}</span>
            <span style={{ fontSize: 13, color: '#888', marginLeft: 8 }}>{u.email}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default Search; 