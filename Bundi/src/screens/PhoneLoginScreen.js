import React, { useState } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { authService } from '../services/authService';

export default function PhoneLoginScreen() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('[PhoneLoginScreen] Sending OTP to:', phoneNumber);
      const result = await authService.sendOTP(phoneNumber);
      console.log('[PhoneLoginScreen] OTP sent successfully:', result);
      
      // Navigate to verify OTP screen with session data
      const params = {
        phoneNumber: result.phoneNumber,
        verificationSid: result.sid,
        timestamp: Date.now()
      };
      
      console.log('[PhoneLoginScreen] Navigating with params:', params);
      router.push({
        pathname: '/verify-otp',
        params
      });
    } catch (error) {
      console.error('[PhoneLoginScreen] Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Enter phone number"
        value={phoneNumber}
        onChangeText={setPhoneNumber}
        keyboardType="phone-pad"
        editable={!loading}
      />
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      <Button
        title={loading ? 'Sending...' : 'Send OTP'}
        onPress={handleSendOTP}
        disabled={loading || !phoneNumber}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20
  },
  error: {
    color: 'red',
    marginBottom: 10
  }
}); 