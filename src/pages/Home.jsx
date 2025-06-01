import React from 'react'
import Sidebar from '../components/Sidebar'
import Chat from '../components/Chat'

const Home = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(44, 62, 80, 0.15)',
        width: 1100,
        maxWidth: '98vw',
        minHeight: 600,
        minWidth: 340,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
      }}>
        <Sidebar />
        <Chat />
      </div>
    </div>
  )
}

export default Home