import React, { useEffect, useState, useContext } from 'react';
import { getIncomingRequests, acceptRequest, rejectRequest } from '../services/friendRequestService';
import { AuthContext } from '../context/AuthContext';

const FriendRequestsDropdown = () => {
  const { currentUser } = useContext(AuthContext);
  const [requests, setRequests] = useState([]);
  const [open, setOpen] = useState(false);

  const fetchRequests = async () => {
    if (!currentUser?.uid) return;
    const reqs = await getIncomingRequests(currentUser.uid);
    setRequests(reqs);
  };

  useEffect(() => { fetchRequests(); }, [currentUser]);

  const handleAccept = async (id) => {
    await acceptRequest(id, currentUser.uid);
    fetchRequests();
  };
  const handleReject = async (id) => {
    await rejectRequest(id);
    fetchRequests();
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative' }}>
        <span role="img" aria-label="Friend Requests" style={{ fontSize: 24 }}>🔔</span>
        {requests.length > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, background: '#e53e3e', color: 'white', borderRadius: '50%', fontSize: 12, padding: '2px 6px', fontWeight: 700 }}>{requests.length}</span>
        )}
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 32, background: 'white', border: '1px solid #ccc', borderRadius: 8, boxShadow: '0 2px 8px rgba(44,62,80,0.12)', minWidth: 220, zIndex: 100 }}>
          <div style={{ padding: 12, fontWeight: 700, borderBottom: '1px solid #eee' }}>Friend Requests</div>
          {requests.length === 0 ? (
            <div style={{ padding: 12, color: '#888' }}>No pending requests</div>
          ) : (
            requests.map(req => (
              <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 10, borderBottom: '1px solid #f0f0f0' }}>
                <span>{req.from}</span>
                <div>
                  <button onClick={() => handleAccept(req.id)} style={{ marginRight: 6, background: '#4CAF50', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>Accept</button>
                  <button onClick={() => handleReject(req.id)} style={{ background: '#e53e3e', color: 'white', border: 'none', borderRadius: 4, padding: '4px 8px', cursor: 'pointer' }}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default FriendRequestsDropdown; 