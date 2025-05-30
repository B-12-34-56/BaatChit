import React, { useEffect } from 'react';

const COLORS = {
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
};

export default function UploadStatus({ message, type, visible, onClose, autoHideDuration = 6000 }) {
  useEffect(() => {
    if (visible && (type === 'success' || type === 'info') && autoHideDuration) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [visible, type, onClose, autoHideDuration]);

  if (!visible) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: 30,
      left: '50%',
      transform: 'translateX(-50%)',
      background: COLORS[type] || COLORS.info,
      color: 'white',
      padding: '16px 24px',
      borderRadius: 4,
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      zIndex: 9999,
      minWidth: 300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{
        background: 'transparent',
        border: 'none',
        color: 'white',
        marginLeft: 16,
        fontSize: 18,
        cursor: 'pointer',
      }}>×</button>
    </div>
  );
} 