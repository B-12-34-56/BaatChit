import React, { useEffect, useState } from 'react';
import { friendRequestService } from '../../services/friendRequestService';
import { getUserById } from '../../services/userService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';

const FriendRequests = () => {
  const [currentUser] = useAuthState(auth);
  const [requests, setRequests] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [acceptedId, setAcceptedId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid || typeof currentUser.uid !== 'string' || !currentUser.uid.trim()) return;
    
    let isMounted = true;
    setLoading(true);
    
    // FIXED: Changed 'to' to 'receiverId' to match the service and rules
    const q = query(
      collection(db, 'friendRequests'), 
      where('receiverId', '==', currentUser.uid), 
      where('status', '==', 'pending')
    );
    
    const unsub = onSnapshot(q, 
      async (snapshot) => {
        if (!isMounted) return;
        
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const withUserInfo = await Promise.all(reqs.map(async req => {
          const user = await getUserById(req.from);
          return { ...req, fromUser: user };
        }));
        setRequests(withUserInfo);
        setLoading(false);
      },
      (error) => {
        if (!isMounted) return;
        console.error('FriendRequests listener error:', error);
        toast.error('Error loading friend requests');
        setLoading(false);
      }
    );
    
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  const handleAccept = async (id) => {
    setLoadingId(id);
    try {
      const result = await friendRequestService.acceptFriendRequest(id, currentUser.uid);
      if (!result.success) {
        toast.error('Error: ' + (result.message || 'Failed to accept request'));
        setLoadingId(null);
        return;
      }
      setAcceptedId(id);
      toast.success('Friend request accepted!');
      
      // Remove the request from local state immediately
      setRequests(prevRequests => prevRequests.filter(req => req.id !== id));
      
      setTimeout(() => setAcceptedId(null), 1200);
    } catch (err) {
      toast.error('Error accepting request: ' + err.message);
    }
    setLoadingId(null);
  };
  
  const handleReject = async (id) => {
    setLoadingId(id);
    try {
      const result = await friendRequestService.rejectFriendRequest(id, currentUser.uid);
      if (!result.success) {
        toast.error('Error: ' + (result.message || 'Failed to reject request'));
        setLoadingId(null);
        return;
      }
      toast.info('Friend request rejected.');
      
      // Remove the request from local state immediately
      setRequests(prevRequests => prevRequests.filter(req => req.id !== id));
    } catch (err) {
      toast.error('Error rejecting request: ' + err.message);
    }
    setLoadingId(null);
  };

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: 24 }}>
      <ToastContainer position="top-center" autoClose={1400} />
      <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 18 }}>Incoming Friend Requests</h2>
      {loading ? (
        <div>Loading...</div>
      ) : requests.length === 0 ? (
        <div style={{ color: '#888', fontWeight: 500 }}>No pending requests</div>
      ) : (
        requests.map(req => (
          <div key={req.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 0',
            borderBottom: '1px solid #eee',
            opacity: acceptedId === req.id ? 0.5 : 1,
            transition: 'opacity 0.5s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img 
                src={req.fromUser?.photoURL || 'https://ui-avatars.com/api/?name=' + (req.fromUser?.displayName || 'User')} 
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
                <div style={{ fontWeight: 600, fontSize: 16 }}>{req.fromUser?.displayName || req.from}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{req.fromUser?.email}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {acceptedId === req.id ? (
                <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="10" cy="10" r="10" fill="#4CAF50"/>
                    <path d="M6 10.5L9 13.5L14 8.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Accepted!
                </span>
              ) : (
                <>
                  <button 
                    onClick={() => handleAccept(req.id)} 
                    disabled={loadingId === req.id} 
                    style={{ 
                      marginRight: 8, 
                      background: '#4CAF50', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 6, 
                      padding: '6px 14px', 
                      fontWeight: 600, 
                      cursor: loadingId === req.id ? 'not-allowed' : 'pointer', 
                      opacity: loadingId === req.id ? 0.7 : 1 
                    }}>
                    {loadingId === req.id ? 'Accepting...' : 'Accept'}
                  </button>
                  <button 
                    onClick={() => handleReject(req.id)} 
                    disabled={loadingId === req.id} 
                    style={{ 
                      background: '#e53e3e', 
                      color: 'white', 
                      border: 'none', 
                      borderRadius: 6, 
                      padding: '6px 14px', 
                      fontWeight: 600, 
                      cursor: loadingId === req.id ? 'not-allowed' : 'pointer', 
                      opacity: loadingId === req.id ? 0.7 : 1 
                    }}>
                    {loadingId === req.id ? 'Rejecting...' : 'Reject'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default FriendRequests;