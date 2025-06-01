import React, { useState } from 'react';
import UploadStatus from '../components/UploadStatus';
import { getPresignedUrl } from '../services/presignService';
import { getImageTag } from '../services/getTagService';

const BLOCKED_KEYWORDS = ['name', 'signature', 'sign', 'signed'];

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

export default function Upload() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ message: '', type: 'info', show: false });
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setStatus({ ...status, show: false });
  };

  const handleUpload = async () => {
    if (!file) {
      setStatus({ message: 'Please select an image first!', type: 'error', show: true });
      return;
    }
    if (isBlockedFilename(file.name)) {
      setStatus({ message: 'Blocked: Image filename contains a forbidden word (name/signature/etc).', type: 'error', show: true });
      return;
    }
    setUploading(true);
    setStatus({ message: 'Checking for duplicates...', type: 'info', show: true });
    // Check for duplicate by filename (S3 or Lambda API)
    const tagResult = await getImageTag(file.name);
    if (tagResult && tagResult.duplicate) {
      setStatus({ message: 'Duplicate image detected. Upload blocked.', type: 'warning', show: true });
      setUploading(false);
      return;
    }
    setStatus({ message: 'Uploading image...', type: 'info', show: true });
    try {
      // Get presigned URL
      const presignedUrl = await getPresignedUrl(file.name);
      // Upload to S3
      const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('S3 upload failed');
      setStatus({ message: 'Image uploaded successfully!', type: 'success', show: true });
    } catch (err) {
      setStatus({ message: err.message || 'Upload failed', type: 'error', show: true });
    } finally {
      setUploading(false);
    }
  };

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
        padding: '40px 32px',
        width: 420,
        maxWidth: '95vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <h2 style={{
          fontWeight: 800,
          fontSize: 28,
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 18,
        }}>Upload Image to S3</h2>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={uploading}
          style={{
            margin: '18px 0 8px 0',
            fontSize: 15,
            border: 'none',
            background: 'none',
            color: '#667eea',
            cursor: uploading ? 'not-allowed' : 'pointer',
          }}
        />
        {file && <div style={{ margin: '12px 0', color: '#444', fontWeight: 500 }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
        <button
          onClick={handleUpload}
          disabled={uploading || !file}
          style={{
            width: '100%',
            padding: '12px 0',
            background: uploading || !file ? 'linear-gradient(90deg, #b3b3b3 0%, #b3b3b3 100%)' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            borderRadius: 8,
            marginTop: 12,
            marginBottom: 8,
            boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)',
            cursor: uploading || !file ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {uploading ? 'Uploading...' : 'Upload'}
        </button>
        <UploadStatus message={status.message} type={status.type} visible={status.show} onClose={() => setStatus({ ...status, show: false })} />
      </div>
    </div>
  );
} 