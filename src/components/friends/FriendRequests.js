import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import { friendRequestService, acceptFriendRequest, rejectFriendRequest } from '../../services/friendRequestService';
import { getUserById } from '../../services/userService';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { db } from '../../utils/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

const FriendRequests = () => {
  const { currentUser } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [loadingId, setLoadingId] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser?.uid) return;
    setLoading(true);
    const q = query(collection(db, 'friendRequests'), where('to', '==', currentUser.uid), where('status', '==', 'pending'));
    const unsub = onSnapshot(q, async (snapshot) => {
      const reqs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Fetch user info for each request
      const withUserInfo = await Promise.all(reqs.map(async req => {
        const user = await getUserById(req.from);
        return { ...req, fromUser: user };
      }));
      setRequests(withUserInfo);
      setLoading(false);
    });
    return () => unsub();
  }, [currentUser]);

  const handleAccept = async (id) => {
    setLoadingId(id);
    try {
      await friendRequestService.acceptFriendRequest(id, currentUser.uid);
      toast.success('Friend request accepted!');
    } catch (err) {
      toast.error('Error accepting request: ' + err.message);
    }
    setLoadingId(null);
  };
  const handleReject = async (id) => {
    setLoadingId(id);
    try {
      await friendRequestService.rejectFriendRequest(id, currentUser.uid);
      toast.info('Friend request rejected.');
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
          <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #eee' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={req.fromUser?.photoURL || 'https://ui-avatars.com/api/?name=' + (req.fromUser?.displayName || 'User')} alt="avatar" style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{req.fromUser?.displayName || req.from}</div>
                <div style={{ fontSize: 13, color: '#888' }}>{req.fromUser?.email}</div>
              </div>
            </div>
            <div>
              <button onClick={() => handleAccept(req.id)} disabled={loadingId === req.id} style={{ marginRight: 8, background: '#4CAF50', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: loadingId === req.id ? 'not-allowed' : 'pointer', opacity: loadingId === req.id ? 0.7 : 1 }}>{loadingId === req.id ? 'Accepting...' : 'Accept'}</button>
              <button onClick={() => handleReject(req.id)} disabled={loadingId === req.id} style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 6, padding: '6px 14px', fontWeight: 600, cursor: loadingId === req.id ? 'not-allowed' : 'pointer', opacity: loadingId === req.id ? 0.7 : 1 }}>{loadingId === req.id ? 'Rejecting...' : 'Reject'}</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default FriendRequests; 