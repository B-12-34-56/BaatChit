import { signOut } from 'firebase/auth'
import React, { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { auth } from '../firebase'
import { useNavigate } from 'react-router-dom'

const Navbar = () => {
  const {currentUser} = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 0 0 0',
      minHeight: 48,
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      background: 'white',
      zIndex: 10,
      position: 'relative',
      boxShadow: '0 2px 8px rgba(44,62,80,0.06)',
    }}>
      <span style={{
        fontWeight: 800,
        fontSize: 22,
        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: 0.5,
        flex: 1,
        textAlign: 'left',
      }}>Bundi/Kitab</span>
      {/* Optionally, show avatar/displayName in center or remove for minimal look */}
      {/* <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, justifyContent: 'center' }}>
        <img src={currentUser.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: '#3a3a5a' }}>{currentUser.displayName}</span>
      </div> */}
      <div style={{ flex: 1 }}></div>
    </div>
  )
}

export default Navbar