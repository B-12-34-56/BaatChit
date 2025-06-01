import React, { useState, useContext } from "react";
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase";
import { AuthContext } from "../context/AuthContext";
import { sendRequest, getOutgoingRequests } from '../services/friendRequestService';

const AddFriend = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const { currentUser } = useContext(AuthContext);
  const [outgoing, setOutgoing] = useState([]);

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
      await sendRequest(currentUser.uid, friendUid);
      setStatus("Friend request sent!");
      setEmail("");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  React.useEffect(() => {
    async function fetchOutgoing() {
      if (!currentUser?.uid) return;
      const reqs = await getOutgoingRequests(currentUser.uid);
      setOutgoing(reqs);
    }
    fetchOutgoing();
  }, [currentUser, status]);

  return (
    <div>
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
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>Pending Friend Requests</div>
        {outgoing.length === 0 ? (
          <div style={{ color: '#888', fontSize: 13 }}>No pending requests.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {outgoing.map(req => (
              <li key={req.id} style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>
                To: {req.to}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AddFriend; 