import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { TwilioService } from '../src/utils/twilio';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../src/utils/firebase';
import { PhoneAuthProvider, signInWithCredential } from 'firebase/auth';

const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS = 3;

export default function PhoneLogin() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lastAttemptTime, setLastAttemptTime] = useState(0);
  const [user] = useAuthState(auth);
  const router = useRouter();

  useEffect(() => {
    // If user is already logged in, redirect to home
    if (user) {
      router.replace('/home');
      return;
    }

    // Check for existing session
    const checkSession = async () => {
      try {
        const session = await AsyncStorage.getItem('authSession');
        if (session) {
          const { timestamp, phoneNumber: storedPhone } = JSON.parse(session);
          // If session is less than 5 minutes old, redirect to OTP
          if (Date.now() - timestamp < 300000) {
            router.push({
              pathname: '/verify-otp',
              params: { phoneNumber: storedPhone }
            });
          } else {
            // Clear expired session
            await AsyncStorage.removeItem('authSession');
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      }
    };
    checkSession();
  }, [user]);

  const formatPhoneNumber = (number) => {
    // Remove all non-digit characters
    const cleaned = number.replace(/\D/g, '');
    
    // Add +1 if it's a US number without country code
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // If it already has country code, just add +
    if (cleaned.length > 10) {
      return `+${cleaned}`;
    }
    
    return number;
  };

  const validatePhoneNumber = (number) => {
    const formatted = formatPhoneNumber(number);
    if (!formatted.startsWith('+')) {
      throw new Error('Please enter a valid phone number with country code');
    }
    if (formatted.length < 10) {
      throw new Error('Please enter a valid phone number');
    }
    return formatted;
  };

  const checkRateLimit = () => {
    const now = Date.now();
    if (now - lastAttemptTime < RATE_LIMIT_WINDOW) {
      if (attempts >= MAX_ATTEMPTS) {
        const waitTime = Math.ceil((RATE_LIMIT_WINDOW - (now - lastAttemptTime)) / 1000);
        throw new Error(`Too many attempts. Please wait ${waitTime} seconds before trying again.`);
      }
    } else {
      // Reset attempts if window has passed
      setAttempts(0);
    }
  };

  const sendOTP = async (phoneNumber) => {
    try {
      console.log('Sending OTP to:', phoneNumber);
      const response = await TwilioService.sendOTP(phoneNumber);
      console.log('Twilio response:', response);
      
      if (!response || !response.sid) {
        throw new Error('Invalid response from Twilio service');
      }
      
      await AsyncStorage.setItem('verificationId', response.sid);
      return response.sid;
    } catch (error) {
      console.error('Error sending OTP:', error);
      throw new Error(error.message || 'Failed to send verification code. Please try again.');
    }
  };

  const handleSendOTP = async () => {
    try {
      if (!phoneNumber) {
        Alert.alert('Error', 'Please enter your phone number');
        return;
      }

      // Validate phone number
      const formattedNumber = validatePhoneNumber(phoneNumber);
      console.log('Formatted phone number:', formattedNumber);
      
      // Check rate limit
      checkRateLimit();

      setIsLoading(true);
      
      // Store the formatted number for verification
      await AsyncStorage.setItem('phoneNumber', formattedNumber);
      
      // Create session
      const session = {
        phoneNumber: formattedNumber,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem('authSession', JSON.stringify(session));
      
      // Send OTP
      const verificationId = await sendOTP(formattedNumber);
      console.log('Verification ID:', verificationId);
      
      // Update attempts
      setAttempts(prev => prev + 1);
      setLastAttemptTime(Date.now());
      
      // Navigate to OTP verification screen
      router.push({
        pathname: '/verify-otp',
        params: { phoneNumber: formattedNumber }
      });
    } catch (error) {
      console.error('Error in handleSendOTP:', error);
      Alert.alert('Error', error.message || 'Failed to send verification code');
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
        <Text style={styles.title}>Enter Your Phone Number</Text>
        <Text style={styles.subtitle}>
          We'll send you a verification code
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Enter phone number (e.g., 1234567890)"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          keyboardType="phone-pad"
          maxLength={15}
        />
        <TouchableOpacity 
          style={[styles.button, isLoading && styles.buttonDisabled]} 
          onPress={handleSendOTP}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send Code</Text>
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