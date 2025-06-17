import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  StyleSheet
} from "react-native";
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from "firebase/auth";
import { auth } from "../src/utils/firebase";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../src/utils/firebase";
import { router } from "expo-router";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

// Password strength checker
const checkPasswordStrength = (password) => {
  let strength = 0;
  const feedback = [];
  
  if (password.length >= 8) strength += 1;
  else feedback.push("At least 8 characters");
  
  if (/[a-z]/.test(password)) strength += 1;
  else feedback.push("Lowercase letter");
  
  if (/[A-Z]/.test(password)) strength += 1;
  else feedback.push("Uppercase letter");
  
  if (/[0-9]/.test(password)) strength += 1;
  else feedback.push("Number");
  
  if (/[^A-Za-z0-9]/.test(password)) strength += 1;
  else feedback.push("Special character");
  
  return { strength, feedback };
};

const Register = () => {
  const [err, setError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState({ strength: 0, feedback: [] });
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    password: "",
    confirmPassword: ""
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === "password") {
      setPasswordStrength(checkPasswordStrength(value));
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(false);

    const { displayName, email, password, confirmPassword } = formData;

    // Validation
    if (!displayName || !email || !password) {
      Toast.show({
        type: 'error',
        text1: 'Please fill all fields',
      });
      setLoading(false);
      return;
    }

    if (password.length < 8 || password.length > 20) {
      Toast.show({
        type: 'error',
        text1: 'Password must be 8-20 characters',
      });
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Passwords do not match',
      });
      setLoading(false);
      return;
    }

    if (passwordStrength.strength < 3) {
      Toast.show({
        type: 'error',
        text1: 'Password is too weak',
      });
      setLoading(false);
      return;
    }

    try {
      // Create user
      const res = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update profile
      await updateProfile(res.user, {
        displayName,
        photoURL: `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff&bold=true`
      });

      // Create user document in Firestore
      await setDoc(doc(db, "users", res.user.uid), {
        uid: res.user.uid,
        displayName,
        email,
        photoURL: `https://ui-avatars.com/api/?name=${displayName}&background=667eea&color=fff&bold=true`,
        friends: [],
        createdAt: new Date(),
        lastActive: new Date(),
        isOnline: true,
        bio: ""
      });

      // Create empty user chats document
      await setDoc(doc(db, "userChats", res.user.uid), {});

      // Navigate to home instead of verify-email
      router.push("/home");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        Toast.show({
          type: 'error',
          text1: 'Email already registered',
        });
      } else if (err.code === "auth/invalid-email") {
        Toast.show({
          type: 'error',
          text1: 'Invalid email format',
        });
      } else if (err.code === "auth/weak-password") {
        Toast.show({
          type: 'error',
          text1: 'Password is too weak',
        });
      } else {
        Toast.show({
          type: 'error',
          text1: 'Registration failed. Please try again.',
        });
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const getStrengthColor = () => {
    const colors = ["#e53e3e", "#f56565", "#f6ad55", "#68d391", "#48bb78"];
    return colors[passwordStrength.strength] || colors[0];
  };

  const getStrengthText = () => {
    const texts = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
    return texts[passwordStrength.strength] || texts[0];
  };

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView 
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formWrapper}>
            <Text style={styles.logo}>BaatChit</Text>
            <Text style={styles.title}>Create your account</Text>
            
            <View style={styles.form}>
              <TextInput
                placeholder="Display Name"
                value={formData.displayName}
                onChangeText={(value) => handleChange('displayName', value)}
                editable={!loading}
                style={styles.input}
                placeholderTextColor="#999"
              />
              
              <TextInput
                placeholder="Email"
                value={formData.email}
                onChangeText={(value) => handleChange('email', value)}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                style={styles.input}
                placeholderTextColor="#999"
              />
              
              <View style={styles.passwordContainer}>
                <TextInput
                  placeholder="Password"
                  value={formData.password}
                  onChangeText={(value) => handleChange('password', value)}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  style={[styles.input, { paddingRight: 48 }]}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.showPasswordButton}
                >
                  <Ionicons 
                    name={showPassword ? 'eye-off' : 'eye'} 
                    size={20} 
                    color="#718096" 
                  />
                </TouchableOpacity>
              </View>

              {formData.password ? (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.strengthBarContainer}>
                    <View 
                      style={[
                        styles.strengthBar,
                        {
                          width: `${(passwordStrength.strength / 5) * 100}%`,
                          backgroundColor: getStrengthColor()
                        }
                      ]} 
                    />
                  </View>
                  <View style={styles.strengthTextContainer}>
                    <Text style={[styles.strengthText, { color: getStrengthColor() }]}>
                      {getStrengthText()}
                    </Text>
                    {passwordStrength.feedback.length > 0 && (
                      <Text style={styles.feedbackText}>
                        Need: {passwordStrength.feedback.join(', ')}
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
              
              <TextInput
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChangeText={(value) => handleChange('confirmPassword', value)}
                secureTextEntry={true}
                editable={!loading}
                style={styles.input}
                placeholderTextColor="#999"
              />
              
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={loading || passwordStrength.strength < 3}
                style={[
                  styles.submitButton,
                  (loading || passwordStrength.strength < 3) && styles.submitButtonDisabled
                ]}
              >
                <Text style={styles.submitButtonText}>
                  {loading ? 'Creating Account...' : 'Sign Up'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.loginLinkContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.push('/login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      <Toast />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  formWrapper: {
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
  },
  logo: {
    fontSize: 28,
    fontWeight: '700',
    color: '#667eea',
    textAlign: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  input: {
    padding: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    fontSize: 16,
  },
  passwordContainer: {
    position: 'relative',
  },
  showPasswordButton: {
    position: 'absolute',
    right: 16,
    top: 12,
    padding: 4,
  },
  passwordStrengthContainer: {
    marginTop: -8,
    marginBottom: 8,
  },
  strengthBarContainer: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 8,
  },
  strengthBar: {
    height: '100%',
  },
  strengthTextContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  strengthText: {
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackText: {
    fontSize: 13,
    color: '#718096',
    marginLeft: 8,
    flex: 1,
  },
  submitButton: {
    padding: 14,
    backgroundColor: '#667eea',
    borderRadius: 8,
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#cbd5e0',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  loginLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#718096',
  },
  loginLink: {
    color: '#667eea',
    fontWeight: '600',
  },
});

export default Register;