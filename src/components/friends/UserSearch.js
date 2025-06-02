import React, { useContext, useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { searchUsers } from '../../services/userService';
import { getFriendsList, getOutgoingRequests, sendFriendRequest } from '../../services/friendRequestService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const UserSearch = () => {
  const { currentUser } = useContext(AuthContext);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [actionLoading, setActionLoading] = useState('');

  // Fetch friends and outgoing requests for status
  useEffect(() => {
    async function fetchStatus() {
      if (!currentUser?.uid) return;
      const [friendsList, outgoingReqs] = await Promise.all([
        getFriendsList(currentUser.uid),
        getOutgoingRequests(currentUser.uid)
      ]);
      setFriends(friendsList.map(u => u.uid));
      setOutgoing(outgoingReqs.map(r => r.to));
    }
    fetchStatus();
  }, [currentUser]);

  // Debounced search
  const doSearch = useCallback(debounce(async (q) => {
    if (!q) return setResults([]);
    setLoading(true);
    try {
      const users = await searchUsers(q);
      // Exclude self
      setResults(users.filter(u => u.uid !== currentUser.uid));
    } catch (err) {
      setResults([]);
    }
    setLoading(false);
  }, 400), [currentUser]);

  useEffect(() => {
    doSearch(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const getStatus = (user) => {
    if (friends.includes(user.uid)) return 'friend';
    if (outgoing.includes(user.uid)) return 'pending';
    return 'none';
  };

  const handleAddFriend = async (user) => {
    setActionLoading(user.uid);
    try {
      await sendFriendRequest(currentUser.uid, user.uid);
      toast.success('Friend request sent!');
      setOutgoing([...outgoing, user.uid]);
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setActionLoading('');
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <ToastContainer position="top-center" autoClose={1400} />
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Find Users</h2>
      <input
        type="text"
        placeholder="Search by name or email..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ccc', marginBottom: 18, fontSize: 16 }}
      />
      {loading ? (
        <div>Searching...</div>
      ) : results.length === 0 && query ? (
        <div style={{ color: '#888', fontWeight: 500 }}>No users found</div>
      ) : (
        results.map(user => {
          const status = getStatus(user);
          return (
            <div key={user.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'User')} alt="avatar" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{user.displayName}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{user.email}</div>
                </div>
              </div>
              <div>
                {status === 'friend' ? (
                  <span style={{ color: '#4CAF50', fontWeight: 600 }}>Friend</span>
                ) : status === 'pending' ? (
                  <span style={{ color: '#888', fontWeight: 600 }}>Pending</span>
                ) : (
                  <button onClick={() => handleAddFriend(user)} disabled={actionLoading === user.uid} style={{ background: '#667eea', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: actionLoading === user.uid ? 'not-allowed' : 'pointer', opacity: actionLoading === user.uid ? 0.7 : 1 }}>{actionLoading === user.uid ? 'Sending...' : 'Add Friend'}</button>
                )}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default UserSearch; 