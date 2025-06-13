import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { auth } from '../src/utils/firebase';
import authService from '../src/services/authService';
import { useAuth } from '../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OTP_EXPIRY = 300000; // 5 minutes
const MAX_ATTEMPTS = 3;

export default function VerifyOTP() {
  const [otp, setOtp] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState(0);
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace('/home');
      return;
    }

    // Get phone number and session data
    const getSessionData = async () => {
      try {
        const session = await AsyncStorage.getItem('authSession');
        if (!session) {
          Alert.alert('Error', 'Session expired. Please try again.');
          router.replace('/phone-login');
          return;
        }

        const { phoneNumber: storedPhone, timestamp, verificationSid } = JSON.parse(session);
        
        // Use params if available, otherwise use stored data
        setPhoneNumber(params.phoneNumber || storedPhone || '');
        setSessionStartTime(timestamp);

        // Check if session is expired
        if (Date.now() - timestamp > OTP_EXPIRY) {
          Alert.alert('Error', 'Verification code expired. Please request a new one.');
          await AsyncStorage.removeItem('authSession');
          router.replace('/phone-login');
        }
      } catch (error) {
        console.error('Session error:', error);
        router.replace('/phone-login');
      }
    };
    getSessionData();
  }, [params.phoneNumber, user]);

  const validateOTP = (code) => {
    if (!code) {
      throw new Error('Please enter the verification code');
    }
    if (!code.match(/^\d{6}$/)) {
      throw new Error('Please enter a valid 6-digit code');
    }
    return code;
  };

  const checkAttempts = () => {
    if (attempts >= MAX_ATTEMPTS) {
      throw new Error('Too many attempts. Please request a new code.');
    }
  };

  const handleVerifyOTP = async () => {
    try {
      // Validate OTP
      const code = validateOTP(otp);
      
      // Check attempts
      checkAttempts();

      // Check session expiry
      if (Date.now() - sessionStartTime > OTP_EXPIRY) {
        throw new Error('Verification code expired. Please request a new one.');
      }

      setIsLoading(true);
      
      // Get session data
      const session = await AsyncStorage.getItem('authSession');
      if (!session) {
        throw new Error('Session expired. Please try again.');
      }
      
      const sessionData = JSON.parse(session);
      console.log('[VerifyOTP] Session data:', sessionData);
      
      const result = await authService.verifyOTP(code, {
        phoneNumber: sessionData.phoneNumber,
        verificationSid: sessionData.verificationSid,
        code: code
      });
      
      if (result.user) {
        setUser(result.user);
        // Clear all stored data
        await AsyncStorage.multiRemove([
          'phoneNumber',
          'authSession'
        ]);
        router.replace('/home');
      } else {
        throw new Error('Verification failed');
      }
    } catch (error) {
      console.error('[VerifyOTP] Error:', error);
      
      // Handle specific error types
      if (error.message?.includes('Service account needs the Service Account Token Creator role')) {
        Alert.alert(
          'System Error',
          'There is a configuration issue with the authentication system. Please contact support.',
          [{ text: 'OK', onPress: () => router.replace('/phone-login') }]
        );
        return;
      }
      
      if (attempts >= MAX_ATTEMPTS) {
        Alert.alert(
          'Too Many Attempts',
          'You have exceeded the maximum number of attempts. Please try again later.',
          [{ text: 'OK', onPress: () => router.replace('/phone-login') }]
        );
        return;
      }
      
      setAttempts(prev => prev + 1);
      Alert.alert('Error', error.message || 'Failed to verify OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>
          We've sent a verification code to {phoneNumber}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter 6-digit code"
          value={otp}
          onChangeText={setOtp}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
        />
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleVerifyOTP}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify Code</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.resendButton}
          onPress={() => router.replace('/phone-login')}
        >
          <Text style={styles.resendText}>Change Phone Number</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendButton: {
    marginTop: 20,
    padding: 10,
  },
  resendText: {
    color: '#007AFF',
    fontSize: 16,
    textAlign: 'center',
  },
}); 