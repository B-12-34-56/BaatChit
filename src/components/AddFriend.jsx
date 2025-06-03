import React, { useState, useContext } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { friendRequestService } from '../services/friendRequestService';

const AddFriend = () => {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [currentUser] = useAuthState(auth);
  const [outgoing, setOutgoing] = useState([]);

  const handleAddFriend = async (e) => {
    e.preventDefault();
    setStatus("");
    
    if (!email) {
      setStatus("Please enter an email.");
      return;
    }
    
    try {
      // Find user by email
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
      
      // Send friend request
      const result = await friendRequestService.sendFriendRequest(currentUser.uid, friendUid);
      
      if (!result.success) {
        console.error('Friend request error:', result);
        setStatus("Error: " + (result.message || "Failed to send friend request"));
        return;
      }
      
      setStatus("Friend request sent!");
      setEmail("");
      
      // Refresh outgoing requests
      fetchOutgoing();
    } catch (err) {
      console.error('Friend request error (catch):', err);
      setStatus("Error: " + (err.message || err.toString()));
    }
  };

  const fetchOutgoing = async () => {
    if (!currentUser?.uid) return;
    const reqs = await friendRequestService.getOutgoingRequests(currentUser.uid);
    setOutgoing(reqs);
  };

  React.useEffect(() => {
    fetchOutgoing();
  }, [currentUser]);

  return (
    <div>
      <form onSubmit={handleAddFriend} style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 8, 
        marginBottom: 18 
      }}>
        <input
          type="email"
          placeholder="Add friend by email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ 
            padding: 8, 
            borderRadius: 6, 
            border: '1px solid #ccc', 
            fontSize: 15 
          }}
        />
        <button 
          type="submit" 
          style={{ 
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', 
            color: 'white', 
            border: 'none', 
            borderRadius: 6, 
            padding: '8px 0', 
            fontWeight: 600, 
            fontSize: 15, 
            cursor: 'pointer' 
          }}>
          Add Friend
        </button>
        {status && (
          <span style={{ 
            color: status.startsWith('Error') ? '#e53e3e' : '#4CAF50', 
            fontSize: 13 
          }}>
            {status}
          </span>
        )}
      </form>
      
      <div style={{ marginTop: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
          Pending Friend Requests
        </div>
        {outgoing.length === 0 ? (
          <div style={{ color: '#888', fontSize: 13 }}>No pending requests.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {outgoing.map(req => (
              <li key={req.id} style={{ fontSize: 14, color: '#333', marginBottom: 4 }}>
                To: {req.recipientInfo?.displayName || req.recipientInfo?.email || req.receiverId}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AddFriend;