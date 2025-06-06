// Login.jsx - React Native version (FIXED)
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  Switch,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator
} from "react-native";
import { router } from 'expo-router';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged
} from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
// Import Firebase services directly
import { auth, db } from '../src/utils/firebase';

// Complete the web browser auth session
WebBrowser.maybeCompleteAuthSession();

const Login = () => {
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [formData, setFormData] = useState({
    email: "",
    password: ""
  });
  const [user, setUser] = useState(null);

  // Configure Google Sign-In
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com', // Replace with your actual client ID
    // Add this for iOS
    iosClientId: 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com', // Replace with your iOS client ID
    // Add this for Android
    androidClientId: 'YOUR_GOOGLE_ANDROID_CLIENT_ID.apps.googleusercontent.com', // Replace with your Android client ID
  });

  // Handle auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user && user.emailVerified) {
        router.replace('/home');
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Google Sign-In response
  useEffect(() => {
    if (response?.type === 'success') {
      const { id_token } = response.params;
      const credential = GoogleAuthProvider.credential(id_token);
      
      signInWithCredential(auth, credential)
        .then(async (result) => {
          // Update user online status
          await updateDoc(doc(db, "users", result.user.uid), {
            isOnline: true,
            lastActive: new Date()
          });
          
          Alert.alert("Success", "Welcome!");
          router.replace('/home');
        })
        .catch((error) => {
          Alert.alert("Error", "Google sign-in failed");
          console.error(error);
        });
    }
  }, [response]);

  // Check remember me on component mount
  useEffect(() => {
    const checkRememberMe = async () => {
      try {
        const remembered = await AsyncStorage.getItem('rememberMe');
        const savedEmail = await AsyncStorage.getItem('userEmail');
        
        if (remembered === 'true') {
          setRememberMe(true);
          if (savedEmail) {
            setFormData(prev => ({ ...prev, email: savedEmail }));
          }
        }
      } catch (error) {
        console.log('Error checking remember me:', error);
      }
    };
    
    checkRememberMe();
  }, []);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErr(false);

    const { email, password } = formData;

    try {
      if (rememberMe) {
        await AsyncStorage.setItem('rememberMe', 'true');
        await AsyncStorage.setItem('userEmail', email);
      } else {
        await AsyncStorage.removeItem('rememberMe');
        await AsyncStorage.removeItem('userEmail');
      }
      
      const res = await signInWithEmailAndPassword(auth, email, password);
      
      if (!res.user.emailVerified) {
        Alert.alert("Email Verification", "Please verify your email before logging in.");
        router.push('/verify-email');
        return;
      }

      await updateDoc(doc(db, "users", res.user.uid), {
        isOnline: true,
        lastActive: new Date()
      });

      Alert.alert("Success", "Welcome back!");
      router.replace('/home');
    } catch (err) {
      console.error(err);
      let errorMessage = "Login failed. Please try again.";
      
      if (err.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (err.code === "auth/wrong-password") {
        errorMessage = "Incorrect password";
      } else if (err.code === "auth/invalid-email") {
        errorMessage = "Invalid email format";
      } else if (err.code === "auth/too-many-requests") {
        errorMessage = "Too many failed attempts. Please try again later.";
      }
      
      Alert.alert("Error", errorMessage);
      setErr(true);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      Alert.alert("Error", "Please enter your email");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      Alert.alert("Success", "Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
      setResetEmail("");
    } catch (error) {
      let errorMessage = "Failed to send reset email. Please try again.";
      
      if (error.code === "auth/user-not-found") {
        errorMessage = "No account found with this email";
      } else if (error.code === "auth/invalid-email") {
        errorMessage = "Invalid email format";
      }
      
      Alert.alert("Error", errorMessage);
    }
  };

  // Redirect if user is already logged in
  if (user && user.emailVerified) {
    return null;
  }

  if (showForgotPassword) {
    return (
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ flex: 1 }}
      >
        <StatusBar barStyle="light-content" />
        <KeyboardAvoidingView 
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 40,
            width: '100%',
            maxWidth: 420,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <Text style={{ 
              fontSize: 28, 
              fontWeight: '700', 
              color: '#667eea', 
              textAlign: 'center',
              marginBottom: 8,
            }}>
              BaatChit
            </Text>
            <Text style={{ 
              fontSize: 20, 
              color: '#2d3748', 
              marginBottom: 8, 
              fontWeight: '600',
              textAlign: 'center',
            }}>
              Reset Password
            </Text>
            <Text style={{ 
              fontSize: 14, 
              color: '#718096', 
              marginBottom: 24, 
              textAlign: 'center' 
            }}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
            
            <TextInput
              placeholder="Enter your email"
              value={resetEmail}
              onChangeText={setResetEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                padding: 12,
                borderWidth: 2,
                borderColor: '#e2e8f0',
                borderRadius: 8,
                fontSize: 16,
                marginBottom: 16,
              }}
            />
            
            <TouchableOpacity
              onPress={handleForgotPassword}
              style={{
                padding: 14,
                backgroundColor: '#667eea',
                borderRadius: 8,
                marginBottom: 16,
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                Send Reset Email
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => setShowForgotPassword(false)}
              style={{
                padding: 14,
                borderWidth: 2,
                borderColor: '#667eea',
                borderRadius: 8,
              }}
            >
              <Text style={{
                color: '#667eea',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                Back to Login
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            backgroundColor: 'white',
            borderRadius: 20,
            padding: 40,
            width: '100%',
            maxWidth: 420,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.25,
            shadowRadius: 20,
            elevation: 10,
          }}>
            <Text style={{ 
              fontSize: 28, 
              fontWeight: '700', 
              color: '#667eea', 
              textAlign: 'center',
              marginBottom: 8,
            }}>
              BaatChit
            </Text>
            <Text style={{ 
              fontSize: 16, 
              color: '#666', 
              marginBottom: 24,
              textAlign: 'center',
            }}>
              Welcome back
            </Text>
            
            <TouchableOpacity
              disabled={!request}
              onPress={() => promptAsync()}
              style={{
                padding: 12,
                backgroundColor: '#4285F4',
                borderRadius: 8,
                marginBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: request ? 1 : 0.6,
              }}
            >
              <Ionicons name="logo-google" size={20} color="white" style={{ marginRight: 8 }} />
              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
              }}>
                Sign in with Google
              </Text>
            </TouchableOpacity>
            
            <TextInput
              placeholder="Email"
              value={formData.email}
              onChangeText={(value) => handleChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!loading}
              style={{
                padding: 12,
                borderWidth: 2,
                borderColor: '#e2e8f0',
                borderRadius: 8,
                fontSize: 16,
                marginBottom: 16,
              }}
            />
            
            <View style={{ position: 'relative', marginBottom: 16 }}>
              <TextInput
                placeholder="Password"
                value={formData.password}
                onChangeText={(value) => handleChange('password', value)}
                secureTextEntry={!showPassword}
                editable={!loading}
                style={{
                  padding: 12,
                  paddingRight: 48,
                  borderWidth: 2,
                  borderColor: '#e2e8f0',
                  borderRadius: 8,
                  fontSize: 16,
                }}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: 16,
                  top: 12,
                  padding: 4,
                }}
              >
                <Ionicons 
                  name={showPassword ? 'eye-off' : 'eye'} 
                  size={20} 
                  color="#718096" 
                />
              </TouchableOpacity>
            </View>
            
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Switch
                  value={rememberMe}
                  onValueChange={setRememberMe}
                  trackColor={{ false: '#e2e8f0', true: '#667eea' }}
                />
                <Text style={{
                  marginLeft: 8,
                  fontSize: 14,
                  color: '#4a5568',
                }}>
                  Remember me
                </Text>
              </View>
              
              <TouchableOpacity
                onPress={() => setShowForgotPassword(true)}
              >
                <Text style={{
                  color: '#667eea',
                  fontSize: 14,
                  fontWeight: '600',
                }}>
                  Forgot password?
                </Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={loading}
              style={{
                padding: 14,
                backgroundColor: loading ? '#cbd5e0' : '#667eea',
                borderRadius: 8,
                marginBottom: 24,
              }}
            >
              <Text style={{
                color: 'white',
                fontSize: 16,
                fontWeight: '600',
                textAlign: 'center',
              }}>
                {loading ? 'Logging in...' : 'Sign In'}
              </Text>
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
              <Text style={{ fontSize: 14, color: '#718096' }}>
                Don't have an account? 
              </Text>
              <TouchableOpacity onPress={() => router.push('/register')}>
                <Text style={{ 
                  color: '#667eea', 
                  fontWeight: '600',
                  marginLeft: 4,
                }}>
                  Register
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default Login;