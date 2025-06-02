import React, { useState } from 'react';
import Add from "../img/addAvatar.png";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, storage, db } from "../utils/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { doc, setDoc } from "firebase/firestore";
import { Link, useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const Register = () => {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");
  const [avatarPreview, setAvatarPreview] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr(false);
    setErrMsg("");
    setLoading(true);

    const displayName = e.target[0].value;
    const email = e.target[1].value;
    const password = e.target[2].value;
    const file = e.target[3].files[0];

    try {
      // 1. Create user in Firebase Auth
      const res = await createUserWithEmailAndPassword(auth, email, password);

      let photoURL = "";
      if (file) {
        // 2. Upload avatar if provided
        const date = new Date().getTime();
        const storageRef = ref(storage, `${displayName + date}`);
        await uploadBytesResumable(storageRef, file);
        photoURL = await getDownloadURL(storageRef);
      }

      // 3. Update Firebase Auth profile
      await updateProfile(res.user, {
        displayName,
        photoURL,
      });

      // 4. Write user profile to Firestore
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        displayName,
        email,
        photoURL,
        password,
        createdAt: new Date().toISOString(),
      });

      // 5. Create empty userChats doc
      await setDoc(doc(db, "userChats", res.user.uid), { initialized: true });

      setLoading(false);
      toast.success("Registration successful! Redirecting...");
      setTimeout(() => navigate("/"), 1500);
    } catch (err) {
      console.error("Registration error:", err);
      setErr(true);
      if (err.code === "auth/email-already-in-use") {
        setErrMsg("This email is already used");
      } else {
        setErrMsg(err.message || "Something went Wrong!");
      }
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setAvatarPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setAvatarPreview(null);
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
      <ToastContainer position="top-center" autoClose={1400} hideProgressBar={false} newestOnTop closeOnClick pauseOnFocusLoss draggable pauseOnHover />
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
        }}>Create your account</span>
        <form onSubmit={handleSubmit} style={{ width: '100%' }}>
          <input type="text" placeholder="Display name" required style={inputStyle} />
          <input type="email" placeholder="Email" required style={inputStyle} />
          <input type="password" placeholder="Password" required minLength={6} style={inputStyle} />
          <input style={{ display: "none" }} type="file" id="file" onChange={handleAvatarChange} />
          <label htmlFor="file" style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            cursor: 'pointer',
            margin: '18px 0 8px 0',
          }}>
            <span style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Avatar</span>
            <div style={{
              width: 120,
              height: 120,
              minWidth: 100,
              minHeight: 100,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)',
              marginBottom: 8,
              overflow: 'hidden',
              position: 'relative',
            }}>
              <img
                src={avatarPreview || 'https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=120'}
                alt="Avatar preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <img
                src={Add}
                alt="Add avatar"
                style={{
                  width: 38,
                  height: 38,
                  opacity: 0.8,
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  background: 'white',
                  borderRadius: '50%',
                  border: '2px solid #fff',
                  boxShadow: '0 1px 4px rgba(44,62,80,0.10)',
                  padding: 2,
                }}
              />
            </div>
            <span style={{ color: '#667eea', fontWeight: 500, fontSize: 15 }}>Change Avatar</span>
          </label>
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
            {loading ? "Signing up..." : "Sign Up"}
          </button>
          {err && (
            <span style={{ color: "#e53e3e", fontSize: "13px", fontWeight: 500, display: 'block', marginTop: 4 }}>
              {errMsg}
            </span>
          )}
        </form>
        <p style={{ marginTop: 18, color: '#888', fontSize: 15 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#667eea', fontWeight: 600, textDecoration: 'none' }}>Login</Link>
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

export default Register;