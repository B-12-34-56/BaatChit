import React, { useEffect, useState, useContext } from 'react';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { ChatContext } from '../../context/ChatContext';

const FriendList = () => {
  const [currentUser] = useAuthState(auth);
  const [friends, setFriends] = useState([]);
  const { dispatch } = useContext(ChatContext);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'users'),
      where('uid', '!=', currentUser.uid)
    );
    const unsub = onSnapshot(q, (querySnapshot) => {
      setFriends(querySnapshot.docs.map(doc => doc.data()));
    });
    return () => unsub();
  }, [currentUser]);

  const handleSelect = (user) => {
    dispatch({ type: 'CHANGE_USER', payload: user });
  };

  return (
    <div style={{ padding: 18 }}>
      <h3 style={{ marginBottom: 12, color: '#667eea' }}>Friends</h3>
      {friends.length === 0 && <div style={{ color: '#aaa' }}>No friends found.</div>}
      {friends.map((user) => (
        <div
          key={user.uid}
          onClick={() => handleSelect(user)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 0',
            cursor: 'pointer',
            borderBottom: '1px solid #f0f0f0',
          }}
        >
          <img
            src={user.photoURL || 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&bold=true'}
            alt={user.displayName}
            style={{ width: 36, height: 36, borderRadius: '50%', marginRight: 12 }}
          />
          <span style={{ fontWeight: 500, color: '#222' }}>{user.displayName || 'User'}</span>
        </div>
      ))}
    </div>
  );
};

export default FriendList;