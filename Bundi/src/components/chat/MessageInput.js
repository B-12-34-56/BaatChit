import React, { useContext, useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import Ionicons from '@expo/vector-icons/Ionicons';
import { uploadUserContent } from '../../services/storageService';
import { awsConfig, uploadImageToS3, getImageUploadCountDynamo, incrementImageUploadCountDynamo, checkAWSCredentials, api } from '../../utils/aws';
import { getPresignedUrl } from '../../services/presignService';
import { uploadImage, waitForS3 } from '../../services/uploadService';
import Toast from 'react-native-toast-message';
import { MaterialIcons } from '@expo/vector-icons';

// AWS API Endpoints from environment variables
// Note: These are now handled by the api.checkDuplicate function from aws.js

// Timing utility
const getTimestamp = () => {
  const now = new Date();
  return {
    iso: now.toISOString(),
    unix: now.getTime(),
    readable: now.toLocaleTimeString()
  };
};

// Enhanced logging utility
const logEvent = (event, data) => {
  const timestamp = getTimestamp();
  console.log(`[${timestamp.readable}] 🔍 ${event}:`, {
    ...data,
    timestamp: timestamp.iso
  });
};

// Get file hash using expo-crypto
async function getFileHash(uri) {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { 
      encoding: FileSystem.EncodingType.Base64 
    });
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64
    );
    return hash;
  } catch (error) {
    console.error('Error generating hash:', error);
    throw error;
  }
}

// Check for duplicates using Lambda (includes cross-device detection)
async function checkDuplicateWithLambda(imageUri, fileHash, userId, fileName) {
  try {
    logEvent('LAMBDA_CHECK_START', {
      fileHash: fileHash.substring(0, 12) + '...',
      userId
    });
    
    console.log('🔍 [checkDuplicateWithLambda] Starting direct S3 upload...');
    console.log('🔍 [checkDuplicateWithLambda] Request payload:', {
      fileUri: imageUri,
      fileHash: fileHash.substring(0, 12) + '...',
      userId,
      fileName
    });
    
    // Use the new upload service that uploads directly to S3
    const result = await uploadImage({
      fileUri: imageUri,
      filename: fileName,
      fileHash: fileHash,
      contentType: 'image/jpeg',
      userId: userId
    });
    
    console.log('🔍 [checkDuplicateWithLambda] Upload result:', {
      success: result.success,
      blocked: result.blocked,
      hasImageUrl: !!result.imageUrl,
      totalCount: result.totalCount,
      uploadCount: result.uploadCount,
      message: result.message
    });
    
    logEvent('LAMBDA_CHECK_RESULT', {
      blocked: result.blocked,
      uploadCount: result.uploadCount,
      totalCount: result.totalCount,
      similarImages: result.similarImages?.length || 0
    });
    
    return result;
  } catch (error) {
    console.error('❌ [checkDuplicateWithLambda] Error:', error);
    
    // Show specific toast for 403 errors
    if (error.message.includes('Auth token missing')) {
      Toast.show({
        type: 'error',
        text1: 'Authentication Error',
        text2: 'Auth token missing – check API key or stage name',
        position: 'top',
        visibilityTime: 5000,
      });
    } else {
      Toast.show({
        type: 'error',
        text1: 'Upload Error',
        text2: error.message || 'Failed to upload image',
        position: 'top',
        visibilityTime: 4000,
      });
    }
    
    throw error;
  }
}

// Get image statistics from Lambda
async function getImageStats(perceptualHash) {
  try {
    const response = await fetch(LAMBDA_GET_STATS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ perceptualHash })
    });
    
    return await response.json();
  } catch (error) {
    console.error('Error getting image stats:', error);
    return null;
  }
}

