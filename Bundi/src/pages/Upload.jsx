// Upload.jsx - React Native version
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Image,
  FileSystem
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { getPresignedUrl } from '../services/presignService';
import { messageService } from '../services/messageService';

// Use environment variables without hardcoded fallbacks
const PRESIGN_API_URL = process.env.EXPO_PUBLIC_PRESIGN_API_URL || "";

// Keywords you want to block
const BLOCKED_KEYWORDS = ['name', 'signature', 'sign', 'signed'];

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

async function getFileHash(uri) {
  try {
    // For React Native, we'll use a simple hash based on file properties
    // In production, you might want to use a proper hashing library
    const fileInfo = await FileSystem.getInfoAsync(uri);
    const timestamp = Date.now();
    const fileSize = fileInfo.size || 0;
    
    // Create a simple hash based on file properties
    const hashString = `${uri}_${fileSize}_${timestamp}`;
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashString));
    const hashArray = Array.from(new Uint8Array(hash));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex.substring(0, 32); // Return first 32 characters
  } catch (error) {
    console.warn('Failed to generate file hash, using fallback:', error);
    // Fallback hash
    return `hash_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}

export default function UploadToS3() {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState({ message: '', type: 'info', visible: false });
  const [uploading, setUploading] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const navigation = useNavigation();

  // When user selects a file
  const handleFileSelect = async () => {
    try {
      Alert.alert(
        "Select File Type",
        "Choose how you want to select your file",
        [
          {
            text: "Camera",
            onPress: pickFromCamera,
          },
          {
            text: "Gallery",
            onPress: pickFromGallery,
          },
          {
            text: "Documents",
            onPress: pickDocument,
          },
          {
            text: "Cancel",
            style: "cancel",
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to open file picker");
    }
  };

  const pickFromCamera = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access camera is required!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize || 0,
      });
      setStatus({ message: '', type: 'info', visible: false });
      setDuplicateWarning('');
    }
  };

  const pickFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "Permission to access gallery is required!");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setFile({
        uri: asset.uri,
        name: asset.fileName || `image_${Date.now()}.jpg`,
        type: asset.type || 'image/jpeg',
        size: asset.fileSize || 0,
      });
      setStatus({ message: '', type: 'info', visible: false });
      setDuplicateWarning('');
    }
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setFile({
          uri: asset.uri,
          name: asset.name,
          type: asset.mimeType,
          size: asset.size,
        });
        setStatus({ message: '', type: 'info', visible: false });
        setDuplicateWarning('');
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick document");
    }
  };

  // Main upload logic
  const handleUpload = async () => {
    if (!file) {
      setStatus({ message: 'Please select a file first', type: 'error', visible: true });
      return;
    }
    if (isBlockedFilename(file.name)) {
      setStatus({
        message: 'This filename is blocked (contains a forbidden keyword).',
        type: 'error',
        visible: true,
      });
      return;
    }
    if (duplicateWarning) {
      setStatus({ message: duplicateWarning, type: 'error', visible: true });
      return;
    }

    setUploading(true);
    setStatus({ message: 'Requesting presigned URL…', type: 'info', visible: true });

    try {
      // 1) Get presigned URL from backend
      const presignedUrl = await getPresignedUrl(file.name, file.type, PRESIGN_API_URL);
      if (!presignedUrl) throw new Error('Failed to get presigned URL');
      setStatus({ message: 'Uploading file to S3…', type: 'info', visible: true });

      // 2) Convert URI to blob for upload
      const response = await fetch(file.uri);
      const blob = await response.blob();

      // 3) Upload file to S3 using the presigned URL
      const uploadResponse = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: blob,
      });
      
      if (!uploadResponse.ok) {
        let text = '';
        try { text = await uploadResponse.text(); } catch (_) {}
        throw new Error(`S3 upload failed (status ${uploadResponse.status}): ${text}`);
      }
      
      setStatus({ message: 'Upload successful!', type: 'success', visible: true });
      Alert.alert("Success", "File uploaded successfully!");
    } catch (err) {
      const errorMessage = err.message || 'Upload failed';
      setStatus({ message: errorMessage, type: 'error', visible: true });
      Alert.alert("Error", errorMessage);
    } finally {
      setUploading(false);
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
        <View style={{
          backgroundColor: 'white',
          borderRadius: 24,
          padding: 40,
          width: '100%',
          maxWidth: 420,
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
          
          <Text style={{
            fontWeight: '800',
            fontSize: 28,
            color: '#667eea',
            marginBottom: 18,
            textAlign: 'center',
          }}>
            Upload File to S3
          </Text>

          <TouchableOpacity
            onPress={handleFileSelect}
            disabled={uploading}
            style={{
              borderWidth: 2,
              borderColor: '#667eea',
              borderStyle: 'dashed',
              borderRadius: 12,
              padding: 40,
              width: '100%',
              alignItems: 'center',
              marginBottom: 20,
              backgroundColor: uploading ? '#f5f5f5' : 'transparent',
            }}
          >
            <Ionicons 
              name="cloud-upload-outline" 
              size={48} 
              color={uploading ? '#ccc' : '#667eea'} 
            />
            <Text style={{
              color: uploading ? '#ccc' : '#667eea',
              fontSize: 16,
              fontWeight: '600',
              marginTop: 8,
              textAlign: 'center',
            }}>
              {file ? 'Change File' : 'Select File'}
            </Text>
          </TouchableOpacity>

          {file && (
            <View style={{ 
              width: '100%',
              padding: 16,
              backgroundColor: '#f7f8fa',
              borderRadius: 8,
              marginBottom: 20,
            }}>
              {file.type?.startsWith('image/') && (
                <Image 
                  source={{ uri: file.uri }} 
                  style={{ 
                    width: '100%', 
                    height: 150, 
                    borderRadius: 8,
                    marginBottom: 8,
                    resizeMode: 'cover',
                  }} 
                />
              )}
              <Text style={{ 
                color: '#444', 
                fontWeight: '500',
                fontSize: 14,
              }}>
                {file.name}
              </Text>
              <Text style={{ 
                color: '#666', 
                fontSize: 12,
                marginTop: 2,
              }}>
                {Math.round((file.size || 0) / 1024)} KB
              </Text>
            </View>
          )}

          {duplicateWarning && (
            <Text style={{ 
              color: 'red', 
              fontWeight: '600', 
              marginBottom: 16,
              textAlign: 'center',
            }}>
              {duplicateWarning}
            </Text>
          )}

          <TouchableOpacity
            onPress={handleUpload}
            disabled={uploading || !file || !!duplicateWarning}
            style={{
              width: '100%',
              padding: 12,
              backgroundColor: 
                uploading || !file || !!duplicateWarning
                  ? '#b3b3b3'
                  : '#667eea',
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
              {uploading ? 'Uploading…' : 'Upload'}
            </Text>
          </TouchableOpacity>

          {status.visible && (
            <View style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor:
                status.type === 'error'
                  ? '#ffd6d6'
                  : status.type === 'warning'
                  ? '#fff4cc'
                  : status.type === 'success'
                  ? '#d4ffd6'
                  : '#e0e0e0',
              width: '100%',
            }}>
              <Text style={{
                color:
                  status.type === 'error'
                    ? '#911111'
                    : status.type === 'warning'
                    ? '#665500'
                    : status.type === 'success'
                    ? '#115511'
                    : '#333333',
                fontSize: 14,
                textAlign: 'center',
                fontWeight: '500',
              }}>
                {status.message}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}