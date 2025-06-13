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
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../src/services/authService';

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

  useEffect(() => {
    // Get phone number and session data
    const getSessionData = async () => {
      try {
        const session = await AsyncStorage.getItem('authSession');
        if (!session) {
          Alert.alert('Error', 'Session expired. Please try again.');
          router.replace('/phone-login');
          return;
        }

        const { phoneNumber: storedPhone, timestamp } = JSON.parse(session);
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
  }, [params.phoneNumber]);

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
      
      // Add debug logging before the verifyOTP call
      console.log('authService =', authService);
      const result = await authService.verifyOTP(phoneNumber, code);
      
      if (!result.user) {
        throw new Error('Failed to create user account');
      }

      // Clear all stored data
      await AsyncStorage.multiRemove([
        'phoneNumber',
        'authSession'
      ]);
      
      // Navigate to home
      router.replace('/home');
    } catch (error) {
      setAttempts(prev => prev + 1);
      Alert.alert('Error', error.message || 'Failed to verify code');
      
      if (attempts >= MAX_ATTEMPTS - 1) {
        // Clear session and redirect to phone login
        await AsyncStorage.multiRemove(['authSession']);
        router.replace('/phone-login');
      }
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
          Enter the code sent to {phoneNumber}
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
    justifyContent: 'center',
    padding: 20,
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
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 