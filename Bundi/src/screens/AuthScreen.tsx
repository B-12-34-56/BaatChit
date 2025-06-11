import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
} from 'react-native';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { PhoneAuthProvider, signInWithCredential, signInWithCustomToken } from 'firebase/auth';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TwilioService } from '../utils/twilio';

const AuthScreen = () => {
  const [user, loading] = useAuthState(auth);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [showVerification, setShowVerification] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationId, setVerificationId] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  // Check for existing verification attempt on mount
  useEffect(() => {
    const checkVerificationState = async () => {
      try {
        const storedAttempt = await AsyncStorage.getItem('verificationAttempt');
        if (storedAttempt) {
          const { phoneNumber: storedPhone, timestamp } = JSON.parse(storedAttempt);
          // Check if the verification attempt is less than 10 minutes old
          if (Date.now() - timestamp < 10 * 60 * 1000) {
            setPhoneNumber(storedPhone);
            setShowVerification(true);
          } else {
            // Clear expired verification attempt
            await AsyncStorage.removeItem('verificationAttempt');
          }
        }
      } catch (error) {
        console.error('Error checking verification state:', error);
      }
    };

    checkVerificationState();
  }, []);

  // Format phone number as user types
  const handlePhoneNumberChange = (text: string) => {
    // Remove any non-digit characters except +
    const cleaned = text.replace(/[^\d+]/g, '');
    
    // Ensure the number starts with +
    if (!cleaned.startsWith('+')) {
      setPhoneNumber(`+${cleaned}`);
    } else {
      setPhoneNumber(cleaned);
    }
    
    setError(null);
  };

  const validatePhoneNumber = (number: string): boolean => {
    // Basic E.164 format validation
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    return phoneRegex.test(number);
  };

  const handleSendCode = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      setIsLoading(true);
      await TwilioService.sendOTP(phoneNumber);
      setVerificationSent(true);
      Alert.alert('Success', 'Verification code sent successfully');
    } catch (error: any) {
      console.error('Error sending code:', error);
      Alert.alert('Error', error.message || 'Failed to send verification code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) {
      Alert.alert('Error', 'Please enter the verification code');
      return;
    }

    try {
      setIsLoading(true);
      const result = await TwilioService.verifyOTP(phoneNumber, verificationCode);
      
      if (result.valid) {
        // Store the verified phone number
        await AsyncStorage.setItem('verifiedPhoneNumber', result.phoneNumber);
        setVerificationSent(false);
        setVerificationCode('');
        Alert.alert('Success', 'Phone number verified successfully');
      } else {
        Alert.alert('Error', 'Invalid verification code');
      }
    } catch (error: any) {
      console.error('Error verifying code:', error);
      Alert.alert('Error', error.message || 'Failed to verify code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = async () => {
    setShowVerification(false);
    setVerificationCode('');
    setError(null);
    // Clear verification attempt when user goes back
    await AsyncStorage.removeItem('verificationAttempt');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Phone Authentication</Text>
        
        {!showVerification ? (
          // Phone Number Input
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Enter your phone number</Text>
            <Text style={styles.hint}>Enter your phone number with country code (e.g., +1234567890)</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="+1234567890"
              value={phoneNumber}
              onChangeText={handlePhoneNumberChange}
              keyboardType="phone-pad"
              autoComplete="tel"
              maxLength={15}
            />
            <TouchableOpacity
              style={[styles.button, (!phoneNumber || isLoading) && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={isLoading || !phoneNumber}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Send Code</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          // Verification Code Input
          <View style={styles.inputContainer}>
            <TouchableOpacity 
              style={styles.backButton} 
              onPress={handleBack}
            >
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <Text style={styles.label}>Enter verification code</Text>
            <Text style={styles.hint}>Enter the 6-digit code sent to your phone</Text>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              placeholder="123456"
              value={verificationCode}
              onChangeText={(text) => {
                setVerificationCode(text);
                setError(null);
              }}
              keyboardType="number-pad"
              maxLength={6}
            />
            <TouchableOpacity
              style={[styles.button, (!verificationCode || isLoading) && styles.buttonDisabled]}
              onPress={handleVerifyCode}
              disabled={isLoading || !verificationCode}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verify Code</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}
      </View>
    </KeyboardAvoidingView>
  );
};

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
    textAlign: 'center',
    marginBottom: 30,
    color: '#333',
  },
  inputContainer: {
    width: '100%',
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#666',
  },
  hint: {
    fontSize: 14,
    marginBottom: 8,
    color: '#999',
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
  },
  inputError: {
    borderColor: 'red',
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
    fontWeight: '600',
  },
  errorText: {
    color: 'red',
    textAlign: 'center',
    marginTop: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: 5,
  },
});

export default AuthScreen; 