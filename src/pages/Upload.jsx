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
    <div style={{ maxWidth: 500, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <h2>Upload Image to S3</h2>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {file && <div style={{ margin: '12px 0' }}>{file.name} ({Math.round(file.size / 1024)} KB)</div>}
      <button onClick={handleUpload} disabled={uploading || !file} style={{ padding: '8px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: 4, cursor: uploading ? 'not-allowed' : 'pointer' }}>
        {uploading ? 'Uploading...' : 'Upload'}
      </button>
      <UploadStatus message={status.message} type={status.type} visible={status.show} onClose={() => setStatus({ ...status, show: false })} />
    </div>
  );
} 