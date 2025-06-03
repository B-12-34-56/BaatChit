import React, { useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { searchUsers } from '../../services/userService';
import { friendRequestService } from '../../services/friendRequestService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { messageService } from '../../services/messageService';
import { ChatContext } from '../../context/ChatContext';

// Debounced search with abort
function useDebouncedSearch(searchTerm, delay = 300) {
  const [results, setResults] = useState([]);
  const abortControllerRef = useRef();

  useEffect(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    const timer = setTimeout(async () => {
      if (searchTerm) {
        try {
          const users = await searchUsers(searchTerm, {
            signal: abortControllerRef.current.signal
          });
          setResults(users);
        } catch (err) {
          if (err.name !== 'AbortError') throw err;
        }
      } else {
        setResults([]);
      }
    }, delay);

    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [searchTerm, delay]);

  return results;
}

const UserSearch = () => {
  const [currentUser] = useAuthState(auth);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [friends, setFriends] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [actionLoading, setActionLoading] = useState('');
  const { dispatch } = useContext(ChatContext);
  const [chatLoading, setChatLoading] = useState('');

  // Fetch friends and outgoing requests for status
  useEffect(() => {
    async function fetchStatus() {
      if (!currentUser?.uid) return;
      const [friendsList, outgoingReqs] = await Promise.all([
        friendRequestService.getFriends(currentUser.uid),
        friendRequestService.getOutgoingRequests(currentUser.uid)
      ]);
      setFriends(friendsList.map(u => u.uid));
      // FIXED: Changed from 'to' to 'receiverId'
      setOutgoing(outgoingReqs.map(r => r.receiverId));
    }
    fetchStatus();
  }, [currentUser]);

  // Use debounced search with abort
  const results = useDebouncedSearch(query, 400);

  useEffect(() => {
    setLoading(!!query && results.length === 0);
  }, [query, results]);

  const getStatus = (user) => {
    if (friends.includes(user.uid)) return 'friend';
    if (outgoing.includes(user.uid)) return 'pending';
    return 'none';
  };

  const handleAddFriend = async (user) => {
    setActionLoading(user.uid);
    try {
      const result = await friendRequestService.sendFriendRequest(currentUser.uid, user.uid);
      if (!result.success) {
        toast.error(result.message || 'Failed to send friend request');
      } else {
        toast.success('Friend request sent!');
        setOutgoing([...outgoing, user.uid]);
      }
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
    setActionLoading('');
  };

  const handleStartChat = async (user) => {
    setChatLoading(user.uid);
    try {
      // 1. Create/get conversation
      const conversationId = await messageService.createConversation(currentUser.uid, user.uid);
      
      // 2. Update chat context to open the chat
      dispatch({
        type: 'CHANGE_USER',
        payload: {
          uid: user.uid,
          displayName: user.displayName,
          photoURL: user.photoURL,
          chatId: conversationId
        }
      });
      
      toast.success('Chat started!');
    } catch (err) {
      console.error('Error starting chat:', err);
      toast.error('Failed to start chat: ' + (err.message || 'Unknown error'));
    }
    setChatLoading('');
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
        style={{ 
          width: '100%', 
          padding: 10, 
          borderRadius: 8, 
          border: '1px solid #ccc', 
          marginBottom: 18, 
          fontSize: 16 
        }}
      />
      {loading ? (
        <div>Searching...</div>
      ) : results.length === 0 && query ? (
        <div style={{ color: '#888', fontWeight: 500 }}>No users found</div>
      ) : (
        results.map(user => {
          const status = getStatus(user);
          return (
            <div key={user.uid} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '12px 0', 
              borderBottom: '1px solid #eee' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <img 
                  src={user.photoURL || 'https://ui-avatars.com/api/?name=' + (user.displayName || 'User')} 
                  alt="avatar" 
                  style={{ 
                    width: 38, 
                    height: 38, 
                    borderRadius: '50%', 
                    objectFit: 'cover', 
                    boxShadow: '0 1px 4px rgba(44,62,80,0.10)' 
                  }} 
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 16 }}>{user.displayName}</div>
                  <div style={{ fontSize: 13, color: '#888' }}>{user.email}</div>
                </div>
              </div>
              <div>
                {status === 'friend' ? (
                  <button 
                    onClick={() => handleStartChat(user)} 
                    disabled={chatLoading === user.uid} 
                    style={{ 
                      background: '#4CAF50', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 6, 
                      padding: '6px 14px', 
                      fontWeight: 600, 
                      cursor: chatLoading === user.uid ? 'not-allowed' : 'pointer', 
                      opacity: chatLoading === user.uid ? 0.7 : 1 
                    }}>
                    {chatLoading === user.uid ? 'Starting...' : 'Chat'}
                  </button>
                ) : status === 'pending' ? (
                  <span style={{ color: '#888', fontWeight: 600 }}>Pending</span>
                ) : (
                  <button 
                    onClick={() => handleAddFriend(user)} 
                    disabled={actionLoading === user.uid} 
                    style={{ 
                      background: '#667eea', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 6, 
                      padding: '6px 14px', 
                      fontWeight: 600, 
                      cursor: actionLoading === user.uid ? 'not-allowed' : 'pointer', 
                      opacity: actionLoading === user.uid ? 0.7 : 1, 
                    }}>
                    {actionLoading === user.uid ? 'Sending...' : 'Add Friend'}
                  </button>
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