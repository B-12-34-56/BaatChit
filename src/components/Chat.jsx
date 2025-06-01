import React, { useContext } from 'react'
import Cam from "../img/cam.png"
import Add from "../img/add.png"
import More from "../img/more.png"
import Messages from './Messages'
import Input from './Input'
import { ChatContext } from '../context/ChatContext'

const Chat = () => {
  const {data} = useContext(ChatContext);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      background: 'linear-gradient(135deg, #f7f8fa 0%, #e3e6f3 100%)',
      borderRadius: 18,
      margin: '18px 18px 18px 0',
      boxShadow: '0 2px 8px rgba(44,62,80,0.06)',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
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
      }}>
        <span>{data.user.displayName}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <img src={Cam} alt="" style={{ width: 22, opacity: 0.7, cursor: 'pointer' }} />
          <img src={Add} alt="" style={{ width: 22, opacity: 0.7, cursor: 'pointer' }} />
          <img src={More} alt="" style={{ width: 22, opacity: 0.7, cursor: 'pointer' }} />
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <Messages />
        <Input />
      </div>
    </div>
  )
}

export default Chat