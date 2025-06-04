import React, { useContext, useState } from 'react'
import Cam from "../img/cam.png"
import Add from "../img/add.png"
import More from "../img/more.png"
import MessageList from './chat/MessageList'
import MessageInput from './chat/MessageInput'
import { ChatContext } from '../context/ChatContext'
import { useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../utils/firebase'
import AddFriend from './AddFriend'

const Chat = () => {
  const {data} = useContext(ChatContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const navigate = useNavigate();

  const handleMenuClick = () => setMenuOpen((open) => !open);
  const handleProfile = () => { setMenuOpen(false); navigate('/profile'); };
  const handleLogout = () => { setMenuOpen(false); signOut(auth); };
  const handleAddFriend = () => setAddFriendOpen(true);
  const closeAddFriend = () => setAddFriendOpen(false);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      position: 'relative',
      background: '#fff',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '18px 24px',
        background: 'rgba(255,255,255,0.95)',
        borderBottom: '1.5px solid #e0e0e0',
        fontWeight: 700,
        fontSize: 18,
        color: '#3a3a5a',
        letterSpacing: 0.2,
        position: 'relative',
      }}>
        <span>{data.user.displayName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src={Cam} alt="Camera" title="Camera" style={{ width: 22, opacity: 1, cursor: 'pointer', filter: 'brightness(0.7)', transition: 'filter 0.2s' }} onMouseOver={e => e.currentTarget.style.filter = 'brightness(1)'} onMouseOut={e => e.currentTarget.style.filter = 'brightness(0.7)'} />
          <img src={Add} alt="Add Friend" title="Add Friend" style={{ width: 22, opacity: 1, cursor: 'pointer', filter: 'brightness(0.7)', transition: 'filter 0.2s' }} onClick={handleAddFriend} onMouseOver={e => e.currentTarget.style.filter = 'brightness(1)'} onMouseOut={e => e.currentTarget.style.filter = 'brightness(0.7)'} />
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <img src={More} alt="More" title="More" style={{ width: 22, opacity: 1, cursor: 'pointer', filter: 'brightness(0.7)', transition: 'filter 0.2s' }}
              onClick={handleMenuClick}
              onMouseOver={e => e.currentTarget.style.filter = 'brightness(1)'}
              onMouseOut={e => e.currentTarget.style.filter = 'brightness(0.7)'}
            />
            {menuOpen && (
              <div style={{ position: 'absolute', right: 0, top: 28, background: 'white', borderRadius: 10, boxShadow: '0 2px 12px rgba(44,62,80,0.13)', minWidth: 120, zIndex: 100, padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
                <button onClick={handleProfile} style={{ background: 'none', border: 'none', color: '#3a3a5a', fontWeight: 600, fontSize: 15, padding: '10px 18px', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f0f4ff'} onMouseOut={e => e.currentTarget.style.background = 'none'}>Profile</button>
                <button onClick={handleLogout} style={{ background: 'none', border: 'none', color: '#e53e3e', fontWeight: 600, fontSize: 15, padding: '10px 18px', textAlign: 'left', cursor: 'pointer', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.background = '#f0f4ff'} onMouseOut={e => e.currentTarget.style.background = 'none'}>Logout</button>
              </div>
            )}
          </div>
        </div>
        {addFriendOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(44,62,80,0.18)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={closeAddFriend}>
            <div style={{ background: 'white', borderRadius: 18, boxShadow: '0 4px 24px rgba(44,62,80,0.18)', padding: 32, minWidth: 320, maxWidth: '90vw', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <button onClick={closeAddFriend} style={{ position: 'absolute', top: 10, right: 16, background: 'none', border: 'none', fontSize: 22, color: '#888', cursor: 'pointer' }}>×</button>
              <AddFriend />
            </div>
          </div>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', overflow: 'hidden' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <MessageList />
        </div>
        <MessageInput />
      </div>
    </div>
  )
}

export default Chat