import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../utils/firebase";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err) {
      setError("Failed to send reset email. Please check your email address.");
    }
    setLoading(false);
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
        width: 370,
        maxWidth: '90vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <span style={{
          fontWeight: 800,
          fontSize: 32,
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>BaatChit</span>
        <span style={{
          fontWeight: 600,
          fontSize: 20,
          color: '#444',
          marginBottom: 24,
        }}>Reset Password</span>
        <form onSubmit={handleReset} style={{ width: '100%' }}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={{
              width: '100%',
              padding: '12px 14px',
              margin: '8px 0',
              border: '1px solid #e0e0e0',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 500,
              outline: 'none',
              background: '#f7f8fa',
              color: '#222',
              transition: 'border 0.2s',
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px 0',
              background: loading ? 'linear-gradient(90deg, #b3b3b3 0%, #b3b3b3 100%)' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              borderRadius: 8,
              marginTop: 12,
              marginBottom: 8,
              boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
          {message && <div style={{ color: "#4CAF50", fontWeight: 600, marginTop: 8 }}>{message}</div>}
          {error && <div style={{ color: "#e53e3e", fontWeight: 600, marginTop: 8 }}>{error}</div>}
        </form>
      </div>
    </div>
  );
} 