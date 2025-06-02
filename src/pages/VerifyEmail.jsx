import React, { useState, useEffect, useContext } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const VerifyEmail = () => {
  const { currentUser } = useContext(AuthContext);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentUser) {
      navigate('/login');
      return;
    }

    // Check if already verified
    const checkVerification = setInterval(async () => {
      await currentUser.reload();
      if (currentUser.emailVerified) {
        // Update Firestore
        await updateDoc(doc(db, 'users', currentUser.uid), {
          emailVerified: true
        });
        toast.success('Email verified successfully!');
        setTimeout(() => navigate('/'), 2000);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(checkVerification);
  }, [currentUser, navigate]);

  useEffect(() => {
    // Countdown timer
    if (countdown > 0 && resendDisabled) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
  }, [countdown, resendDisabled]);

  const handleResendEmail = async () => {
    try {
      await sendEmailVerification(currentUser);
      toast.success('Verification email sent!');
      setResendDisabled(true);
      setCountdown(60);
    } catch (error) {
      if (error.code === 'auth/too-many-requests') {
        toast.error('Too many requests. Please try again later.');
      } else {
        toast.error('Failed to send email. Please try again.');
      }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
    }}>
      <ToastContainer position="top-center" autoClose={3000} />
      
      <div style={{
        background: 'white',
        borderRadius: 16,
        padding: 48,
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
        maxWidth: 480,
        width: '90%',
        textAlign: 'center'
      }}>
        <div style={{
          width: 80,
          height: 80,
          background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
          fontSize: 36
        }}>
          ✉️
        </div>
        
        <h2 style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#2d3748',
          marginBottom: 16
        }}>
          Verify Your Email
        </h2>
        
        <p style={{
          fontSize: 16,
          color: '#718096',
          marginBottom: 8,
          lineHeight: 1.6
        }}>
          We've sent a verification email to:
        </p>
        
        <p style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#667eea',
          marginBottom: 32
        }}>
          {currentUser?.email}
        </p>
        
        <p style={{
          fontSize: 15,
          color: '#718096',
          marginBottom: 32,
          lineHeight: 1.6
        }}>
          Please check your inbox and click the verification link to activate your account.
          This page will automatically redirect once verified.
        </p>
        
        <button
          onClick={handleResendEmail}
          disabled={resendDisabled}
          style={{
            width: '100%',
            padding: '14px',
            background: resendDisabled ? '#e2e8f0' : 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
            color: resendDisabled ? '#a0aec0' : 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: resendDisabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            marginBottom: 16
          }}
        >
          {resendDisabled ? `Resend in ${countdown}s` : 'Resend Verification Email'}
        </button>
        
        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            padding: '14px',
            background: 'transparent',
            color: '#e53e3e',
            border: '2px solid #e53e3e',
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.target.style.background = '#e53e3e';
            e.target.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.target.style.background = 'transparent';
            e.target.style.color = '#e53e3e';
          }}
        >
          Back to Login
        </button>
        
        <div style={{
          marginTop: 32,
          padding: 16,
          background: '#f7fafc',
          borderRadius: 8,
          fontSize: 14,
          color: '#718096'
        }}>
          <p style={{ marginBottom: 8 }}>
            <strong>Didn't receive the email?</strong>
          </p>
          <ul style={{
            textAlign: 'left',
            marginLeft: 20,
            lineHeight: 1.8
          }}>
            <li>Check your spam folder</li>
            <li>Make sure {currentUser?.email} is correct</li>
            <li>Wait a few minutes and try resending</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;