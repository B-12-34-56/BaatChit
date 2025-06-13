import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { auth } from '../src/utils/firebase';
import authService from '../src/services/authService';
import { useAuth } from '../src/contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function PhoneLogin() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, setUser } = useAuth();

  useEffect(() => {
    if (user) {
      router.replace('/home');
    }
  }, [user]);

  const handleSendOTP = async () => {
    if (!phoneNumber) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    try {
      setLoading(true);
      console.log('[PhoneLogin] Starting OTP send process');
      const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      console.log('[PhoneLogin] Formatted phone:', formattedPhone);
      
      const result = await authService.sendOTP(formattedPhone);
      console.log('[PhoneLogin] OTP sent successfully:', result);
      
      // Store session data
      const sessionData = {
        phoneNumber: result.phoneNumber,
        verificationSid: result.sid,
        timestamp: Date.now()
      };
      
      console.log('[PhoneLogin] Storing session data:', sessionData);
      await AsyncStorage.setItem('authSession', JSON.stringify(sessionData));
      
      // Navigate to verify-otp screen with params
      console.log('[PhoneLogin] Navigating to verify-otp screen');
      router.push({
        pathname: '/verify-otp',
        params: {
          phoneNumber: result.phoneNumber,
          verificationSid: result.sid
        }
      });
    } catch (error) {
      console.error('[PhoneLogin] Error sending OTP:', error);
      
      // Handle specific error cases
      if (error.message?.includes('Max send attempts reached')) {
        Alert.alert(
          'Too Many Attempts',
          'You have reached the maximum number of attempts. Please wait a few minutes before trying again.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Clear any existing session data
                AsyncStorage.removeItem('authSession');
              }
            }
          ]
        );
      } else if (error.message?.includes('Phone number must be 10 digits')) {
        Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit US phone number');
      } else {
        Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter Phone Number</Text>
      <Text style={styles.subtitle}>We'll send you a verification code</Text>
      
      <TextInput
        style={styles.input}
        placeholder="Phone Number (e.g. +1234567890)"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        autoComplete="tel"
      />

      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleSendOTP}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Send OTP</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
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
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
}); 