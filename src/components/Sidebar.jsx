import React from 'react'
import Navbar from './Navbar'
import Search from './Search'
import Chats from './Chats'

const Sidebar = () => {
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
      </div>
      <div style={{ padding: '18px 18px 10px 18px', borderBottom: '1.5px solid #e0e0e0', background: 'rgba(255,255,255,0.92)' }}>
        <Search />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: 'none' }}>
        <Chats />
      </div>
    </div>
  )
}

export default Sidebar