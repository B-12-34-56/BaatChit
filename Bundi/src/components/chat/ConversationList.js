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
  ScrollView,
  Linking
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Crypto from 'expo-crypto';
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where } from "firebase/firestore";

// Get file hash using expo-crypto
async function getFileHash(uri) {
  try {
    // Fetch the image data
    const response = await fetch(uri);
    const blob = await response.blob();
    
    // Convert blob to base64
    const reader = new FileReader();
    const base64 = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    
    // Remove the data URL prefix to get just the base64 string
    const base64Data = base64.split(',')[1];
    
    // Use expo-crypto to generate SHA-256 hash from base64 string
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Data
    );
    return hash;
  } catch (error) {
    console.error('Error generating hash:', error);
    throw error;
  }
}

// GLOBAL duplicate and count check
async function getUploadLog(fileHash) {
  try {
    const db = getFirestore();
    const logRef = doc(db, "global_upload_logs", fileHash);
    const logSnap = await getDoc(logRef);
    return logSnap.exists() ? logSnap.data() : null;
  } catch (error) {
    console.log('No existing log found for', fileHash, '- this is normal for new images');
    return null;
  }
}

// Get total count including similar images - ENHANCED VERSION
async function getTotalUploadCount(fileHash) {
  try {
    const db = getFirestore();
    
    // First, check if this hash belongs to a similarity group
    const groupRef = doc(db, "similarity_groups", fileHash);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      // No group, check just this hash
      const uploadLog = await getUploadLog(fileHash);
      return {
        totalCount: uploadLog ? uploadLog.count : 0,
        allUploads: uploadLog ? uploadLog.uploads : [],
        relatedHashes: [fileHash]
      };
    }
    
    const groupId = groupSnap.data().groupId;
    
    // Get cached group count for performance
    const groupCountRef = doc(db, "group_counts", groupId);
    const groupCountSnap = await getDoc(groupCountRef);
    
    if (groupCountSnap.exists()) {
      const countData = groupCountSnap.data();
      
      // Get all members of the group for detailed upload info
      const groupMembersQuery = query(
        collection(db, "similarity_groups"),
        where("groupId", "==", groupId)
      );
      const groupMembers = await getDocs(groupMembersQuery);
      
      const allUploads = [];
      const relatedHashes = [];
      
      // Collect all uploads from group members
      for (const memberDoc of groupMembers.docs) {
        const memberHash = memberDoc.id;
        relatedHashes.push(memberHash);
        
        const uploadLog = await getUploadLog(memberHash);
        if (uploadLog && uploadLog.uploads) {
          const uploads = uploadLog.uploads.map(u => ({
            ...u,
            imageHash: memberHash
          }));
          allUploads.push(...uploads);
        }
      }
      
      // Sort by timestamp
      allUploads.sort((a, b) => a.timestamp - b.timestamp);
      
      return {
        totalCount: countData.totalCount || 0,
        allUploads,
        relatedHashes
      };
    }
    
    // Fallback: calculate manually if cache doesn't exist
    const groupMembersQuery = query(
      collection(db, "similarity_groups"),
      where("groupId", "==", groupId)
    );
    const groupMembers = await getDocs(groupMembersQuery);
    
    let totalCount = 0;
    const allUploads = [];
    const relatedHashes = [];
    
    for (const memberDoc of groupMembers.docs) {
      const memberHash = memberDoc.id;
      relatedHashes.push(memberHash);
      
      const uploadLog = await getUploadLog(memberHash);
      if (uploadLog) {
        totalCount += uploadLog.count || 0;
        const uploads = (uploadLog.uploads || []).map(u => ({
          ...u,
          imageHash: memberHash
        }));
        allUploads.push(...uploads);
      }
    }
    
    allUploads.sort((a, b) => a.timestamp - b.timestamp);
    
    console.log(`Total count for ${fileHash}: ${totalCount} across ${relatedHashes.length} related images`);
    
    return {
      totalCount,
      allUploads,
      relatedHashes
    };
  } catch (error) {
    console.error('Error getting total upload count:', error);
    return { totalCount: 0, allUploads: [], relatedHashes: [fileHash] };
  }
}