// Main AWS upload handler with duplicate detection
async function handleAWSUpload(imageUri, imageFile, currentUser) {
  const startTime = performance.now();
  
  try {
    logEvent('AWS_UPLOAD_START', {
      fileName: imageFile?.fileName,
      fileSize: imageFile?.fileSize
    });
    
    // Step 1: Generate file hash
    const fileHash = await getFileHash(imageUri);
    
    // Step 2: Check for duplicates with Lambda (includes perceptual hashing and upload)
    const duplicateCheck = await checkDuplicateWithLambda(
      imageUri, 
      fileHash, 
      currentUser.uid,
      imageFile?.fileName || 'image.jpg'
    );
    
    // Step 3: Handle blocking
    if (duplicateCheck.blocked) {
      logEvent('UPLOAD_BLOCKED', {
        totalCount: duplicateCheck.totalCount,
        similarImages: duplicateCheck.similarImages?.length || 0,
        message: duplicateCheck.message
      });
      
      return {
        imageUrl: null,
        imageHash: fileHash,
        perceptualHash: duplicateCheck.perceptualHash,
        imageTag: 'blocked',
        warningMessage: duplicateCheck.message,
        blocked: true,
        totalCount: duplicateCheck.totalCount,
        similarImages: duplicateCheck.similarImages || [],
        uploadCount: duplicateCheck.uploadCount
      };
    }
    
    // Step 4: Use the image URL from the upload service
    const imageUrl = duplicateCheck.imageUrl;
    
    if (!imageUrl) {
      console.error('❌ Upload service did not return image URL');
      throw new Error('Image upload failed - no URL returned');
    }
    
    const duration = performance.now() - startTime;
    
    logEvent('AWS_UPLOAD_COMPLETE', {
      duration: `${duration.toFixed(2)}ms`,
      totalCount: duplicateCheck.totalCount || 1,
      uploadCount: duplicateCheck.uploadCount || 1,
      similarImages: duplicateCheck.similarImages?.length || 0
    });
    
    // Determine image tag based on count
    let imageTag = 'original';
    const totalCount = duplicateCheck.totalCount || 1;
    if (totalCount >= 3) {
      imageTag = 'blocked';
    } else if (totalCount === 2) {
      imageTag = 'warning';
    }
    
    return {
      imageUrl,
      imageHash: fileHash,
      perceptualHash: duplicateCheck.perceptualHash || fileHash,
      imageTag,
      warningMessage: duplicateCheck.message || 'Upload successful',
      blocked: false,
      totalCount: totalCount,
      uploadCount: duplicateCheck.uploadCount || 1,
      similarImages: duplicateCheck.similarImages || []
    };
    
  } catch (error) {
    console.error('❌ AWS upload error:', error);
    return {
      imageUrl: null,
      imageHash: null,
      imageTag: 'error',
      warningMessage: error.message || 'Error uploading image',
      blocked: false,
      totalCount: 0
    };
  }
}

// Format upload history for display
function formatUploadHistory(similarImages, uploadCount) {
  const allUploads = [];
  
  // Add uploads from similar images
  if (similarImages && similarImages.length > 0) {
    similarImages.forEach(img => {
      if (img.uploads) {
        img.uploads.forEach(upload => {
          allUploads.push({
            ...upload,
            imageHash: img.hash,
            distance: img.distance
          });
        });
      }
    });
  }
  
  // Sort by timestamp
  allUploads.sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
  });
  
  return allUploads;
}

// Test upload function for debugging
async function testUpload(imageUri, currentUser) {
  try {
    console.log('🧪 [testUpload] Starting test upload...');
    
    const base64 = await FileSystem.readAsStringAsync(imageUri, { 
      encoding: FileSystem.EncodingType.Base64 
    });
    
    const testResult = await uploadImage({
      image: base64,
      filename: 'test_image.jpg',
      fileHash: 'test_hash_123',
      contentType: 'image/jpeg',
      userId: currentUser.uid
    });
    
    console.log('🧪 [testUpload] Test result:', {
      success: testResult.success,
      imageUrl: testResult.imageUrl?.substring(0, 50) + '...',
      blocked: testResult.blocked,
      totalCount: testResult.totalCount
    });
    
    return testResult;
  } catch (error) {
    console.error('🧪 [testUpload] Test failed:', error);
    throw error;
  }
}

