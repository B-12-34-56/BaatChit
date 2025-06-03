import React, { useEffect, useState } from 'react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { db } from '../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { friendRequestService } from '../services/friendRequestService';
import { getUserById } from '../services/userService';
import { toast } from 'react-toastify';

const FriendRequestsDropdown = () => {
  const [currentUser] = useAuthState(auth);
  const [requests, setRequests] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingId, setLoadingId] = useState(null);
  const [acceptedId, setAcceptedId] = useState(null);
  const [newFriend, setNewFriend] = useState(null);

  useEffect(() => {
    if (!currentUser?.uid) return;
    
    let isMounted = true;
    
    const q = query(collection(db, 'friendRequests'), where('receiverId', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, 
      async (snapshot) => {
        if (!isMounted) return;
        
        const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const withUserInfo = await Promise.all(reqs.map(async req => {
          const user = await getUserById(req.from);
          return { ...req, fromUser: user };
        }));
        setRequests(withUserInfo);
      },
      (error) => {
        if (!isMounted) return;
        console.error('FriendRequestsDropdown listener error:', error);
      }
    );
    
    return () => {
      isMounted = false;
      unsub();
    };
  }, [currentUser]);

  const handleAccept = async (id) => {
    setLoadingId(id);
    const result = await friendRequestService.acceptFriendRequest(id, currentUser.uid);
    if (!result.success) {
      toast.error('Error: ' + (result.message || 'Failed to accept request'));
      setLoadingId(null);
      return;
    }
    setAcceptedId(id);
    toast.success('Friend request accepted!');
    setNewFriend(result.friend);
    setTimeout(() => setAcceptedId(null), 1200);
    setLoadingId(null);
  };
  const handleReject = async (id) => {
    setLoadingId(id);
    await friendRequestService.rejectFriendRequest(id, currentUser.uid);
    setLoadingId(null);
  };

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setModalOpen(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <span role="img" aria-label="bell" style={{ fontSize: 24 }}>🔔</span>
        {requests.length > 0 && (
          <span style={{ position: 'absolute', top: -4, right: -4, background: '#e53e3e', color: 'white', borderRadius: '50%', fontSize: 12, padding: '2px 6px', fontWeight: 700 }}>{requests.length}</span>
        )}
      </button>
      {modalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(44,62,80,0.18)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setModalOpen(false)}>
          <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 24px rgba(44,62,80,0.18)', padding: 32, minWidth: 340, maxWidth: '90vw', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setModalOpen(false)} style={{ position: 'absolute', top: 10, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }}>×</button>
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 18 }}>Friend Requests</h3>
            {requests.length === 0 ? (
              <div style={{ color: '#888', fontWeight: 500 }}>No pending requests</div>
            ) : (
              requests.map(req => (
                <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee', opacity: acceptedId === req.id ? 0.5 : 1, transition: 'opacity 0.5s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <img src={req.fromUser?.photoURL || 'https://ui-avatars.com/api/?name=' + (req.fromUser?.displayName || 'User')} alt="avatar" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 16 }}>{req.fromUser?.displayName || req.from}</div>
                      <div style={{ fontSize: 13, color: '#888' }}>{req.fromUser?.email}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {acceptedId === req.id ? (
                      <span style={{ color: '#4CAF50', fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="10" cy="10" r="10" fill="#4CAF50"/><path d="M6 10.5L9 13.5L14 8.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        Accepted!
                      </span>
                    ) : (
                      <>
                        <button onClick={() => handleAccept(req.id)} disabled={loadingId === req.id} style={{ marginRight: 8, background: '#4CAF50', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: loadingId === req.id ? 'not-allowed' : 'pointer', opacity: loadingId === req.id ? 0.7 : 1 }}>{loadingId === req.id ? 'Accepting...' : 'Accept'}</button>
                        <button onClick={() => handleReject(req.id)} disabled={loadingId === req.id} style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: loadingId === req.id ? 'not-allowed' : 'pointer', opacity: loadingId === req.id ? 0.7 : 1 }}>{loadingId === req.id ? 'Rejecting...' : 'Reject'}</button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
      {newFriend && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(44,62,80,0.18)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setNewFriend(null)}>
          <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 24px rgba(44,62,80,0.18)', padding: 32, minWidth: 320, maxWidth: '90vw', position: 'relative' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setNewFriend(null)} style={{ position: 'absolute', top: 10, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }}>×</button>
            <h3 style={{ fontWeight: 700, fontSize: 20, marginBottom: 18 }}>You are now friends!</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 18 }}>
              <img src={newFriend.photoURL || 'https://ui-avatars.com/api/?name=' + (newFriend.displayName || 'User')} alt="avatar" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 18 }}>{newFriend.displayName || newFriend.uid}</div>
                <div style={{ fontSize: 14, color: '#888' }}>{newFriend.email}</div>
              </div>
            </div>
            <button onClick={() => setNewFriend(null)} style={{ background: '#667eea', color: 'white', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 16, cursor: 'pointer', marginTop: 8 }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendRequestsDropdown; 