// Centralized error logging function
function logError(operation, error, context = {}) {
  const errorInfo = {
    operation,
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      code: error.code,
      stack: error.stack
    },
    context,
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  console.error(`[MessageInput Error] ${operation}:`, errorInfo);
  
  // Optional: Send to analytics/monitoring service
  // analyticsService.logError(errorInfo);
  
  return errorInfo;
}

// Enhanced duplicate checking with error logging
async function checkDuplicateAcrossDevices(fileHash, retryCount = 0) {
  const db = getFirestore();
  const maxRetries = 3;
  
  try {
    const startTime = performance.now();
    
    // STEP 1: Quick exact hash check (same device re-upload)
    const exactMatchRef = doc(db, "global_upload_logs", fileHash);
    const exactMatchSnap = await getDoc(exactMatchRef);
    
    if (exactMatchSnap.exists()) {
      const exactData = exactMatchSnap.data();
      console.log('Found exact hash match (same device re-upload)');
      
      // Log performance
      const duration = performance.now() - startTime;
      console.log(`Exact hash check completed in ${duration.toFixed(2)}ms`);
      
      return {
        isDuplicate: true,
        isExact: true,
        totalCount: exactData.count || 0,
        detectionMethod: 'exact_hash',
        firstUploaderName: exactData.firstUploaderName,
        allUploads: exactData.uploads || [],
        relatedHashes: [fileHash],
        performanceMs: duration
      };
    }
    
    // STEP 2: Check if this hash belongs to a similarity group (cross-device)
    const groupRef = doc(db, "similarity_groups", fileHash);
    const groupSnap = await getDoc(groupRef);
    
    if (groupSnap.exists()) {
      const groupId = groupSnap.data().groupId;
      console.log('Found similarity group:', groupId);
      
      // Get cached group count for performance
      const groupCountRef = doc(db, "group_counts", groupId);
      const groupCountSnap = await getDoc(groupCountRef);
      
      if (groupCountSnap.exists()) {
        const countData = groupCountSnap.data();
        
        // Get all members of the group
        const groupMembersQuery = query(
          collection(db, "similarity_groups"),
          where("groupId", "==", groupId)
        );
        const groupMembers = await getDocs(groupMembersQuery);
        const relatedHashes = groupMembers.docs.map(doc => doc.id);
        
        const duration = performance.now() - startTime;
        console.log(`Cross-device detection: ${countData.totalCount} uploads across ${relatedHashes.length} similar images (${duration.toFixed(2)}ms)`);
        
        return {
          isDuplicate: countData.totalCount > 0,
          isExact: false,
          totalCount: countData.totalCount,
          detectionMethod: 'similarity_group',
          relatedHashes: relatedHashes,
          groupId: groupId,
          performanceMs: duration
        };
      }
    }
    
    // STEP 3: Fallback - manual perceptual hash comparison
    console.log('Performing manual perceptual hash comparison...');
    const result = await performManualSimilarityCheck(fileHash);
    result.performanceMs = performance.now() - startTime;
    return result;
    
  } catch (error) {
    const errorInfo = logError('checkDuplicateAcrossDevices', error, {
      fileHash,
      retryCount,
      operation: 'duplicate_check'
    });
    
    // Retry on network errors
    if (retryCount < maxRetries && (
      error.code === 'unavailable' || 
      error.code === 'deadline-exceeded' ||
      error.code === 'permission-denied' ||
      error.message.includes('network') ||
      error.message.includes('timeout')
    )) {
      console.log(`Retrying duplicate check... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
      return checkDuplicateAcrossDevices(fileHash, retryCount + 1);
    }
    
    // Return safe fallback
    return {
      isDuplicate: false,
      isExact: false,
      totalCount: 0,
      detectionMethod: 'error_fallback',
      relatedHashes: [fileHash],
      error: errorInfo
    };
  }
}

// Manual similarity check for immediate detection before Cloud Function completes
async function performManualSimilarityCheck(fileHash) {
  const db = getFirestore();
  
  try {
    // Get all existing perceptual hashes
    const hashesSnapshot = await getDocs(collection(db, "perceptual_hashes"));
    const similarHashes = [];
    
    // For a new upload, we don't have perceptual hash yet, so this is limited
    // But we can check if any existing hashes are in a group that might match
    
    // Get some recent uploads to check against
    const recentUploadsQuery = query(
      collection(db, "global_upload_logs"),
      // Could add ordering by lastUploadedAt here if indexed
    );
    const recentUploads = await getDocs(recentUploadsQuery);
    
    let totalRelatedCount = 0;
    
    // This is a simplified check - the real similarity detection happens in Cloud Function
    console.log('Manual check found no immediate similarities - relying on Cloud Function processing');
    
    return {
      isDuplicate: false,
      isExact: false,
      totalCount: 0,
      detectionMethod: 'manual_check',
      relatedHashes: [fileHash]
    };
    
  } catch (error) {
    console.error('Error in manual similarity check:', error);
    return {
      isDuplicate: false,
      isExact: false,
      totalCount: 0,
      detectionMethod: 'manual_error',
      relatedHashes: [fileHash]
    };
  }
}

// Enhanced upload process with comprehensive error logging
async function handleCrossDeviceUpload(imageUri, imageFile, currentUser) {
  const uploadStartTime = performance.now();
  
  try {
    // Step 1: Generate file hash
    console.log('Generating device-specific file hash...');
    const hashStartTime = performance.now();
    const fileHash = await getFileHash(imageUri);
    const hashDuration = performance.now() - hashStartTime;
    console.log(`File hash generated in ${hashDuration.toFixed(2)}ms:`, fileHash);
    
    // Step 2: Pre-check for duplicates (both exact and similar)
    console.log('Checking for duplicates across all devices...');
    const preCheckStartTime = performance.now();
    const preCheck = await checkDuplicateAcrossDevices(fileHash);
    const preCheckDuration = performance.now() - preCheckStartTime;
    
    console.log(`Pre-check completed in ${preCheckDuration.toFixed(2)}ms:`, preCheck);
    
    // Get total count including similar images
    const totalCountData = await getTotalUploadCount(fileHash);
    console.log('Total upload count across similarity group:', totalCountData.totalCount);
    
    // Block if total count (including similar images) is 3 or more
    if (totalCountData.totalCount >= 3) {
      return {
        imageUrl: null,
        imageHash: fileHash,
        imageTag: 'blocked',
        warningMessage: `Upload blocked: This image (or similar versions) has been uploaded ${totalCountData.totalCount} times across all devices. Maximum allowed: 3.`,
        duplicateInfo: {
          ...preCheck,
          totalCount: totalCountData.totalCount,
          allUploads: totalCountData.allUploads
        },
        blocked: true
      };
    }
    
    // Step 3: Upload to storage
    console.log('Uploading to Firebase Storage...');
    const uploadStorageStartTime = performance.now();
    const imageUrl = await uploadImageToFirebase(imageUri, currentUser.uid, fileHash, imageFile);
    const uploadStorageDuration = performance.now() - uploadStorageStartTime;
    console.log(`Storage upload completed in ${uploadStorageDuration.toFixed(2)}ms`);
    
    // Step 4: Update upload log
    console.log('Updating global upload log...');
    const logUpdateStartTime = performance.now();
    await incrementUploadLog(
      currentUser.uid,
      currentUser.displayName || currentUser.email,
      fileHash,
      imageFile?.fileName || 'image.jpg'
    );
    const logUpdateDuration = performance.now() - logUpdateStartTime;
    console.log(`Upload log updated in ${logUpdateDuration.toFixed(2)}ms`);
    
    // Step 5: Wait for Cloud Function processing
    console.log('Waiting for Cloud Function to process perceptual similarities...');
    let attempts = 0;
    let finalCheck = null;
    const cloudFunctionStartTime = performance.now();
    
    // Poll for similarity group creation
    while (attempts < 6) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      finalCheck = await checkDuplicateAcrossDevices(fileHash);
      
      if (finalCheck.detectionMethod === 'similarity_group') {
        const cloudFunctionDuration = performance.now() - cloudFunctionStartTime;
        console.log(`Cloud Function processing completed in ${cloudFunctionDuration.toFixed(2)}ms - similarity group found`);
        break;
      }
      
      attempts++;
      console.log(`Waiting for similarity processing... attempt ${attempts}/6`);
    }
    
    // Step 6: Final determination
    if (!finalCheck) {
      finalCheck = await checkDuplicateAcrossDevices(fileHash);
    }
    
    const totalDuration = performance.now() - uploadStartTime;
    
    // Log comprehensive performance metrics
    console.log('Upload Performance Metrics:', {
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      hashGeneration: `${hashDuration.toFixed(2)}ms`,
      preCheck: `${preCheckDuration.toFixed(2)}ms`,
      storageUpload: `${uploadStorageDuration.toFixed(2)}ms`,
      logUpdate: `${logUpdateDuration.toFixed(2)}ms`,
      cloudFunctionWait: attempts * 3000 + 'ms',
      finalCheck: finalCheck
    });
    
    // Get final total count including similar images
    const finalTotalCount = await getTotalUploadCount(fileHash);
    
    // Determine warning message and tag
    let imageTag = 'original';
    let warningMessage = 'New image uploaded successfully! [ORIGINAL]';
    
    if (finalTotalCount.totalCount >= 3) {
      imageTag = 'blocked';
      warningMessage = `Upload would exceed limit: ${finalTotalCount.totalCount} total uploads across all devices. Maximum: 3.`;
    } else if (finalTotalCount.totalCount === 2) {
      imageTag = finalCheck.isExact ? 'duplicate' : 'similar';
      if (finalCheck.detectionMethod === 'similarity_group') {
        warningMessage = `Cross-device duplicate detected! This is upload 2/3. Similar image found on other device(s). One more upload allowed globally.`;
      } else {
        warningMessage = `Duplicate detected! This is upload 2/3. One more upload allowed.`;
      }
    } else if (finalTotalCount.totalCount === 1) {
      imageTag = 'original';
      warningMessage = 'New image uploaded successfully! [ORIGINAL]';
    }
    
    return {
      imageUrl,
      imageHash: fileHash,
      imageTag,
      warningMessage,
      duplicateInfo: {
        ...finalCheck,
        totalCount: finalTotalCount.totalCount,
        allUploads: finalTotalCount.allUploads
      },
      performance: {
        totalDuration,
        hashDuration,
        preCheckDuration,
        uploadStorageDuration,
        logUpdateDuration
      }
    };
    
  } catch (error) {
    const totalDuration = performance.now() - uploadStartTime;
    
    logError('handleCrossDeviceUpload', error, {
      imageFile: {
        fileName: imageFile?.fileName,
        fileSize: imageFile?.fileSize,
        type: imageFile?.type
      },
      currentUser: {
        uid: currentUser?.uid,
        email: currentUser?.email
      },
      performance: {
        totalDuration,
        failedAt: 'unknown'
      }
    });
    
    throw error;
  }
}

async function incrementUploadLog(userId, userName, fileHash, fileName) {
  const db = getFirestore();
  const logRef = doc(db, "global_upload_logs", fileHash);
  const logSnap = await getDoc(logRef);
  
  const uploadEntry = {
    userId,
    userName: userName || 'Anonymous',
    timestamp: Date.now()
  };
  
  if (logSnap.exists()) {
    const currentData = logSnap.data();
    await updateDoc(logRef, {
      count: currentData.count + 1,
      lastUploadedAt: serverTimestamp(),
      fileName,
      uploads: [...(currentData.uploads || []), uploadEntry]
    });
  } else {
    await setDoc(logRef, {
      fileHash,
      count: 1,
      lastUploadedAt: serverTimestamp(),
      fileName,
      firstUploaderId: userId,
      firstUploaderName: userName || 'Anonymous',
      uploads: [uploadEntry]
    });
  }
}

async function uploadImageToFirebase(imageUri, userId, fileHash, imageFile) {
  try {
    const storage = getStorage();
    const timestamp = Date.now();
    
    // Debug logging
    console.log('Upload attempt - Auth state:', {
      userId,
      hasAuth: !!auth.currentUser,
      currentUserId: auth.currentUser?.uid
    });
    
    // Fetch the image as a blob
    const response = await fetch(imageUri);
    const blob = await response.blob();
    
    // Determine the correct content type and file extension
    let contentType = 'image/jpeg'; // default
    let fileExtension = 'jpg'; // default
    
    // Try multiple ways to get the content type
    if (blob.type && blob.type.includes('image/')) {
      contentType = blob.type;
    } else if (imageFile?.type) {
      contentType = imageFile.type;
    } else if (imageFile?.mimeType) {
      contentType = imageFile.mimeType;
    } else if (imageUri.toLowerCase().includes('.png')) {
      contentType = 'image/png';
    }
    
    // Set the correct file extension
    if (contentType === 'image/png') {
      fileExtension = 'png';
    } else if (contentType === 'image/jpeg' || contentType === 'image/jpg') {
      fileExtension = 'jpg';
    }
    
    // Create filename with correct extension
    const fileName = `image_${timestamp}_${fileHash.substring(0, 8)}.${fileExtension}`;
    const storageRef = ref(storage, `user_uploads/${userId}/${fileName}`);
    
    // Debug logging for file type
    console.log('File info:', {
      originalType: imageFile?.type,
      blobType: blob.type,
      detectedContentType: contentType,
      fileExtension: fileExtension,
      fileName: fileName,
      size: blob.size
    });
    
    // Upload with metadata
    const metadata = {
      contentType: contentType,
      customMetadata: {
        fileHash: fileHash,
        uploadTimestamp: timestamp.toString(),
        tag: 'original'
      }
    };
    
    console.log('Uploading with metadata:', metadata);
    console.log('Storage path:', `user_uploads/${userId}/${fileName}`);
    
    await uploadBytes(storageRef, blob, metadata);
    const downloadURL = await getDownloadURL(storageRef);
    
    console.log('Upload successful, download URL:', downloadURL);
    return downloadURL;
  } catch (error) {
    console.error('Error uploading to Firebase:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      serverResponse: error.serverResponse
    });
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
  const [hasPermission, setHasPermission] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateModalData, setDuplicateModalData] = useState(null);
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
    try {
      // First check if we have permission
      const { status: existingStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      let finalStatus = existingStatus;
      
      // If we don't have permission, request it
      if (existingStatus !== 'granted') {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }
      
      // If we still don't have permission, show alert and return
      if (finalStatus !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant permission to access your photo library to send images.',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Open Settings',
              onPress: () => Linking.openSettings()
            }
          ]
        );
        return;
      }

      // Now launch the image picker with proper options
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
        aspect: [4, 3],
        exif: false,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Check file size (10MB limit)
        if (asset.fileSize && asset.fileSize > 10 * 1024 * 1024) {
          Alert.alert('Image Too Large', 'Please select an image smaller than 10MB');
          return;
        }
        
        setImageUri(asset.uri);
        setImageFile({
          uri: asset.uri,
          fileName: asset.fileName || `image_${Date.now()}.jpg`,
          type: asset.type || 'image/jpeg',
          fileSize: asset.fileSize || 0
        });
        setDuplicateWarning('');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert(
        'Error',
        'Failed to pick image. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const checkImageDuplicate = async (uri, file) => {
    try {
      setUploading(true);
      const fileHash = await getFileHash(uri);
      const duplicateCheck = await checkDuplicateAcrossDevices(fileHash);
      
      if (duplicateCheck.totalCount >= 2) {
        // Show duplicate modal with details
        setDuplicateModalData({
          totalCount: duplicateCheck.totalCount,
          isExact: duplicateCheck.isExact,
          detectionMethod: duplicateCheck.detectionMethod,
          allUploads: duplicateCheck.allUploads || [],
          fileHash: fileHash,
          canProceed: duplicateCheck.totalCount === 2 // Allow one more upload if count is 2
        });
        setShowDuplicateModal(true);
        
        if (duplicateCheck.totalCount >= 3) {
          setDuplicateWarning('⛔ Maximum uploads reached (3/3). This image cannot be uploaded again.');
        } else {
          setDuplicateWarning(`⚠️ Duplicate detected (${duplicateCheck.totalCount}/3). One more upload allowed.`);
        }
      } else {
        setDuplicateWarning('✅ New image ready to upload');
      }
    } catch (error) {
      console.error('Error checking duplicate:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if ((!text.trim() && !imageUri) || !data.chatId || uploading) return;
    
    // Check if image is blocked
    if (duplicateModalData && duplicateModalData.totalCount >= 3) {
      Alert.alert(
        'Upload Blocked',
        `This image has already been uploaded ${duplicateModalData.totalCount} times. Maximum allowed is 3.`,
        [{ text: 'OK', onPress: () => {
          setImageUri(null);
          setImageFile(null);
          setDuplicateModalData(null);
          setDuplicateWarning('');
        }}]
      );
      return;
    }
    
    let imageHash = null;
    let imageUrl = null;
    let imageTag = null;
    let warningMessage = '';
    
    if (imageUri) {
      setDuplicateWarning('');
      setUploading(true);
      
      try {
        if (!currentUser || !currentUser.uid) {
          Alert.alert('Authentication Error', 'Please sign in again');
          return;
        }

        // Use enhanced upload handler
        const uploadResult = await handleCrossDeviceUpload(imageUri, imageFile, currentUser);
        
        imageUrl = uploadResult.imageUrl;
        imageHash = uploadResult.imageHash;
        imageTag = uploadResult.imageTag;
        warningMessage = uploadResult.warningMessage;
        
        if (uploadResult.blocked) {
          Alert.alert(
            'Upload Blocked',
            warningMessage,
            [{
              text: 'OK',
              onPress: () => {
                setImageUri(null);
                setImageFile(null);
                setDuplicateModalData(null);
                setShowDuplicateModal(false);
              }
            }]
          );
          if (mounted.current) {
            setUploading(false);
          }
          return;
        }
        
      } catch (err) {
        Alert.alert('Upload Failed', `Image upload failed: ${err.message || 'Unknown error'}`);
        if (mounted.current) {
          setUploading(false);
        }
        return;
      }
      
      if (mounted.current) {
        setUploading(false);
      }
    }
    
    // Send message
    try {
      await messageService.sendMessage(
        data.chatId,
        {
          senderUid: currentUser.uid,
          senderDisplayName: currentUser.displayName,
          senderPhotoURL: currentUser.photoURL,
          recipientDisplayName: data.user?.displayName,
          recipientPhotoURL: data.user?.photoURL,
          text: text || (imageUri ? `[Image: ${imageFile?.fileName || 'image.jpg'}]` : ''),
          type: imageUri ? 'image' : 'text',
          imageUrl,
          imageHash,
          imageTag,
          createdAt: new Date(),
        },
        data.user?.uid
      );
      
      if (mounted.current) {
        setText('');
        setImageUri(null);
        setImageFile(null);
        setDuplicateWarning('');
        setDuplicateModalData(null);
        setShowDuplicateModal(false);
      }
    } catch (error) {
      Alert.alert('Send Failed', 'Failed to send message. Please try again.');
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
              
              {duplicateModalData.detectionMethod === 'similarity_group' && (
                <View style={styles.detectionInfo}>
                  <Text style={styles.detectionLabel}>Detection Type:</Text>
                  <Text style={styles.detectionValue}>Cross-device similarity match</Text>
                </View>
              )}
              
              <View style={styles.uploadHistory}>
                <Text style={styles.historyTitle}>Upload History:</Text>
                {duplicateModalData.allUploads?.slice(-5).map((upload, index) => (
                  <View key={index} style={styles.historyItem}>
                    <Text style={styles.historyUser}>{upload.userName || 'Anonymous'}</Text>
                    <Text style={styles.historyTime}>
                      {new Date(upload.timestamp).toLocaleString()}
                    </Text>
                  </View>
                ))}
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
              {isBlocked ? (
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setShowDuplicateModal(false);
                    removeImage();
                  }}
                >
                  <Text style={styles.modalButtonText}>Remove Image</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonCancel]}
                    onPress={() => {
                      setShowDuplicateModal(false);
                      removeImage();
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalButtonProceed]}
                    onPress={() => {
                      setShowDuplicateModal(false);
                      // Proceed with sending
                    }}
                  >
                    <Text style={[styles.modalButtonText, styles.modalButtonTextProceed]}>
                      Upload Anyway
                    </Text>
                  </TouchableOpacity>
                </>
              )}
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.inputContainer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message"
          style={styles.textInput}
          editable={!uploading}
        />
        
        <TouchableOpacity
          onPress={handleImagePick}
          style={styles.attachButton}
          disabled={uploading}
        >
          <Text style={styles.attachIcon}>📎</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={handleSend}
          style={[
            styles.sendButton,
            uploading && styles.disabledButton,
            duplicateModalData?.totalCount >= 3 && imageUri && styles.blockedButton
          ]}
          disabled={Boolean(uploading) || Boolean(!text.trim() && !imageUri)}
        >
          {uploading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {duplicateWarning ? (
        <View style={styles.warningContainer}>
          <Text style={[
            styles.warningText,
            duplicateWarning.includes('⛔') && styles.blockedWarning,
            duplicateWarning.includes('⚠️') && styles.duplicateWarning,
            duplicateWarning.includes('✅') && styles.originalWarning
          ]}>
            {duplicateWarning}
          </Text>
        </View>
      ) : null}
      
      {imageUri && (
        <View style={styles.imagePreview}>
          <Image source={{ uri: imageUri }} style={styles.previewImage} />
          <View style={styles.imageInfo}>
            <Text style={styles.imageFileName}>
              {imageFile?.fileName || 'image.jpg'}
            </Text>
            {duplicateModalData && (
              <Text style={[
                styles.uploadCount,
                duplicateModalData.totalCount >= 3 && styles.uploadCountBlocked
              ]}>
                {duplicateModalData.totalCount}/3 uploads
              </Text>
            )}
          </View>
          <TouchableOpacity
            onPress={removeImage}
            style={styles.removeButton}
          >
            <Text style={styles.removeButtonText}>×</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {renderDuplicateModal()}
    </KeyboardAvoidingView>
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
  textInput: {
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
  attachIcon: {
    fontSize: 26,
    opacity: 0.8,
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
  blockedButton: {
    backgroundColor: '#e53e3e',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  warningContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  warningText: {
    fontWeight: '600',
    fontSize: 14,
  },
  duplicateWarning: {
    color: '#ff9800',
  },
  blockedWarning: {
    color: '#e53e3e',
  },
  originalWarning: {
    color: '#4caf50',
  },
  imagePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginTop: 0,
  },
  previewImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  imageInfo: {
    flex: 1,
    marginLeft: 12,
  },
  imageFileName: {
    color: '#444',
    fontWeight: '500',
  },
  uploadCount: {
    color: '#ff9800',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  uploadCountBlocked: {
    color: '#e53e3e',
  },
  removeButton: {
    padding: 8,
  },
  removeButtonText: {
    fontSize: 24,
    color: '#e53e3e',
    fontWeight: 'bold',
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
    flexDirection: 'row',
    justifyContent: 'space-between',
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
  modalButtonProceed: {
    backgroundColor: '#667eea',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  modalButtonTextProceed: {
    color: '#fff',
  },
});

export default MessageInput;
