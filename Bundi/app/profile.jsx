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
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { updateProfile } from "firebase/auth";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { auth, db, storage } from "../src/utils/firebase";
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import authService from '../src/services/authService';
import { updateUserProfile, getUserById } from '../src/services/userService';
import { useAuthState } from 'react-firebase-hooks/auth';

const MAX_NAME_LENGTH = 50;
const MAX_EMAIL_LENGTH = 100;
const MAX_BIO_LENGTH = 200;

export default function Profile() {
  const [user] = useAuthState(auth);
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
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || "");
      setEmail(user.email || "");
      setPhotoURL(user.photoURL || "");
    }
    loadProfile();
  }, [user]);

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
      if (!user?.uid) {
        throw new Error('No user found');
      }
      
      const phoneNumber = await AsyncStorage.getItem('phoneNumber');
      const userProfile = await getUserById(user.uid);
      
      setProfile({
        name: userProfile?.displayName || '',
        email: userProfile?.email || '',
        phoneNumber: phoneNumber || '',
        bio: userProfile?.bio || '',
      });
      
      // Also update the display name and photo URL states
      setDisplayName(userProfile?.displayName || '');
      setPhotoURL(userProfile?.photoURL || '');
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async () => {
    try {
      Alert.alert(
        "Change Profile Photo",
        "Choose how you want to update your profile photo",
        [
          {
            text: "Take Photo",
            onPress: () => handleImageSelection('camera'),
          },
          {
            text: "Choose from Gallery",
            onPress: () => handleImageSelection('gallery'),
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to open image picker");
    }
  };

  const handleImageSelection = async (source) => {
    try {
      let permissionResult;
      let result;

      if (source === 'camera') {
        permissionResult = await ImagePicker.requestCameraPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert("Permission Required", "Permission to access camera is required!");
          return;
        }
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          maxWidth: 800,
          maxHeight: 800,
          base64: true,
        });
      } else {
        permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (permissionResult.granted === false) {
          Alert.alert("Permission Required", "Permission to access photo library is required!");
          return;
        }
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.7,
          maxWidth: 800,
          maxHeight: 800,
          base64: true,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        
        // Check file size
        if (asset.fileSize > 5 * 1024 * 1024) {
          Alert.alert("Error", "Image size must be less than 5MB");
          return;
        }

        // Show preview and confirm
        Alert.alert(
          "Confirm Photo",
          "Would you like to use this photo as your profile picture?",
          [
            {
              text: "Cancel",
              style: "cancel",
            },
            {
              text: "Use Photo",
              onPress: () => {
                setAvatarFile(asset);
                setPhotoURL(asset.uri);
              },
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert("Error", "Failed to process image. Please try again.");
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploadProgress(0);
      const response = await fetch(uri);
      const blob = await response.blob();
      
      // Create a unique filename with timestamp and user ID
      const timestamp = Date.now();
      const storageRef = ref(storage, `avatars/${user.uid}_${timestamp}`);
      
      // Add metadata
      const metadata = {
        contentType: blob.type,
        customMetadata: {
          userId: user.uid,
          uploadTime: new Date().toISOString(),
          phoneNumber: user.phoneNumber || 'unknown'
        }
      };

      const uploadTask = uploadBytesResumable(storageRef, blob, metadata);
      
      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            setUploadProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(new Error('Failed to upload image. Please try again.'));
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              console.error('Error getting download URL:', error);
              reject(new Error('Failed to get image URL. Please try again.'));
            }
          }
        );
      });
    } catch (error) {
      console.error('Error in uploadImage:', error);
      throw new Error('Failed to upload image. Please try again.');
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
      await updateProfile(user, {
        displayName: profile.name,
        photoURL: newPhotoURL,
      });
      
      // Update Firestore user document
      await updateUserProfile(user.uid, {
        displayName: profile.name,
        photoURL: newPhotoURL,
        email: profile.email,
        bio: profile.bio,
        updatedAt: new Date(),
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
      <TouchableOpacity
        onPress={() => router.back()}
        style={[styles.backBtn, { top: insets.top + 12 }]}
      >
        <Ionicons name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
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
            </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 30,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    backgroundColor: '#e0e0e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  disabledInput: {
    opacity: 0.7,
  },
  inputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
  },
  charCount: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    padding: 10,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
    zIndex: 10,
  },
}); 