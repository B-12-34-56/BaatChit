import React, { useContext, useState, useRef } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
// TODO: Adjust the import path if messageService is elsewhere
import { messageService } from '../../services/messageService';
import { useNavigate } from 'react-router-dom';
import attachIcon from '../../img/attach.png';
import reactIcon from '../../img/react-1-logo-black-and-white (1).png';
import { getPresignedUrl, uploadFileToS3 } from '../../services/presignService';

const PRESIGN_API_URL = process.env.REACT_APP_PRESIGN_API_URL;

async function getFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const MessageInput = () => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);
  const [text, setText] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile) || !data.chatId) return;
    let imageHash = null;
    let imageUrl = null;
    if (imageFile) {
      imageHash = await getFileHash(imageFile);
      // Check for duplicate again before sending (safety)
      // const recentImages = await messageService.getRecentImageMessages(data.chatId, 20);
      // if (recentImages.some(msg => msg.imageHash === imageHash)) {
      //   setDuplicateWarning('Duplicate image detected!');
      //   return;
      // }
      setDuplicateWarning('');
      setUploading(true);
      try {
        // 1. Get presigned URL
        const presignedUrl = await getPresignedUrl(imageFile.name, imageFile.type, PRESIGN_API_URL);
        // 2. Upload to S3
        imageUrl = await uploadFileToS3(presignedUrl, imageFile);
      } catch (err) {
        setDuplicateWarning('Image upload failed.');
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    await messageService.sendMessage(
      data.chatId,
      {
        senderUID: currentUser.uid,
        senderDisplayName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL,
        recipientDisplayName: data.user?.displayName,
        recipientPhotoURL: data.user?.photoURL,
        text,
        type: imageFile ? 'image' : 'text',
        imageUrl,
        imageHash,
      },
      data.user?.uid // recipientId
    );
    setText('');
    setImageFile(null);
  };

  const handleAttachClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!data.chatId) {
      setImageFile(file);
      setDuplicateWarning('');
      return;
    }
    const hash = await getFileHash(file);
    // Fetch last 20 image messages in this chat
    // const recentImages = await messageService.getRecentImageMessages(data.chatId, 20);
    // if (recentImages.some(msg => msg.imageHash === hash)) {
    //   setDuplicateWarning('Duplicate image detected!');
    //   setImg(null);
    //   return;
    // }
    setDuplicateWarning('');
    setImageFile(file);
  };

  const handleReactIconClick = () => {
    navigate('/upload');
  };

  return (
    <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12, background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(44,62,80,0.04)' }}>
      <input
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a message"
        style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 16, outline: 'none' }}
        disabled={uploading}
      />
      {/* Pin/Attach icon */}
      <button type="button" onClick={handleAttachClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Attach image" disabled={uploading}>
        <img src={attachIcon} alt="Attach" style={{ width: 26, height: 26, opacity: 0.8 }} />
      </button>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={uploading}
      />
      {/* React icon for upload page */}
      <button type="button" onClick={handleReactIconClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Go to Upload" disabled={uploading}>
        <img src={reactIcon} alt="Upload" style={{ width: 26, height: 26, opacity: 0.8 }} />
      </button>
      <button type="submit" style={{ padding: '10px 22px', borderRadius: 8, background: '#667eea', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'background 0.2s' }} disabled={uploading}>
        {uploading ? 'Uploading…' : 'Send'}
      </button>
      {duplicateWarning && (
        <div style={{ color: 'red', fontWeight: 600, marginTop: 8 }}>
          {duplicateWarning}
        </div>
      )}
      {imageFile && (
        <div style={{ margin: '12px 0', color: '#444', fontWeight: 500 }}>
          {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
        </div>
      )}
    </form>
  );
};

export default MessageInput; 