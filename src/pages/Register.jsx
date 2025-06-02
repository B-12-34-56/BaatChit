import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { auth } from "../utils/firebase";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../utils/firebase";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Password strength checker
const checkPasswordStrength = (password) => {
  let strength = 0;
  const feedback = [];
  
  if (password.length >= 8) strength += 1;
  else feedback.push("At least 8 characters");
  
  if (/[a-z]/.test(password)) strength += 1;
  else feedback.push("Lowercase letter");
  
  if (/[A-Z]/.test(password)) strength += 1;
  else feedback.push("Uppercase letter");
  
  if (/[0-9]/.test(password)) strength += 1;
  else feedback.push("Number");
  
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  else feedback.push("Special character");
  
  return { strength, feedback };
};

const Register = () => {
  const [err, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ strength: 0, feedback: [] });
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (name === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    const { displayName, email, password, confirmPassword } = formData;

    // Validation
    if (!displayName || !email || !password) {
      toast.error("Please fill all fields");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      setLoading(false);
      return;
    }

    if (passwordStrength.strength < 3) {
      toast.error("Password is too weak");
      setLoading(false);
      return;
    }

    try {
      // Create user
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile
      await updateProfile(res.user, {
        displayName,
        photoURL: `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff&bold=true`
      });

      // Send email verification
      await sendEmailVerification(res.user);
      toast.success("Verification email sent! Please check your inbox.");

      // Create user document in Firestore
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        displayName,
        email,
        photoURL: `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff&bold=true`,
        friends: [],
        createdAt: new Date(),
        lastActive: new Date(),
        isOnline: true,
        bio: "",
        emailVerified: false
      });

      // Create empty user chats document
      await setDoc(doc(db, "userChats", res.user.uid), {});

      // Navigate to email verification page
      navigate("/verify-email");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        toast.error("Email already registered");
      } else if (err.code === "auth/invalid-email") {
        toast.error("Invalid email format");
      } else if (err.code === "auth/weak-password") {
        toast.error("Password is too weak");
      } else {
        toast.error("Registration failed. Please try again.");
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    const colors = ["#e53e3e", "#f56565", "#f6ad55", "#68d391", "#48bb78"];
    return colors[passwordStrength.strength] || colors[0];
  };

  const getStrengthText = () => {
    const texts = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
    return texts[passwordStrength.strength] || texts[0];
  };

  return (
    <div className="formContainer">
      <ToastContainer position="top-center" autoClose={3000} />
      <div className="formWrapper" style={{ maxWidth: 420, padding: 40 }}>
        <span className="logo" style={{ fontSize: 28, fontWeight: 700, color: '#667eea' }}>BaatChit</span>
        <span className="title" style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>Create your account</span>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <input
            required
            type="text"
            name="displayName"
            placeholder="Display Name"
            value={formData.displayName}
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

          {formData.password && (
            <div style={{ marginTop: -8, marginBottom: 8 }}>
              <div style={{
                height: 6,
                background: '#e2e8f0',
                borderRadius: 3,
                overflow: 'hidden',
                marginBottom: 8
              }}>
                <div style={{
                  height: '100%',
                  width: `${(passwordStrength.strength / 5) * 100}%`,
                  background: getStrengthColor(),
                  transition: 'width 0.3s, background 0.3s'
                }} />
              </div>
              <div style={{ fontSize: 13 }}>
                <span style={{ color: getStrengthColor(), fontWeight: 600 }}>
                  {getStrengthText()}
                </span>
                {passwordStrength.feedback.length > 0 && (
                  <span style={{ color: '#718096', marginLeft: 8 }}>
                    Need: {passwordStrength.feedback.join(', ')}
                  </span>
                )}
              </div>
            </div>
          )}
          
          <input
            required
            type="password"
            name="confirmPassword"
            placeholder="Confirm Password"
            value={formData.confirmPassword}
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
          
          <button
            type="submit"
            disabled={loading || passwordStrength.strength < 3}
            style={{
              padding: '14px',
              background: loading || passwordStrength.strength < 3 ? '#cbd5e0' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: loading || passwordStrength.strength < 3 ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              marginTop: 8
            }}
          >
            {loading ? 'Creating Account...' : 'Sign Up'}
          </button>
        </form>
        
        <p style={{ marginTop: 24, fontSize: 14, color: '#718096', textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: '#667eea', textDecoration: 'none', fontWeight: 600 }}>Login</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;