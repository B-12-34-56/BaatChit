// Profile.jsx - React Native version
import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Image, 
  Alert,
  ScrollView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { db, storage } from "../src/utils/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useRouter } from "expo-router";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../src/utils/firebase.js';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authService } from '../src/services/authService';

const MAX_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 100;
const MAX_BIO_LENGTH = 200;

const Profile = () => {
  const [currentUser] = useAuthState(auth);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    bio: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (currentUser) {
      setDisplayName(currentUser.displayName || "");
      setEmail(currentUser.email || "");
      setPhotoURL(currentUser.photoURL || "");
    }
    loadProfile();
  }, [currentUser]);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validateName = (name) => {
    return name.trim().length >= 2 && name.trim().length <= MAX_NAME_LENGTH;
  };

  const validateBio = (bio) => {
    return bio.length <= MAX_BIO_LENGTH;
  };

  const validateProfile = () => {
    const newErrors = {};
    
    if (!validateName(profile.name)) {
      newErrors.name = 'Name must be between 2 and 50 characters';
    }
    
    if (profile.email && !validateEmail(profile.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (profile.bio && !validateBio(profile.bio)) {
      newErrors.bio = `Bio must be less than ${MAX_BIO_LENGTH} characters`;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      const userProfile = await authService.getUserProfile();
      
      setProfile({
        name: userProfile?.name || '',
        email: userProfile?.email || '',
        phoneNumber: phoneNumber || '',
        bio: userProfile?.bio || '',
      });
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (permissionResult.granted === false) {
        Alert.alert("Permission Required", "Permission to access camera roll is required!");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        maxWidth: 1000,
        maxHeight: 1000,
      });

      if (!result.canceled && result.assets[0]) {
        const fileSize = result.assets[0].fileSize;
        if (fileSize > 5 * 1024 * 1024) { // 5MB limit
          Alert.alert("Error", "Image size must be less than 5MB");
          return;
        }
        setAvatarFile(result.assets[0]);
        setPhotoURL(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image. Please try again.");
    }
  };

  const uploadImage = async (uri) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      const storageRef = ref(storage, `avatars/${currentUser.uid}_${Date.now()}`);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            reject(error);
          },
          async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          }
        );
      });
    } catch (error) {
      throw new Error('Failed to upload image');
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    
    if (!validateProfile()) {
      Alert.alert("Validation Error", "Please fix the errors before saving.");
      return;
    }

    try {
      setIsSaving(true);
      let newPhotoURL = photoURL;
      
      if (avatarFile) {
        newPhotoURL = await uploadImage(avatarFile.uri);
      }
      
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName: profile.name,
        photoURL: newPhotoURL,
      });
      
      // Update Firestore user document
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName: profile.name,
        photoURL: newPhotoURL,
        email: profile.email,
        bio: profile.bio,
        updatedAt: new Date(),
      });
      
      // Update local profile
      await authService.updateUserProfile({
        name: profile.name,
        email: profile.email,
        bio: profile.bio,
      });
      
      Alert.alert("Success", "Profile updated successfully!");
      setStatus("Profile updated!");
      setErrors({});
    } catch (err) {
      const errorMessage = err.message || "Failed to update profile";
      setStatus(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  const handleSignOut = async () => {
    try {
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: async () => {
              setLoading(true);
              await authService.signOut();
              await AsyncStorage.multiRemove(['authSession', 'phoneNumber', 'verificationId']);
              router.replace('/(auth)/phone-login');
            }
          }
        ]
      );
    } catch (error) {
      console.error('Error signing out:', error);
      Alert.alert('Error', 'Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#667eea', '#764ba2']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <StatusBar style="light" />
      <KeyboardAvoidingView 
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView 
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.header}>
              <Text style={styles.title}>Profile</Text>
              <TouchableOpacity 
                style={styles.dismissButton}
                onPress={Keyboard.dismiss}
              >
                <Ionicons name="chevron-down" size={24} color="#007AFF" />
              </TouchableOpacity>
            </View>

            <View style={styles.avatarContainer}>
              <TouchableOpacity onPress={handleAvatarChange}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarPlaceholder]}>
                    <Ionicons name="person" size={40} color="#666" />
                  </View>
                )}
                <View style={styles.avatarEditButton}>
                  <Ionicons name="camera" size={20} color="#fff" />
                </View>
              </TouchableOpacity>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <View style={styles.uploadProgress}>
                  <Text style={styles.uploadProgressText}>
                    Uploading: {Math.round(uploadProgress)}%
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  value={profile.name}
                  onChangeText={(text) => {
                    setProfile({ ...profile, name: text });
                    if (errors.name) setErrors({ ...errors, name: null });
                  }}
                  placeholder="Enter your name"
                  returnKeyType="next"
                  maxLength={MAX_NAME_LENGTH}
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  value={profile.email}
                  onChangeText={(text) => {
                    setProfile({ ...profile, email: text });
                    if (errors.email) setErrors({ ...errors, email: null });
                  }}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  maxLength={MAX_EMAIL_LENGTH}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Bio</Text>
                <TextInput
                  style={[styles.input, styles.bioInput, errors.bio && styles.inputError]}
                  value={profile.bio}
                  onChangeText={(text) => {
                    setProfile({ ...profile, bio: text });
                    if (errors.bio) setErrors({ ...errors, bio: null });
                  }}
                  placeholder="Tell us about yourself"
                  multiline
                  maxLength={MAX_BIO_LENGTH}
                />
                <Text style={styles.charCount}>
                  {profile.bio.length}/{MAX_BIO_LENGTH}
                </Text>
                {errors.bio && <Text style={styles.errorText}>{errors.bio}</Text>}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={[styles.input, styles.disabledInput]}
                  value={profile.phoneNumber}
                  editable={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, isSaving && styles.buttonDisabled]}
                onPress={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Save Changes</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.button, styles.signOutButton]}
                onPress={handleSignOut}
                disabled={loading}
              >
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  dismissButton: {
    padding: 8,
  },
  avatarContainer: {
    alignItems: 'center',
    marginVertical: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadProgress: {
    marginTop: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 8,
    borderRadius: 4,
  },
  uploadProgressText: {
    color: '#fff',
    fontSize: 12,
  },
  form: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: '#fff',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  charCount: {
    color: '#8E8E93',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  disabledInput: {
    backgroundColor: '#F2F2F7',
    color: '#8E8E93',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    marginTop: 20,
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default Profile; 