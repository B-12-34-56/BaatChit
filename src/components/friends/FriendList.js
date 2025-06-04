import React, { useContext, useEffect, useState } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { removeFriend } from '../../services/friendService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { db } from '../../utils/firebase';
import { doc, onSnapshot, collection, query, where, getDocs, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { getOrCreateConversation } from '../../services/conversationService';

const FriendList = () => {
  const { dispatch } = useContext(ChatContext);
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [currentUser] = useAuthState(auth);

  useEffect(() => {
    if (!currentUser?.uid || typeof currentUser.uid !== 'string' || !currentUser.uid.trim()) return;
    
    let isMounted = true;
    setLoading(true);
    
    const userRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(userRef, 
      async (userSnap) => {
        if (!isMounted) return;
        
        if (!userSnap.exists()) {
          setFriends([]);
          setLoading(false);
          return;
        }
        
        let friendUids = userSnap.data().friends || [];
        friendUids = Array.isArray(friendUids) ? friendUids.filter(uid => typeof uid === 'string' && uid.trim()).slice(0, 10) : [];
        
        if (friendUids.length === 0) {
          setFriends([]);
          setLoading(false);
          return;
        }
        
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', 'in', friendUids));
        const querySnapshot = await getDocs(q);
        setFriends(querySnapshot.docs.map(doc => doc.data()));
        setLoading(false);
      },
      (error) => {
        if (!isMounted) return;
        console.error('FriendList listener error:', error);
        setLoading(false);
      }
    );
    
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  const handleStartChat = async (friend) => {
    try {
      const convId = await getOrCreateConversation(currentUser.uid, friend.uid);
      dispatch({ 
        type: "CHANGE_USER", 
        payload: {
          uid: friend.uid,
          displayName: friend.displayName,
          photoURL: friend.photoURL,
          chatId: convId
        }
      });
      toast.success('Chat started!');
    } catch (error) {
      console.error('Error starting chat:', error);
      toast.error('Failed to start chat');
    }
  };

  const handleRemove = async (friendUid) => {
    setRemovingId(friendUid);
    try {
      await removeFriend(currentUser.uid, friendUid);
      await removeFriend(friendUid, currentUser.uid);
      toast.info('Friend removed.');
      setFriends(friends.filter(f => f.uid !== friendUid));
    } catch (err) {
      toast.error('Error removing friend: ' + err.message);
    }
    setRemovingId('');
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <ToastContainer position="top-center" autoClose={1400} />
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Your Friends</h2>
      {loading ? (
        <div>Loading...</div>
      ) : friends.length === 0 ? (
        <div style={{ color: '#888', fontWeight: 500 }}>No friends yet</div>
      ) : (
        friends.map(friend => (
          <div key={friend.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, cursor: 'pointer' }}
                 onClick={() => handleStartChat(friend)}>
              <img src={friend.photoURL || 'https://ui-avatars.com/api/?name=' + (friend.displayName || 'User')} 
                   alt="avatar" 
                   style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{friend.displayName}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{friend.email}</div>
                <div style={{ fontSize: 13, color: friend.isOnline ? '#4CAF50' : '#e53e3e', fontWeight: 600 }}>
                  {friend.isOnline ? 'Online' : 'Offline'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => handleStartChat(friend)}
                style={{ 
                  background: '#667eea', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  padding: '6px 14px', 
                  fontWeight: 600, 
                  cursor: 'pointer' 
                }}>
                Chat
              </button>
              <button 
                onClick={() => handleRemove(friend.uid)} 
                disabled={removingId === friend.uid} 
                style={{ 
                  background: '#e53e3e', 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: 6, 
                  padding: '6px 14px', 
                  fontWeight: 600, 
                  cursor: removingId === friend.uid ? 'not-allowed' : 'pointer', 
                  opacity: removingId === friend.uid ? 0.7 : 1 
                }}>
                {removingId === friend.uid ? 'Removing...' : 'Remove'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default FriendList;