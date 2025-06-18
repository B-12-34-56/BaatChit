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
  Platform
} from "react-native";
import { db, storage } from "../utils/firebase";
import { doc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { useNavigation } from "@react-navigation/native";
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../utils/firebase';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

const Profile = () => {
  const [currentUser] = useAuthState(auth);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoURL, setPhotoURL] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [originalDisplayName, setOriginalDisplayName] = useState("");
  const [originalPhotoURL, setOriginalPhotoURL] = useState("");
  const navigation = useNavigation();

  useEffect(() => {
    if (currentUser) {
      const name = currentUser.displayName || "";
      const photo = currentUser.photoURL || "";
      setDisplayName(name);
      setEmail(currentUser.email || "");
      setPhotoURL(photo);
      setOriginalDisplayName(name);
      setOriginalPhotoURL(photo);
    }
  }, [currentUser]);

  const handleAvatarChange = async () => {
    try {
      // Request permission
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
      });

      if (!result.canceled && result.assets[0]) {
        setAvatarFile(result.assets[0]);
        setPhotoURL(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setStatus("");
    
    try {
      let newPhotoURL = photoURL;
      
      if (avatarFile) {
        // Use React Native compatible file handling instead of blob
        const fileUri = avatarFile.uri;
        const fileInfo = await FileSystem.getInfoAsync(fileUri);
        
        if (!fileInfo.exists) {
          throw new Error('Selected file does not exist');
        }
        
        // Read file as base64 for upload
        const base64Data = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        
        // Convert base64 to Uint8Array for Firebase upload
        const bytes = new Uint8Array(Buffer.from(base64Data, 'base64'));
        
        const storageRef = ref(storage, `${currentUser.uid}_avatar_${Date.now()}.jpg`);
        await uploadBytesResumable(storageRef, bytes, {
          contentType: avatarFile.type || 'image/jpeg',
        });
        newPhotoURL = await getDownloadURL(storageRef);
      }
      
      // Update Firebase Auth profile
      await updateProfile(currentUser, {
        displayName,
        photoURL: newPhotoURL,
      });
      
      // Update Firestore user doc
      await updateDoc(doc(db, "users", currentUser.uid), {
        displayName,
        photoURL: newPhotoURL,
      });
      
      // Update original values
      setOriginalDisplayName(displayName);
      setOriginalPhotoURL(newPhotoURL);
      setAvatarFile(null);
      setIsEditMode(false);
      
      Alert.alert("Success", "Profile updated!");
      setStatus("Profile updated!");
    } catch (err) {
      const errorMessage = "Error: " + err.message;
      setStatus(errorMessage);
      Alert.alert("Error", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(originalDisplayName);
    setPhotoURL(originalPhotoURL);
    setAvatarFile(null);
    setIsEditMode(false);
    setStatus("");
  };

  const toggleEditMode = () => {
    if (isEditMode) {
      handleCancel();
    } else {
      setIsEditMode(true);
    }
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
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <View style={{
            backgroundColor: 'white',
            borderRadius: 24,
            padding: 48,
            width: '100%',
            maxWidth: 520,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.15,
            shadowRadius: 32,
            elevation: 15,
            alignItems: 'center',
          }}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{
                alignSelf: 'flex-start',
                marginBottom: 12,
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Ionicons name="arrow-back" size={20} color="#667eea" />
              <Text style={{
                color: '#667eea',
                fontWeight: '600',
                fontSize: 15,
                marginLeft: 4,
              }}>
                Back
              </Text>
            </TouchableOpacity>
            
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              width: '100%',
              marginBottom: 24,
            }}>
              <Text style={{
                fontWeight: '800',
                fontSize: 28,
                color: '#667eea',
              }}>
                Profile
              </Text>
              
              <TouchableOpacity
                onPress={toggleEditMode}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  backgroundColor: isEditMode ? '#e53e3e' : '#667eea',
                  borderRadius: 20,
                }}
              >
                <Ionicons 
                  name={isEditMode ? "close" : "create"} 
                  size={16} 
                  color="white" 
                />
                <Text style={{
                  color: 'white',
                  fontWeight: '600',
                  fontSize: 14,
                  marginLeft: 4,
                }}>
                  {isEditMode ? 'Cancel' : 'Edit'}
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <Text style={{
                fontWeight: '600',
                fontSize: 15,
                marginBottom: 8,
              }}>
                Avatar
              </Text>
              <Image 
                source={{ uri: photoURL }} 
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  marginBottom: 8,
                }} 
              />
              {isEditMode && (
                <TouchableOpacity onPress={handleAvatarChange}>
                  <Text style={{
                    color: '#667eea',
                    fontWeight: '500',
                    fontSize: 15,
                  }}>
                    Change Avatar
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Display Name"
              editable={isEditMode}
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isEditMode ? '#667eea' : '#e0e0e0',
                fontSize: 15,
                fontWeight: '500',
                backgroundColor: isEditMode ? '#f7f8fa' : '#f5f5f5',
                color: isEditMode ? '#222' : '#888',
                marginBottom: 16,
              }}
            />
            
            <TextInput
              value={email}
              editable={false}
              placeholder="Email"
              style={{
                width: '100%',
                padding: 12,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#e0e0e0',
                fontSize: 15,
                fontWeight: '500',
                backgroundColor: '#f7f8fa',
                color: '#888',
                marginBottom: 24,
              }}
            />
            
            {isEditMode && (
              <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: 12,
                  backgroundColor: loading ? '#cbd5e0' : '#667eea',
                  borderRadius: 8,
                  marginBottom: 8,
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
                  {loading ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            )}
            
            {status && (
              <Text style={{
                color: status.startsWith('Error') ? '#e53e3e' : '#4CAF50',
                fontSize: 13,
                textAlign: 'center',
              }}>
                {status}
              </Text>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

export default Profile;