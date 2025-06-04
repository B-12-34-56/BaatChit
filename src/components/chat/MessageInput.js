import React, { useContext, useState, useRef, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import attachIcon from '../../img/attach.png';
import { getStorage, ref, uploadBytes, getDownloadURL, listAll, getMetadata } from "firebase/storage";

async function getFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function checkForDuplicate(userId, fileHash) {
  const storage = getStorage();
  const userUploadsRef = ref(storage, `user_uploads/${userId}`);
  
  try {
    const listResult = await listAll(userUploadsRef);
    
    for (const itemRef of listResult.items) {
      try {
        const metadata = await getMetadata(itemRef);
        if (metadata.customMetadata && metadata.customMetadata.fileHash === fileHash) {
          return {
            isDuplicate: true,
            existingUrl: await getDownloadURL(itemRef),
            originalName: metadata.name,
            tag: 'duplicate'
          };
        }
      } catch (err) {
        console.error('Error checking metadata:', err);
      }
    }
  } catch (err) {
    console.error('Error listing files:', err);
  }
  
  return { isDuplicate: false };
}

async function uploadImageToFirebase(file, userId, fileHash) {
  const storage = getStorage();
  const timestamp = Date.now();
  const fileName = `image_${timestamp}_${file.name}`;
  const storageRef = ref(storage, `user_uploads/${userId}/${fileName}`);
  
  // Add custom metadata including the file hash
  const metadata = {
    customMetadata: {
      fileHash: fileHash,
      originalName: file.name,
      uploadTimestamp: timestamp.toString(),
      tag: 'original'
    }
  };
  
  await uploadBytes(storageRef, file, metadata);
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
  const uploadTaskRef = useRef(null);

  useEffect(() => {
    return () => {
      if (uploadTaskRef.current) {
        uploadTaskRef.current.cancel();
      }
    };
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !imageFile) || !data.chatId) return;
    
    let imageHash = null;
    let imageUrl = null;
    let imageTag = null;
    
    if (imageFile) {
      imageHash = await getFileHash(imageFile);
      setDuplicateWarning('');
      setUploading(true);
      
      try {
        // Check for duplicates first
        const duplicateCheck = await checkForDuplicate(currentUser.uid, imageHash);
        
        if (duplicateCheck.isDuplicate) {
          // Use existing image URL for duplicate
          imageUrl = duplicateCheck.existingUrl;
          imageTag = 'duplicate';
          setDuplicateWarning(`Duplicate detected! Using existing image: ${duplicateCheck.originalName} [DUPLICATE]`);
        } else {
          // Upload new image
          imageUrl = await uploadImageToFirebase(imageFile, currentUser.uid, imageHash);
          imageTag = 'original';
          setDuplicateWarning('New image uploaded successfully! [ORIGINAL]');
        }
      } catch (err) {
        if (err.code === 'storage/canceled') {
          console.log('Upload was canceled');
        } else {
          setDuplicateWarning('Image upload failed.');
        }
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
        text: text || (imageFile ? `[Image: ${imageFile.name}]` : ''),
        type: imageFile ? 'image' : 'text',
        imageUrl,
        imageHash,
        imageTag,
        createdAt: new Date(),
      },
      data.user?.uid
    );
    setText('');
    setImageFile(null);
    setDuplicateWarning('');
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
        onChange={e => setText(e.target.value)}
        placeholder="Type a message"
        style={{ flex: 1, padding: '10px 16px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 16, outline: 'none' }}
        disabled={uploading}
      />
      {/* Pin/Attach icon (Firebase Storage) */}
      <button type="button" onClick={handleAttachClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Attach image (Firebase)" disabled={uploading}>
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
        <div style={{ color: duplicateWarning.includes('[DUPLICATE]') ? '#ff9800' : '#4caf50', fontWeight: 600, marginTop: 8 }}>
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