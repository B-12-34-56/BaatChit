import React, { useContext, useState, useRef } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import attachIcon from '../../img/attach.png';
import reactIcon from '../../img/react-1-logo-black-and-white (1).png';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useNavigate } from 'react-router-dom';

async function getFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadImageToFirebase(file, userId) {
  const storage = getStorage();
  const storageRef = ref(storage, `user_uploads/${userId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return await getDownloadURL(storageRef);
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
      setDuplicateWarning('');
      setUploading(true);
      try {
        // Only Firebase Storage upload
        imageUrl = await uploadImageToFirebase(imageFile, currentUser.uid);
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
        senderUid: currentUser.uid,
        senderDisplayName: currentUser.displayName,
        senderPhotoURL: currentUser.photoURL,
        recipientDisplayName: data.user?.displayName,
        recipientPhotoURL: data.user?.photoURL,
        text,
        type: imageFile ? 'image' : 'text',
        imageUrl,
        imageHash,
        createdAt: new Date(),
      },
      data.user?.uid
    );
    setText('');
    setImageFile(null);
  };

  const handleAttachClick = () => {
    fileInputRef.current.click();
  };

  const handleReactIconClick = () => {
    navigate('/upload'); // Go to Upload.jsx for S3 logic
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImageFile(file);
    setDuplicateWarning('');
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
      {/* Pin/Attach icon (Firebase Storage) */}
      <button type="button" onClick={handleAttachClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Attach image (Firebase)" disabled={uploading}>
        <img src={attachIcon} alt="Attach" style={{ width: 26, height: 26, opacity: 0.8 }} />
      </button>
      {/* React icon (S3) navigates to Upload.jsx */}
      <button type="button" onClick={handleReactIconClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Go to S3 Upload" disabled={uploading}>
        <img src={reactIcon} alt="Upload" style={{ width: 26, height: 26, opacity: 0.8 }} />
      </button>
      <input
        type="file"
        accept="image/*"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={uploading}
      />
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