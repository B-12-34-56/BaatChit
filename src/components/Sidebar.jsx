import React from 'react'
import Navbar from './Navbar'
import Search from './Search'
import Chats from './Chats'
import { useContext, useEffect, useState } from 'react'
import { AuthContext } from '../context/AuthContext'
import { db } from '../utils/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { ChatContext } from '../context/ChatContext'
import FriendRequestsDropdown from './FriendRequestsDropdown'

const Sidebar = () => {
  const { currentUser } = useContext(AuthContext)
  const { dispatch } = useContext(ChatContext)
  const [friends, setFriends] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchFriends = async () => {
      if (!currentUser?.uid) return
      setLoading(true)
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid))
        const friendUids = userDoc.exists() ? (userDoc.data().friends || []) : []
        const friendProfiles = []
        for (const uid of friendUids) {
          const friendDoc = await getDoc(doc(db, 'users', uid))
          if (friendDoc.exists()) {
            friendProfiles.push({ uid, ...friendDoc.data() })
          }
        }
        setFriends(friendProfiles)
      } catch (err) {
        setFriends([])
      }
      setLoading(false)
    }
    fetchFriends()
  }, [currentUser])

  return (
    <div style={{
      width: 320,
      minWidth: 220,
      maxWidth: 340,
      background: 'linear-gradient(135deg, #e3e6f3 0%, #f7f8fa 100%)',
      borderRight: '1.5px solid #e0e0e0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      padding: '0 0 0 0',
      height: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ padding: '24px 18px 10px 18px', borderBottom: '1.5px solid #e0e0e0', background: 'rgba(255,255,255,0.95)' }}>
        <Navbar />
        <div style={{ marginTop: 10, marginBottom: 10 }}>
          <FriendRequestsDropdown />
        </div>
      </div>
      <div style={{ padding: '18px 18px 10px 18px', borderBottom: '1.5px solid #e0e0e0', background: 'rgba(255,255,255,0.92)' }}>
        <div style={{ marginTop: 10 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#667eea' }}>Friends</span>
          {loading && <div style={{ fontSize: 13, color: '#aaa' }}>Loading...</div>}
          {(!loading && friends.length === 0) && <div style={{ fontSize: 13, color: '#aaa' }}>No friends yet.</div>}
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {friends.map(friend => (
              <li key={friend.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', cursor: 'pointer' }} onClick={() => dispatch({ type: 'CHANGE_USER', payload: friend })}>
                <img src={friend.photoURL} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
                <span style={{ fontWeight: 600, fontSize: 14 }}>{friend.displayName || friend.email}</span>
                <span style={{ fontSize: 12, color: '#888', marginLeft: 6 }}>{friend.email}</span>
              </li>
            ))}
          </ul>
        </div>
        <Search />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: 'none' }}>
        <Chats />
      </div>
    </div>
  )
}

export default Sidebar