import React, { useContext, useState, useRef, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import attachIcon from '../../img/attach.png';
import { getPresignedUrl, uploadFileToS3 } from '../../services/presignService';
import { getImageTag } from '../../services/getTagService';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB

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
  const typingTimeoutRef = useRef(null);

  // Typing indicator logic
  const handleTyping = async (e) => {
    setText(e.target.value);
    if (!data.chatId || !currentUser?.uid) return;
    // Set typing true
    messageService.setTypingStatus(data.chatId, currentUser.uid, true);
    // Clear previous timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    // Set typing false after 1.5s of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      messageService.setTypingStatus(data.chatId, currentUser.uid, false);
    }, 1500);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile) || !data.chatId) return;
    let imageHash = null;
    let imageUrl = null;

    // Image upload logic (S3)
    if (imageFile) {
      if (imageFile.size > MAX_IMAGE_SIZE) {
        setDuplicateWarning('Image is too large (max 5MB).');
        setUploading(false);
        return;
      }
      imageHash = await getFileHash(imageFile);
      setDuplicateWarning('');
      setUploading(true);
      try {
        // Check for duplicate using getTagService (by hash or filename)
        const tagResult = await getImageTag(imageFile.name);
        if (tagResult && tagResult.duplicate) {
          setDuplicateWarning('Duplicate image detected.');
          setUploading(false);
          return;
        }
        // Upload to S3
        const presignApiUrl = process.env.REACT_APP_PRESIGN_API_URL || process.env.PRESIGN_API_URL;
        const presignedUrl = await getPresignedUrl(imageFile.name, imageFile.type, presignApiUrl);
        imageUrl = await uploadFileToS3(presignedUrl, imageFile);
      } catch (err) {
        setDuplicateWarning('Image upload failed: ' + (err.message || 'Unknown error'));
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    // Send the message (text or image)
    const result = await messageService.sendMessage(
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
      },
      data.user?.uid
    );

    if (!result.success) {
      setDuplicateWarning('Failed to send message: ' + (result.error || 'Unknown error'));
      return;
    }

    setText('');
    setImageFile(null);
  };

  const handleAttachClick = () => {
    fileInputRef.current.click();
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
        onChange={handleTyping}
        placeholder="Type a message"
        style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 16, outline: 'none' }}
        disabled={uploading}
      />
      {/* Pin/Attach icon (S3) */}
      <button type="button" onClick={handleAttachClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Attach image (S3)" disabled={uploading}>
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