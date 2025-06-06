// ResetPassword.jsx - React Native version
import React, { useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../utils/firebase";
import { LinearGradient } from 'expo-linear-gradient';

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    setMessage("");
    setError("");
    setLoading(true);
    
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
      Alert.alert("Success", "Password reset email sent! Check your inbox.");
    } catch (err) {
      const errorMessage = "Failed to send reset email. Please check your email address.";
      setError(errorMessage);
      Alert.alert("Error", errorMessage);
    }
    setLoading(false);
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{
          backgroundColor: 'white',
          borderRadius: 24,
          padding: 40,
          width: '100%',
          maxWidth: 370,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 32,
          elevation: 15,
          alignItems: 'center',
        }}>
          <Text style={{
            fontWeight: '800',
            fontSize: 32,
            color: '#667eea',
            marginBottom: 8,
          }}>
            BaatChit
          </Text>
          <Text style={{
            fontWeight: '600',
            fontSize: 20,
            color: '#444',
            marginBottom: 24,
          }}>
            Reset Password
          </Text>
          
          <TextInput
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            style={{
              width: '100%',
              padding: 12,
              borderWidth: 1,
              borderColor: '#e0e0e0',
              borderRadius: 8,
              fontSize: 15,
              fontWeight: '500',
              backgroundColor: '#f7f8fa',
              color: '#222',
              marginBottom: 16,
            }}
          />
          
          <TouchableOpacity
            onPress={handleReset}
            disabled={loading}
            style={{
              width: '100%',
              padding: 12,
              backgroundColor: loading ? '#b3b3b3' : '#667eea',
              borderRadius: 8,
              marginBottom: 16,
              shadowColor: '#2c3e50',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.10,
              shadowRadius: 8,
              elevation: 3,
            }}
          >
            <Text style={{
              color: 'white',
              fontWeight: '700',
              fontSize: 16,
              textAlign: 'center',
            }}>
              {loading ? "Sending..." : "Send Reset Email"}
            </Text>
          </TouchableOpacity>
          
          {message && (
            <Text style={{
              color: "#4CAF50",
              fontWeight: '600',
              marginTop: 8,
              textAlign: 'center',
            }}>
              {message}
            </Text>
          )}
          
          {error && (
            <Text style={{
              color: "#e53e3e",
              fontWeight: '600',
              marginTop: 8,
              textAlign: 'center',
            }}>
              {error}
            </Text>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}