const MessageInput = () => {
  const { data } = useContext(ChatContext);
  const [currentUser] = useAuthState(auth);
  const [text, setText] = useState('');
  const [imageUri, setImageUri] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [uploading, setUploading] = useState(false);
  const [hasPermission, setHasPermission] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalData, setDuplicateModalData] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    (async () => {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
    
    return () => {
      mounted.current = false;
    };
  }, []);

  const handleImagePick = async () => {
    console.log('📷 Starting image picker...');
    
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Permission to access gallery is required!');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        if (!asset.uri) {
          throw new Error('Asset URI is null');
        }
        
        if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
          throw new Error(`File too large: ${(asset.fileSize / (1024 * 1024)).toFixed(2)}MB`);
        }
        
        if (mounted.current) {
          setImageUri(asset.uri);
          setImageFile(asset);
          setDuplicateWarning('');
          setDuplicateModalData(null);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', `Failed to pick image: ${error.message}`);
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !imageUri) || !data.chatId || uploading) return;
    
    let imageHash = null;
    let imageUrl = null;
    let imageTag = null;
    let warningMessage = '';
    
    // Send message immediately with placeholder if there's an image
    if (imageUri) {
      console.log('🖼️ Processing image upload...');
      setDuplicateWarning('');
      setUploading(true);
      
      try {
        if (!currentUser || !currentUser.uid) {
          Alert.alert('Authentication Error', 'Please sign in again');
          return;
        }
        
        // Generate file hash for tracking
        const fileHash = await getFileHash(imageUri);
        imageHash = fileHash;
        
        // Create a placeholder URL for the uploading state
        const placeholderUrl = `${process.env.EXPO_PUBLIC_S3_BASE_URL || 'YOUR_S3_BASE_URL'}/${currentUser.uid}/uploading_${Date.now()}.jpg`;
        imageUrl = placeholderUrl;
        imageTag = 'uploading';
        warningMessage = 'Image is being uploaded...';
        
        // Send message immediately with placeholder
        await messageService.sendMessage(
          data.chatId,
          {
            senderUid: currentUser.uid,
            senderDisplayName: currentUser.displayName,
            senderPhotoURL: currentUser.photoURL,
            recipientDisplayName: data.user?.displayName,
            recipientPhotoURL: data.user?.photoURL,
            text: text || `[Image: ${imageFile?.fileName || 'image.jpg'}]`,
            type: 'image',
            imageUrl: imageUrl,
            imageHash: imageHash,
            imageTag: imageTag,
            createdAt: new Date(),
          },
          data.user?.uid
        );
        
        console.log('✅ [MessageInput] Message sent with placeholder URL');
        
        // Now handle the actual upload in the background
        try {
          const uploadResult = await checkDuplicateWithLambda(
            imageUri, 
            fileHash, 
            currentUser.uid,
            imageFile?.fileName || 'image.jpg'
          );
          
          if (uploadResult.blocked) {
            // Show duplicate modal
            setDuplicateModalData({
              totalCount: uploadResult.totalCount,
              uploadCount: uploadResult.uploadCount,
              similarImages: uploadResult.similarImages,
              allUploads: formatUploadHistory(uploadResult.similarImages, uploadResult.uploadCount),
              fileHash: uploadResult.imageHash,
              perceptualHash: uploadResult.perceptualHash,
              canProceed: false
            });
            setShowDuplicateModal(true);
            setUploading(false);
            setImageUri(null);
            setImageFile(null);
            return;
          }
          
          // Update the message with the real image URL
          if (uploadResult.imageUrl) {
            console.log('✅ [MessageInput] Upload completed, updating message with real URL');
            // Here you would update the message in the database with the real URL
            // For now, we'll just log it
            console.log('Real image URL:', uploadResult.imageUrl);
          }
          
        } catch (uploadError) {
          console.error('❌ [MessageInput] Background upload failed:', uploadError);
          // Don't block the UI, just log the error
        }
        
      } catch (err) {
        console.error('Upload error:', err);
        Alert.alert('Upload Failed', `Image upload failed: ${err.message || 'Unknown error'}`);
        setUploading(false);
        return;
      }
      
      setUploading(false);
    } else {
      // Text-only message - send immediately
      try {
        console.log('📤 [MessageInput] Sending text message');
        
        await messageService.sendMessage(
          data.chatId,
          {
            senderUid: currentUser.uid,
            senderDisplayName: currentUser.displayName,
            senderPhotoURL: currentUser.photoURL,
            recipientDisplayName: data.user?.displayName,
            recipientPhotoURL: data.user?.photoURL,
            text: text,
            type: 'text',
            createdAt: new Date(),
          },
          data.user?.uid
        );
        
        console.log('✅ [MessageInput] Text message sent successfully');
        
      } catch (error) {
        console.error('❌ [MessageInput] Message send error:', error);
        Alert.alert('Send Failed', 'Failed to send message. Please try again.');
        return;
      }
    }
    
    // Clear the form
    if (mounted.current) {
      setText('');
      setImageUri(null);
      setImageFile(null);
      setDuplicateWarning('');
      setDuplicateModalData(null);
      setShowDuplicateModal(false);
    }
  };

  const removeImage = () => {
    setImageUri(null);
    setImageFile(null);
    setDuplicateWarning('');
    setDuplicateModalData(null);
    setShowDuplicateModal(false);
  };

  const renderDuplicateModal = () => {
    if (!duplicateModalData) return null;
    
    const isBlocked = duplicateModalData.totalCount >= 3;
    const isWarning = duplicateModalData.totalCount === 2;
    
    const firstUpload = duplicateModalData.allUploads?.[0];
    const lastUpload = duplicateModalData.allUploads?.[duplicateModalData.allUploads.length - 1];
    const timeSinceFirstUpload = firstUpload ? Date.now() - new Date(firstUpload.timestamp).getTime() : 0;
    const timeSinceLastUpload = lastUpload ? Date.now() - new Date(lastUpload.timestamp).getTime() : 0;
    
    const formatTimeAgo = (ms) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);
      
      if (days > 0) return `${days}d ago`;
      if (hours > 0) return `${hours}h ago`;
      if (minutes > 0) return `${minutes}m ago`;
      return `${seconds}s ago`;
    };
    
    return (
      <Modal
        visible={showDuplicateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDuplicateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={[
              styles.modalHeader,
              isBlocked && styles.modalHeaderBlocked,
              isWarning && styles.modalHeaderWarning
            ]}>
              <Text style={styles.modalTitle}>
                {isBlocked ? '⛔ Upload Blocked' : '⚠️ Duplicate Detected'}
              </Text>
            </View>
            
            <ScrollView style={styles.modalBody}>
              <Text style={styles.modalInfoText}>
                This image has been uploaded {duplicateModalData.totalCount} times across all devices.
              </Text>
              
              {duplicateModalData.similarImages && duplicateModalData.similarImages.length > 0 && (
                <View style={styles.detectionInfo}>
                  <Text style={styles.detectionLabel}>Detection Type:</Text>
                  <Text style={styles.detectionValue}>
                    Cross-device similarity match ({duplicateModalData.similarImages.length} similar images found)
                  </Text>
                </View>
              )}
              
              <View style={styles.uploadHistory}>
                <Text style={styles.historyTitle}>Upload History:</Text>
                {duplicateModalData.allUploads?.slice(-5).map((upload, index) => (
                  <View key={index} style={styles.historyItem}>
                    <Text style={styles.historyUser}>{upload.userId || 'Anonymous'}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(upload.timestamp).toLocaleString()}
                      {upload.distance !== undefined && (
                        <Text style={styles.distanceInfo}> (similarity: {upload.distance})</Text>
                      )}
                    </Text>
                  </View>
                ))}
                {firstUpload && (
                  <View style={styles.firstUploadInfo}>
                    <Text style={styles.firstUploadText}>
                      First upload: {formatTimeAgo(timeSinceFirstUpload)}
                    </Text>
                  </View>
                )}
              </View>
              
              <View style={styles.limitInfo}>
                <Text style={styles.limitText}>
                  Upload Limit: {duplicateModalData.totalCount}/3
                </Text>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill,
                      { width: `${(duplicateModalData.totalCount / 3) * 100}%` },
                      isBlocked && styles.progressFillBlocked
                    ]} 
                  />
                </View>
              </View>
            </ScrollView>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowDuplicateModal(false);
                  removeImage();
                }}
              >
                <Text style={styles.modalButtonText}>
                  {isBlocked ? 'Remove Image' : 'Cancel'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (!hasPermission) {
    return <Text style={styles.permissionText}>No access to camera roll</Text>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor="#999"
          multiline
        />
        
        <TouchableOpacity 
          style={styles.attachButton} 
          onPress={handleImagePick}
          disabled={uploading}
        >
          <Ionicons name="attach" size={24} color="#007AFF" />
        </TouchableOpacity>
        
        {/* Test button for debugging */}
        {imageUri && (
          <TouchableOpacity 
            style={[styles.attachButton, { backgroundColor: '#ff9800' }]} 
            onPress={async () => {
              try {
                console.log('🧪 Testing upload...');
                await testUpload(imageUri, currentUser);
              } catch (error) {
                console.error('🧪 Test failed:', error);
                Alert.alert('Test Failed', error.message);
              }
            }}
            disabled={uploading}
          >
            <Ionicons name="bug" size={20} color="white" />
          </TouchableOpacity>
        )}
        
        {/* Toggle between presign server and Lambda */}
        {imageUri && (
          <TouchableOpacity 
            style={[styles.attachButton, { backgroundColor: '#4caf50' }]} 
            onPress={() => {
              Alert.alert(
                'Upload Method',
                'Choose upload method:',
                [
                  { text: 'Presign Server', onPress: () => console.log('Using presign server') },
                  { text: 'Lambda', onPress: () => console.log('Using Lambda') },
                  { text: 'Cancel', style: 'cancel' }
                ]
              );
            }}
            disabled={uploading}
          >
            <Ionicons name="settings" size={20} color="white" />
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            uploading && styles.disabledButton
          ]}
          disabled={Boolean(uploading) || Boolean(!text.trim() && !imageUri)}
          onPress={handleSend}
        >
          <Ionicons name="send" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {imageUri && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: imageUri }} style={styles.imagePreview} />
          <View style={styles.imageInfo}>
            <Text style={styles.imageFileName}>
              {imageFile?.fileName || 'image.jpg'}
            </Text>
          </View>
          <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
            <Ionicons name="close-circle" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      {duplicateWarning && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>{duplicateWarning}</Text>
        </View>
      )}

      {renderDuplicateModal()}
      <Toast />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  permissionText: {
    textAlign: 'center',
    padding: 20,
    color: '#666',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    fontSize: 16,
  },
  attachButton: {
    padding: 8,
  },
  sendButton: {
    padding: 10,
    paddingHorizontal: 22,
    borderRadius: 8,
    backgroundColor: '#667eea',
  },
  disabledButton: {
    opacity: 0.5,
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginTop: 0,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 8,
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  imageInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  imageFileName: {
    color: '#444',
    fontWeight: '500',
    fontSize: 14,
    marginBottom: 4,
  },
  removeImageButton: {
    padding: 8,
  },
  warningContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  warningText: {
    color: '#ff9800',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalHeader: {
    backgroundColor: '#ff9800',
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalHeaderBlocked: {
    backgroundColor: '#e53e3e',
  },
  modalHeaderWarning: {
    backgroundColor: '#ff9800',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  modalBody: {
    padding: 16,
    maxHeight: 300,
  },
  modalInfoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  detectionInfo: {
    backgroundColor: '#f5f5f5',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  detectionLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  detectionValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  uploadHistory: {
    marginBottom: 16,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  historyItem: {
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  historyUser: {
    fontSize: 13,
    color: '#333',
  },
  historyTime: {
    fontSize: 11,
    color: '#666',
  },
  distanceInfo: {
    fontSize: 10,
    color: '#999',
    fontStyle: 'italic',
  },
  limitInfo: {
    marginTop: 16,
  },
  limitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#ff9800',
    borderRadius: 4,
  },
  progressFillBlocked: {
    backgroundColor: '#e53e3e',
  },
  modalActions: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#e0e0e0',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  firstUploadInfo: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
  },
  firstUploadText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
});

export default MessageInput;