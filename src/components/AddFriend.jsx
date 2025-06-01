import React, { useState, useContext } from "react";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";

const AddFriend = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const { currentUser } = useContext(AuthContext);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setStatus("");
    if (!email) return setStatus("Please enter an email.");
    try {
      const userQuery = query(collection(db, "users"), where("email", "==", email));
      const userSnap = await getDocs(userQuery);
      if (userSnap.empty) {
        setStatus("User not found");
        return;
      }
      const friendUid = userSnap.docs[0].id;
      if (friendUid === currentUser.uid) {
        setStatus("You cannot add yourself as a friend.");
        return;
      }
      await updateDoc(doc(db, "users", currentUser.uid), {
        friends: arrayUnion(friendUid)
      });
      setStatus("Friend added!");
      setEmail("");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  return (
    <form onSubmit={handleAddFriend} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      <input
        type="email"
        placeholder="Add friend by email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc', fontSize: 15 }}
      />
      <button type="submit" style={{ background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none', borderRadius: 6, padding: '8px 0', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>Add Friend</button>
      {status && <span style={{ color: status.startsWith('Error') ? '#e53e3e' : '#4CAF50', fontSize: 13 }}>{status}</span>}
    </form>
  );
};

export default AddFriend; 