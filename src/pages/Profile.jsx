import React, { useContext, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import { db, storage } from "../utils/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigate } from "react-router-dom";

const Profile = () => {
  const { currentUser } = useContext(AuthContext);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
      setPhotoURL(currentUser.photoURL || "");
    }
  }, [currentUser]);

  const handleAvatarChange = (e) => {
    if (e.target.files[0]) {
      setAvatarFile(e.target.files[0]);
      setPhotoURL(URL.createObjectURL(e.target.files[0]));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setStatus("");
    try {
      let newPhotoURL = photoURL;
      if (avatarFile) {
        const storageRef = ref(storage, `${currentUser.uid}_avatar_${Date.now()}`);
        await uploadBytesResumable(storageRef, avatarFile);
        newPhotoURL = await getDownloadURL(storageRef);
      }
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName,
        photoURL: newPhotoURL,
      });
      // Update Firestore user doc
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName,
        photoURL: newPhotoURL,
      });
      setStatus("Profile updated!");
    } catch (err) {
      setStatus("Error: " + err.message);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, Segoe UI, Arial, sans-serif', padding: '32px 0' }}>
      <div style={{ background: 'white', borderRadius: 24, boxShadow: '0 8px 32px rgba(44, 62, 80, 0.15)', padding: '48px 48px', width: 520, maxWidth: '98vw', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <button onClick={() => navigate('/')} style={{ alignSelf: 'flex-start', marginBottom: 12, background: 'none', border: 'none', color: '#667eea', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>← Back</button>
        <span style={{ fontWeight: 800, fontSize: 28, background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>Profile</span>
        <form onSubmit={handleSave} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>Avatar</span>
            <img src={photoURL} alt="Avatar" style={{ width: 120, height: 120, minWidth: 100, minHeight: 100, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 2px 8px rgba(44,62,80,0.10)', marginBottom: 8 }} />
            <input type="file" accept="image/*" style={{ display: 'none' }} id="avatar-upload" onChange={handleAvatarChange} />
            <label htmlFor="avatar-upload" style={{ color: '#667eea', fontWeight: 500, fontSize: 15, cursor: 'pointer' }}>Change Avatar</label>
          </div>
          <input type="text" value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display Name" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 15, fontWeight: 500, outline: 'none', background: '#f7f8fa', color: '#222', transition: 'border 0.2s', boxSizing: 'border-box' }} />
          <input type="email" value={email} disabled style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 15, fontWeight: 500, outline: 'none', background: '#f7f8fa', color: '#888', transition: 'border 0.2s', boxSizing: 'border-box' }} />
          <button type="submit" style={{ width: '100%', padding: '12px 0', background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)', color: 'white', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 8, marginTop: 12, marginBottom: 8, boxShadow: '0 2px 8px rgba(44, 62, 80, 0.10)', cursor: 'pointer', transition: 'background 0.2s' }}>Save Changes</button>
          {status && <span style={{ color: status.startsWith('Error') ? '#e53e3e' : '#4CAF50', fontSize: 13 }}>{status}</span>}
        </form>
      </div>
    </div>
  );
};

export default Profile; 