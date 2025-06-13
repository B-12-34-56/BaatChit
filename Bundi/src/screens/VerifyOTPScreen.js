import React, { useState, useEffect } from 'react';
import { View, TextInput, Button, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { authService } from '../services/authService';

export default function VerifyOTPScreen() {
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);

  useEffect(() => {
    // Store session data in component state on mount
    console.log('[VerifyOTPScreen] Received params:', params);
    
    if (params.phoneNumber && params.verificationSid) {
      const newSession = {
        phoneNumber: params.phoneNumber,
        sid: params.verificationSid,
        timestamp: parseInt(params.timestamp) || Date.now()
      };
      
      console.log('[VerifyOTPScreen] Setting session:', newSession);
      setSession(newSession);
    } else {
      console.error('[VerifyOTPScreen] Missing required params:', {
        hasPhoneNumber: !!params.phoneNumber,
        hasVerificationSid: !!params.verificationSid,
        hasTimestamp: !!params.timestamp
      });
    }
  }, [params]);

  const handleVerifyOTP = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('[VerifyOTPScreen] Verifying OTP:', {
        code: otp,
        session
      });
      
      const userData = await authService.verifyOTP(otp, session);
      console.log('[VerifyOTPScreen] Verification successful:', userData);
      
      // Navigate to home screen on success
      router.replace('/home');
    } catch (error) {
      console.error('[VerifyOTPScreen] Error:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>Invalid verification session</Text>
        <Button
          title="Go Back"
          onPress={() => router.back()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.phoneNumber}>
        Enter code sent to {session.phoneNumber}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder="Enter 6-digit code"
        value={otp}
        onChangeText={setOtp}
        keyboardType="number-pad"
        maxLength={6}
        editable={!loading}
      />
      
      {error ? <Text style={styles.error}>{error}</Text> : null}
      
      <Button
        title={loading ? 'Verifying...' : 'Verify OTP'}
        onPress={handleVerifyOTP}
        disabled={loading || otp.length !== 6}
      />
      
      <Button
        title="Go Back"
        onPress={() => router.back()}
        disabled={loading}
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
  phoneNumber: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center'
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8
  },
  error: {
    color: 'red',
    marginBottom: 10,
    textAlign: 'center'
  }
}); 