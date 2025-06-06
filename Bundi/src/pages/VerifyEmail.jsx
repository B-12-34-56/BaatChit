import React, { useState, useEffect, useContext } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert, 
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions
} from 'react-native';
import { sendEmailVerification } from 'firebase/auth';
import { auth, db } from '../utils/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { AuthContext } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { useAuthState } from 'react-firebase-hooks/auth';
import Toast from 'react-native-toast-message';

const { width } = Dimensions.get('window');

const VerifyEmail = () => {
  const [currentUser] = useAuthState(auth);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(60);
  const navigation = useNavigation();

  useEffect(() => {
    if (!currentUser) {
      navigation.navigate('Login');
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
        Toast.show({
          type: 'success',
          text1: 'Email verified successfully!',
        });
        setTimeout(() => navigation.navigate('Home'), 2000);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(checkVerification);
  }, [currentUser, navigation]);

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
      Toast.show({
        type: 'success',
        text1: 'Verification email sent!',
      });
      setResendDisabled(true);
      setCountdown(60);
    } catch (error) {
      if (error.code === 'auth/too-many-requests') {
        Toast.show({
          type: 'error',
          text1: 'Too many requests. Please try again later.',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Failed to send email. Please try again.',
        });
      }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>✉️</Text>
          </View>
          
          <Text style={styles.title}>Verify Your Email</Text>
          
          <Text style={styles.subtitle}>
            We've sent a verification email to:
          </Text>
          
          <Text style={styles.email}>
            {currentUser?.email}
          </Text>
          
          <Text style={styles.description}>
            Please check your inbox and click the verification link to activate your account.
            This page will automatically redirect once verified.
          </Text>
          
          <TouchableOpacity
            onPress={handleResendEmail}
            disabled={resendDisabled}
            style={[
              styles.resendButton,
              resendDisabled && styles.resendButtonDisabled
            ]}
          >
            <Text style={[
              styles.resendButtonText,
              resendDisabled && styles.resendButtonTextDisabled
            ]}>
              {resendDisabled ? `Resend in ${countdown}s` : 'Resend Verification Email'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleLogout}
            style={styles.logoutButton}
          >
            <Text style={styles.logoutButtonText}>
              Back to Login
            </Text>
          </TouchableOpacity>
          
          <View style={styles.helpContainer}>
            <Text style={styles.helpTitle}>
              Didn't receive the email?
            </Text>
            <View style={styles.helpList}>
              <Text style={styles.helpItem}>• Check your spam folder</Text>
              <Text style={styles.helpItem}>• Make sure {currentUser?.email} is correct</Text>
              <Text style={styles.helpItem}>• Wait a few minutes and try resending</Text>
            </View>
          </View>
        </View>
      </ScrollView>
      <Toast />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  content: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 48,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 10,
    maxWidth: 480,
    width: width * 0.9,
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#667eea',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
    marginBottom: 8,
    textAlign: 'center',
    lineHeight: 24,
  },
  email: {
    fontSize: 18,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 32,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#718096',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  resendButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: '#667eea',
    borderRadius: 8,
    marginBottom: 16,
  },
  resendButtonDisabled: {
    backgroundColor: '#e2e8f0',
  },
  resendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  resendButtonTextDisabled: {
    color: '#a0aec0',
  },
  logoutButton: {
    width: '100%',
    paddingVertical: 14,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#e53e3e',
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#e53e3e',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpContainer: {
    marginTop: 32,
    padding: 16,
    backgroundColor: '#f7fafc',
    borderRadius: 8,
    width: '100%',
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#718096',
    marginBottom: 8,
    textAlign: 'center',
  },
  helpList: {
    alignItems: 'flex-start',
  },
  helpItem: {
    fontSize: 14,
    color: '#718096',
    lineHeight: 20,
    marginBottom: 4,
  },
});

export default VerifyEmail;