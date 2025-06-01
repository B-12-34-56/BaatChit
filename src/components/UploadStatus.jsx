import React, { useEffect } from 'react';

const COLORS = {
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
};

const ICONS = {
  success: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#4CAF50"/><path d="M7 13.5l3 3 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  error: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#F44336"/><path d="M15 9l-6 6M9 9l6 6" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
  ),
  warning: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#FF9800"/><path d="M12 7v5m0 4h.01" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
  ),
  info: (
    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="#2196F3"/><path d="M12 8h.01M12 12v4" stroke="#fff" strokeWidth="2.2" strokeLinecap="round"/></svg>
  ),
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
      bottom: 40,
      left: '50%',
      transform: 'translateX(-50%)',
      background: COLORS[type] || COLORS.info,
      color: 'white',
      padding: '14px 32px 14px 18px',
      borderRadius: 32,
      boxShadow: '0 4px 24px rgba(44,62,80,0.18)',
      zIndex: 9999,
      minWidth: 320,
      maxWidth: '90vw',
      display: 'flex',
      alignItems: 'center',
      fontWeight: 600,
      fontSize: 16,
      letterSpacing: 0.1,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.3s',
    }}>
      <span style={{ marginRight: 16, display: 'flex', alignItems: 'center' }}>{ICONS[type] || ICONS.info}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button onClick={onClose} style={{
        background: 'transparent',
        border: 'none',
        color: 'white',
        marginLeft: 18,
        fontSize: 22,
        cursor: 'pointer',
        fontWeight: 700,
        lineHeight: 1,
      }}>×</button>
    </div>
  );
} 