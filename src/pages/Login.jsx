import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Login = () => {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(false);
    setErrMsg("");
    setLoading(true);
    const email = e.target[0].value;
    const password = e.target[1].value;
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      // Check if user profile exists in Firestore, create if missing
      const userDoc = doc(db, "users", cred.user.uid);
      const userSnap = await getDoc(userDoc);
      if (!userSnap.exists()) {
        await setDoc(userDoc, {
          uid: cred.user.uid,
          displayName: cred.user.displayName,
          email: cred.user.email,
          photoURL: cred.user.photoURL || "",
        });
      }
      setLoading(false);
      toast.success("Login successful! Redirecting...");
      setTimeout(() => navigate("/"), 1200);
    } catch (err) {
      setErr(true);
      const msg = (err.code === "auth/wrong-password" || err.code === "auth/user-not-found")
        ? "Invalid email or password"
        : (err.message || "Something went Wrong!");
      setErrMsg(msg);
      toast.error(msg);
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    e.code === "Enter" && handleSubmit(e);
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
      <ToastContainer position="top-center" autoClose={1100} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
      <div style={{
        background: 'white',
        borderRadius: 24,
        boxShadow: '0 8px 32px rgba(44, 62, 80, 0.15)',
        padding: '48px 48px',
        width: 420,
        maxWidth: '98vw',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <button onClick={() => navigate('/')} style={{ alignSelf: 'flex-start', marginBottom: 12, background: 'none', border: 'none', color: '#667eea', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>← Back</button>
        <span style={{
          fontWeight: 800,
          fontSize: 32,
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
        }}>Bundi/Kitab</span>
        <span style={{
          fontWeight: 600,
          fontSize: 20,
          color: '#444',
          marginBottom: 24,
        }}>Sign in to your account</span>
        <form onSubmit={handleSubmit} onKeyDown={handleKey} style={{ width: '100%' }}>
          <input type="email" placeholder="Email" required style={inputStyle} />
          <input type="password" placeholder="Password" required style={inputStyle} />
          <button
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
            {loading ? "Signing in..." : "Sign In"}
          </button>
          {err && (
            <span style={{ color: "#e53e3e", fontSize: "13px", fontWeight: 500, display: 'block', marginTop: 4 }}>
              {errMsg || "Something went Wrong!"}
            </span>
          )}
        </form>
        <p style={{ marginTop: 8, textAlign: 'right', width: '100%' }}>
          <a href="/reset-password" style={{ color: '#667eea', fontWeight: 500, textDecoration: 'underline', cursor: 'pointer' }}>
            Forgot password?
          </a>
        </p>
        <p style={{ marginTop: 18, color: '#888', fontSize: 15 }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none' }}>Register</Link>
        </p>
      </div>
    </div>
  );
};

const inputStyle = {
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
};

export default Login;
