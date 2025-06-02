// src/components/UploadToS3.jsx

import React, { useState } from 'react';
import { getPresignedUrl } from '../services/presignService';
import { messageService } from '../services/messageService';
import { useNavigate } from 'react-router-dom';

// Use the correct env variable for the frontend (CRA)
const PRESIGN_API_URL = process.env.REACT_APP_PRESIGN_API_URL;

// Keywords you want to block
const BLOCKED_KEYWORDS = ['name', 'signature', 'sign', 'signed'];

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

async function getFileHash(file) {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function UploadToS3() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ message: '', type: 'info', visible: false });
  const [uploading, setUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const navigate = useNavigate();

  // When user selects a file
  const handleFileChange = async (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setStatus({ message: '', type: 'info', visible: false });
    setDuplicateWarning('');
    if (!selectedFile) return;
  };

  // Main upload logic
  const handleUpload = async () => {
    if (!file) {
      setStatus({ message: 'Please select a file first', type: 'error', visible: true });
      return;
    }
    if (isBlockedFilename(file.name)) {
      setStatus({
        message: 'This filename is blocked (contains a forbidden keyword).',
        type: 'error',
        visible: true,
      });
      return;
    }
    if (duplicateWarning) {
      setStatus({ message: duplicateWarning, type: 'error', visible: true });
      return;
    }

    setUploading(true);
    setStatus({ message: 'Requesting presigned URL…', type: 'info', visible: true });

    try {
      // 1) Get presigned URL from backend (pass the correct API URL)
      const presignedUrl = await getPresignedUrl(file.name, file.type, PRESIGN_API_URL);
      if (!presignedUrl) throw new Error('Failed to get presigned URL');
      setStatus({ message: 'Uploading file to S3…', type: 'info', visible: true });

      // 2) Upload file to S3 using the presigned URL
      const response = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      if (!response.ok) {
        let text = '';
        try { text = await response.text(); } catch (_) {}
        throw new Error(`S3 upload failed (status ${response.status}): ${text}`);
      }
      setStatus({ message: 'Upload successful!', type: 'success', visible: true });
    } catch (err) {
      setStatus({ message: err.message || 'Upload failed', type: 'error', visible: true });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, Segoe UI, Arial, sans-serif',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: 24,
          boxShadow: '0 8px 32px rgba(44, 62, 80, 0.15)',
          padding: '40px 32px',
          width: 420,
          maxWidth: '95vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <button onClick={() => navigate('/')} style={{ alignSelf: 'flex-start', marginBottom: 12, background: 'none', border: 'none', color: '#667eea', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>← Back</button>
        <h2
          style={{
            fontWeight: 800,
            fontSize: 28,
            background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: 18,
          }}
        >
          Upload Image to S3
        </h2>

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

        {file && (
          <div style={{ margin: '12px 0', color: '#444', fontWeight: 500 }}>
            {file.name} ({Math.round(file.size / 1024)} KB)
          </div>
        )}

        {duplicateWarning && (
          <div style={{ color: 'red', fontWeight: 600, marginTop: 8 }}>
            {duplicateWarning}
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={uploading || !file || !!duplicateWarning}
          style={{
            width: '100%',
            padding: '12px 0',
            background:
              uploading || !file || !!duplicateWarning
                ? 'linear-gradient(90deg, #b3b3b3 0%, #b3b3b3 100%)'
                : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontWeight: 700,
            fontSize: 16,
            border: 'none',
            borderRadius: 8,
            marginTop: 12,
            marginBottom: 8,
            boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)',
            cursor: uploading || !file || !!duplicateWarning ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>

        {status.visible && (
          <div
            style={{
              marginTop: 12,
              padding: '8px 12px',
              borderRadius: 8,
              background:
                status.type === 'error'
                  ? '#ffd6d6'
                  : status.type === 'warning'
                  ? '#fff4cc'
                  : status.type === 'success'
                  ? '#d4ffd6'
                  : '#e0e0e0',
              color:
                status.type === 'error'
                  ? '#911111'
                  : status.type === 'warning'
                  ? '#665500'
                  : status.type === 'success'
                  ? '#115511'
                  : '#333333',
              fontSize: 14,
              textAlign: 'center',
              minWidth: 200,
            }}
          >
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
