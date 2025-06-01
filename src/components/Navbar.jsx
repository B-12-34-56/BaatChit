import { signOut } from 'firebase/auth'
import React, { useContext } from 'react'
import { AuthContext } from '../context/AuthContext'
import { auth } from '../firebase'

const Navbar = () => {
  const {currentUser} = useContext(AuthContext);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 0 0 0',
      minHeight: 48,
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    }}>
      <span style={{
        fontWeight: 800,
        fontSize: 22,
        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        letterSpacing: 0.5,
      }}>Bundi/Kitab</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src={currentUser.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 1px 4px rgba(44,62,80,0.10)' }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: '#3a3a5a' }}>{currentUser.displayName}</span>
        <button
          onClick={() => signOut(auth)}
          style={{
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '6px 16px',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(44,62,80,0.10)',
            transition: 'background 0.2s',
          }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}

export default Navbar