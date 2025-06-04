import React from 'react'
import Sidebar from '../components/Sidebar'
import Chat from '../components/Chat'

const Home = () => {
  return (
    <div style={{
      height: '100vh',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      padding: 0,
      margin: 0,
    }}>
      <div style={{
        background: 'white',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(44, 62, 80, 0.15)',
        width: 1200,
        maxWidth: '98vw',
        minHeight: 700,
        height: '90vh',
        maxHeight: '90vh',
        minWidth: 340,
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        padding: 0,
      }}>
        <Sidebar />
        <Chat />
      </div>
    </div>
  )
}

export default Home