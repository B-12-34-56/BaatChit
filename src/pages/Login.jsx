import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signInWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth, db } from "../utils/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useAuthState } from 'react-firebase-hooks/auth';

const Login = () => {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const navigate = useNavigate();
  const [user] = useAuthState(auth);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErr(false);

    const { email, password } = formData;

    try {
      // Set persistence based on Remember Me
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      // Sign in
      const res = await signInWithEmailAndPassword(auth, email, password);
      
      // Check if email is verified
      if (!res.user.emailVerified) {
        toast.warning("Please verify your email before logging in.");
        navigate("/verify-email");
        return;
      }

      // Update user online status
      await updateDoc(doc(db, "users", res.user.uid), {
        isOnline: true,
        lastActive: new Date()
      });

      toast.success("Welcome back!");
      navigate("/");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/user-not-found") {
        toast.error("No account found with this email");
      } else if (err.code === "auth/wrong-password") {
        toast.error("Incorrect password");
      } else if (err.code === "auth/invalid-email") {
        toast.error("Invalid email format");
      } else if (err.code === "auth/too-many-requests") {
        toast.error("Too many failed attempts. Please try again later.");
      } else {
        toast.error("Login failed. Please try again.");
      }
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    if (!resetEmail) {
      toast.error("Please enter your email");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      toast.success("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        toast.error("No account found with this email");
      } else if (error.code === "auth/invalid-email") {
        toast.error("Invalid email format");
      } else {
        toast.error("Failed to send reset email. Please try again.");
      }
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  if (user) {
    navigate('/');
    return null;
  }

  if (showForgotPassword) {
    return (
      <div className="formContainer">
        <ToastContainer position="top-center" autoClose={3000} />
        <div className="formWrapper" style={{ maxWidth: 420, padding: 40 }}>
          <span className="logo" style={{ fontSize: 28, fontWeight: 700, color: '#667eea' }}>BaatChit</span>
          <span className="title" style={{ fontSize: 20, color: '#2d3748', marginBottom: 8, fontWeight: 600 }}>Reset Password</span>
          <p style={{ fontSize: 14, color: '#718096', marginBottom: 24, textAlign: 'center' }}>
            Enter your email and we'll send you a link to reset your password.
          </p>
          
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <input
              type="email"
              placeholder="Enter your email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              style={{
                padding: '12px 16px',
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 16,
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            
            <button
              type="submit"
              style={{
                padding: '14px',
                background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Send Reset Email
            </button>
            
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              style={{
                padding: '14px',
                background: 'transparent',
                color: '#667eea',
                border: '2px solid #667eea',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              Back to Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="formContainer">
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="formWrapper" style={{ maxWidth: 420, padding: 40 }}>
        <span className="logo" style={{ fontSize: 28, fontWeight: 700, color: '#667eea' }}>BaatChit</span>
        <span className="title" style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>Welcome back</span>
        
        <button
          type="button"
          onClick={signInWithGoogle}
          style={{
            padding: '12px',
            background: 'linear-gradient(90deg, #4285F4 0%, #34A853 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            marginBottom: 16
          }}
        >
          Sign in with Google
        </button>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            required
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            disabled={loading}
            style={{
              padding: '12px 16px',
              border: '2px solid #e2e8f0',
              borderRadius: 8,
              fontSize: 16,
              transition: 'border-color 0.2s',
              outline: 'none'
            }}
            onFocus={(e) => e.target.style.borderColor = '#667eea'}
            onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
          />
          
          <div style={{ position: 'relative' }}>
            <input
              required
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 16px',
                paddingRight: 48,
                border: '2px solid #e2e8f0',
                borderRadius: 8,
                fontSize: 16,
                transition: 'border-color 0.2s',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = '#667eea'}
              onBlur={(e) => e.target.style.borderColor = '#e2e8f0'}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#718096',
                fontSize: 14
              }}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: -8
          }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              fontSize: 14,
              color: '#4a5568'
            }}>
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  cursor: 'pointer'
                }}
              />
              Remember me
            </label>
            
            <button
              type="button"
              onClick={() => setShowForgotPassword(true)}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontSize: 14,
                cursor: 'pointer',
                textDecoration: 'none',
                fontWeight: 600
              }}
            >
              Forgot password?
            </button>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px',
              background: loading ? '#cbd5e0' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: 8
            }}
          >
            {loading ? 'Logging in...' : 'Sign In'}
          </button>
        </form>
        
        <p style={{ marginTop: 24, fontSize: 14, color: '#718096', textAlign: 'center' }}>
          Don't have an account? <Link to="/register" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>Register</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;