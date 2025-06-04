import React, { useContext, useState, useRef, useEffect } from 'react';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import attachIcon from '../../img/attach.png';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";

async function getFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// GLOBAL duplicate and count check - changed from per-user to global
async function getUploadLog(fileHash) {
  const db = getFirestore();
  // Changed: Using global_upload_logs instead of user_upload_logs
  const logRef = doc(db, "global_upload_logs", fileHash);
  const logSnap = await getDoc(logRef);
  return logSnap.exists() ? logSnap.data() : null;
}

async function incrementUploadLog(userId, userName, fileHash, fileName) {
  const db = getFirestore();
  // Changed: Using global_upload_logs instead of user_upload_logs
  const logRef = doc(db, "global_upload_logs", fileHash);
  const logSnap = await getDoc(logRef);
  
  const uploadEntry = {
    userId,
    userName: userName || 'Anonymous',
    timestamp: Date.now()
  };
  
  if (logSnap.exists()) {
    const currentData = logSnap.data();
    await updateDoc(logRef, {
      count: currentData.count + 1,
      lastUploadedAt: serverTimestamp(),
      fileName,
      // Store upload history for UI display
      uploads: [...(currentData.uploads || []), uploadEntry]
    });
  } else {
    await setDoc(logRef, {
      fileHash,
      count: 1,
      lastUploadedAt: serverTimestamp(),
      fileName,
      // Store first upload info
      firstUploaderId: userId,
      firstUploaderName: userName || 'Anonymous',
      uploads: [uploadEntry]
    });
  }
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
        // GLOBAL duplicate and count check - no userId needed
        console.log('Checking for duplicates...');
        const log = await getUploadLog(imageHash);
        console.log('Duplicate check result:', log);
        
        if (log && log.count >= 2) {
          // Show who uploaded it before in the warning
          const firstUploader = log.firstUploaderName || 'Someone';
          const secondUploader = log.uploads && log.uploads[1] ? log.uploads[1].userName : 'Someone else';
          setDuplicateWarning(`This image has already been uploaded twice (first by ${firstUploader}, then by ${secondUploader}). Upload blocked.`);
          setUploading(false);
          return;
        } else if (log && log.count === 1) {
          // Allow upload, mark as duplicate
          imageTag = 'duplicate';
          const firstUploader = log.firstUploaderName || 'Someone';
          setDuplicateWarning(`Duplicate detected! This image was first uploaded by ${firstUploader}. [DUPLICATE]`);
        } else {
          // First upload
          imageTag = 'original';
          setDuplicateWarning('New image uploaded successfully! [ORIGINAL]');
        }
        
        // Always upload a new file
        console.log('Uploading to Firebase Storage...');
        imageUrl = await uploadImageToFirebase(imageFile, currentUser.uid, imageHash);
        console.log('Upload successful, URL:', imageUrl);
        
        // Increment log in Firestore with user info
        console.log('Updating global upload log...');
        await incrementUploadLog(
          currentUser.uid, 
          currentUser.displayName || currentUser.email, 
          imageHash, 
          imageFile.name
        );
        console.log('Global log updated');
      } catch (err) {
        console.error('Upload error:', err);
        console.error('Error details:', {
          message: err.message,
          code: err.code,
          stack: err.stack
        });
        setDuplicateWarning(`Image upload failed: ${err.message || 'Unknown error'}`);
        setUploading(false);
        return;
      }
      setUploading(false);
    }
    
    // Send message
    console.log('Sending message...');
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
      <button type="submit" style={{ padding: '10px 22px', borderRadius: 8, background: '#667eea', color: '#fff', border: 'none', fontWeight: 600, fontSize: 16, cursor: 'pointer', transition: 'background 0.2s' }} disabled={uploading || (duplicateWarning && duplicateWarning.includes('blocked'))}>
        {uploading ? 'Uploading…' : 'Send'}
      </button>
      {duplicateWarning && (
        <div style={{ color: duplicateWarning.includes('[DUPLICATE]') ? '#ff9800' : duplicateWarning.includes('blocked') ? '#e53e3e' : '#4caf50', fontWeight: 600, marginTop: 8 }}>
          {duplicateWarning}
        </div>
      )}
      {imageFile && (
        <div style={{ margin: '12px 0', color: '#444', fontWeight: 500, display: 'flex', alignItems: 'center' }}>
          {imageFile.name} ({Math.round(imageFile.size / 1024)} KB)
          <button
            type="button"
            onClick={() => {
              setImageFile(null);
              setDuplicateWarning('');
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
            style={{
              marginLeft: 8,
              background: 'none',
              border: 'none',
              color: '#e53e3e',
              fontWeight: 700,
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1
            }}
            aria-label="Remove image"
            title="Remove image"
          >
            ×
          </button>
        </div>
      )}
    </form>
  );
};

export default MessageInput;