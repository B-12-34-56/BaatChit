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
import { ChatContext } from '../../context/ChatContext';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../utils/firebase';
import { messageService } from '../../services/messageService';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { getFirestore, doc, getDoc, setDoc, updateDoc, serverTimestamp, collection, getDocs, query, where, limit, orderBy, deleteDoc } from "firebase/firestore";
import Ionicons from '@expo/vector-icons/Ionicons';

// Add timing utility
const getTimestamp = () => {
  const now = new Date();
  return {
    iso: now.toISOString(),
    unix: now.getTime(),
    readable: now.toLocaleTimeString()
  };
};

// Enhanced logging utility
const logDuplicateEvent = (event, data) => {
  const timestamp = getTimestamp();
  console.log(`[${timestamp.readable}] 🔍 ${event}:`, {
    ...data,
    timestamp: timestamp.iso
  });
};

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

// Check if THIS SPECIFIC IMAGE has been uploaded before
async function getImageUploadCount(fileHash) {
  try {
    const db = getFirestore();
    const logRef = doc(db, "global_upload_logs", fileHash);
    const logSnap = await getDoc(logRef);
    
    if (!logSnap.exists()) {
      return {
        count: 0,
        uploads: [],
        isExactImage: true
      };
    }
    
    const data = logSnap.data();
    return {
      count: data.count || 0,
      uploads: data.uploads || [],
      firstUploaderName: data.firstUploaderName,
      isExactImage: true
    };
  } catch (error) {
    console.error('Error getting upload count:', error);
    return { count: 0, uploads: [], isExactImage: true };
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
  const startTime = getTimestamp();
  
  try {
    logDuplicateEvent('TOTAL_COUNT_START', {
      fileHash: fileHash.substring(0, 12) + '...'
    });
    
    const db = getFirestore();
    
    // First, check if this hash belongs to a similarity group
    const groupRef = doc(db, "similarity_groups", fileHash);
    const groupSnap = await getDoc(groupRef);
    
    if (!groupSnap.exists()) {
      logDuplicateEvent('TOTAL_COUNT_NO_GROUP', {
        fileHash: fileHash.substring(0, 12) + '...',
        timeElapsedMs: Date.now() - startTime.unix
      });
      
      // No group, check just this hash
      const uploadLog = await getUploadLog(fileHash);
      return {
        totalCount: uploadLog ? uploadLog.count : 0,
        allUploads: uploadLog ? uploadLog.uploads : [],
        relatedHashes: [fileHash]
      };
    }
    
    const groupId = groupSnap.data().groupId;
    logDuplicateEvent('TOTAL_COUNT_GROUP_FOUND', {
      groupId,
      timeElapsedMs: Date.now() - startTime.unix
    });
    
    // Get cached group count for performance
    const groupCountRef = doc(db, "group_counts", groupId);
    const groupCountSnap = await getDoc(groupCountRef);
    
    // Always calculate the actual count from group members
    const groupMembersQuery = query(
      collection(db, "similarity_groups"),
      where("groupId", "==", groupId)
    );
    const groupMembers = await getDocs(groupMembersQuery);

    if (groupMembers.empty) {
      console.warn('⚠️ No members found in group:', groupId);
      throw new Error('No group members found');
    }

    // Calculate the real total count from all members
    let actualTotalCount = 0;
    const allUploads = [];
    const relatedHashes = [];

    for (const memberDoc of groupMembers.docs) {
      const memberHash = memberDoc.id;
      relatedHashes.push(memberHash);
      
      const uploadLog = await getUploadLog(memberHash);
      if (uploadLog) {
        actualTotalCount += uploadLog.count || 0;
        const uploads = (uploadLog.uploads || []).map(u => ({
          ...u,
          imageHash: memberHash
        }));
        allUploads.push(...uploads);
      }
    }

    // Sort uploads by timestamp
    allUploads.sort((a, b) => a.timestamp - b.timestamp);

    // If cached count exists but differs, log the discrepancy
    if (groupCountSnap.exists()) {
      const cachedCount = groupCountSnap.data()?.totalCount || 0;
      if (cachedCount !== actualTotalCount) {
        console.warn(`⚠️ Count mismatch - Cached: ${cachedCount}, Actual: ${actualTotalCount}`);
      }
    }

    logDuplicateEvent('TOTAL_COUNT_CALCULATED', {
      groupId,
      totalCount: actualTotalCount,
      memberCount: groupMembers.size,
      timeElapsedMs: Date.now() - startTime.unix
    });

    return {
      totalCount: actualTotalCount,
      allUploads,
      relatedHashes
    };
  } catch (error) {
    logDuplicateEvent('TOTAL_COUNT_ERROR', {
      error: error.message,
      stack: error.stack,
      timeElapsedMs: Date.now() - startTime.unix
    });
    
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

// Update checkSimilarityGroupWithRetry with enhanced logging
async function checkSimilarityGroupWithRetry(fileHash, maxRetries = 3, initialDelay = 1000) {
  let retryCount = 0;
  let delay = initialDelay;
  const startTime = getTimestamp();
  
  logDuplicateEvent('SIMILARITY_CHECK_START', {
    fileHash: fileHash.substring(0, 12) + '...',
    maxRetries,
    initialDelay
  });
  
  while (retryCount < maxRetries) {
    try {
      logDuplicateEvent('SIMILARITY_CHECK_ATTEMPT', {
        attempt: retryCount + 1,
        maxRetries,
        delay,
        elapsedMs: Date.now() - startTime.unix
      });
      
      const db = getFirestore();
      const groupRef = doc(db, "similarity_groups", fileHash);
      const groupSnap = await getDoc(groupRef);
      
      if (groupSnap.exists()) {
        const groupData = groupSnap.data();
        if (!groupData || !groupData.groupId) {
          throw new Error('Invalid group data');
        }
        
        // Check if the group was recently created
        const groupTimestamp = groupData.updatedAt?.toDate?.() || new Date();
        const timeSinceUpdate = Date.now() - groupTimestamp.getTime();
        
        logDuplicateEvent('SIMILARITY_GROUP_FOUND', {
          groupId: groupData.groupId,
          timeSinceUpdate,
          groupCreatedAt: groupTimestamp.toISOString(),
          attempt: retryCount + 1
        });
        
        if (timeSinceUpdate < 30000) { // 30 seconds
          logDuplicateEvent('SIMILARITY_GROUP_RECENT', {
            groupId: groupData.groupId,
            timeSinceUpdate,
            waitingFor: delay
          });
          await new Promise(resolve => setTimeout(resolve, delay));
          retryCount++;
          delay *= 2;
          continue;
        }
        
        return {
          success: true,
          groupId: groupData.groupId,
          timestamp: groupTimestamp,
          attempt: retryCount + 1,
          timeSinceUpdate
        };
      }
      
      // Check processing status
      const processingRef = doc(db, "processing_status", fileHash);
      const processingSnap = await getDoc(processingRef);
      
      if (processingSnap.exists() && processingSnap.data()?.status === 'pending') {
        const processingData = processingSnap.data();
        logDuplicateEvent('PROCESSING_PENDING', {
          status: processingData.status,
          startedAt: processingData.startedAt?.toDate?.()?.toISOString(),
          attempt: retryCount + 1
        });
        
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        delay *= 2;
        continue;
      }
      
      logDuplicateEvent('NO_SIMILARITY_GROUP', {
        attempt: retryCount + 1,
        hasProcessingStatus: processingSnap.exists(),
        processingStatus: processingSnap.exists() ? processingSnap.data()?.status : 'none'
      });
      
      return {
        success: false,
        attempt: retryCount + 1,
        reason: 'no_group_found'
      };
      
    } catch (error) {
      logDuplicateEvent('SIMILARITY_CHECK_ERROR', {
        error: error.message,
        attempt: retryCount + 1,
        stack: error.stack
      });
      
      if (retryCount < maxRetries - 1) {
        logDuplicateEvent('SIMILARITY_CHECK_RETRY', {
          nextAttempt: retryCount + 2,
          delay
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        retryCount++;
        delay *= 2;
      } else {
        return {
          success: false,
          attempt: retryCount + 1,
          error: error.message,
          reason: 'max_retries_exceeded'
        };
      }
    }
  }
  
  logDuplicateEvent('SIMILARITY_CHECK_TIMEOUT', {
    maxRetries,
    totalTimeMs: Date.now() - startTime.unix
  });
  
  return {
    success: false,
    attempt: retryCount,
    reason: 'max_retries_exceeded'
  };
}

// Modify the similarity group check in checkDuplicateAcrossDevices
async function checkDuplicateAcrossDevices(fileHash, retryCount = 0) {
  if (!fileHash || typeof fileHash !== 'string') {
    console.error('❌ Invalid fileHash provided to checkDuplicateAcrossDevices:', fileHash);
    return {
      isDuplicate: false,
      isExact: false,
      totalCount: 0,
      detectionMethod: 'invalid_input',
      relatedHashes: [],
      error: 'Invalid file hash provided'
    };
  }

  const db = getFirestore();
  const maxRetries = 3;
  
  try {
    const startTime = performance.now();
    console.log('🔍 Starting duplicate check for hash:', fileHash.substring(0, 12) + '...');
    
    // STEP 1: Quick exact hash check (same device re-upload)
    try {
      const exactMatchRef = doc(db, "global_upload_logs", fileHash);
      const exactMatchSnap = await getDoc(exactMatchRef);
      
      if (exactMatchSnap.exists()) {
        const exactData = exactMatchSnap.data();
        if (!exactData) {
          console.warn('⚠️ Document exists but data is null:', fileHash);
          throw new Error('Document data is null');
        }
        
        console.log('✅ Found exact hash match (same device re-upload)');
        
        // Log performance
        const duration = performance.now() - startTime;
        console.log(`⏱️ Exact hash check completed in ${duration.toFixed(2)}ms`);
        
        return {
          isDuplicate: true,
          isExact: true,
          totalCount: exactData.count || 0,
          detectionMethod: 'exact_hash',
          firstUploaderName: exactData.firstUploaderName || 'Unknown',
          allUploads: exactData.uploads || [],
          relatedHashes: [fileHash],
          performanceMs: duration
        };
      }
    } catch (exactCheckError) {
      console.error('❌ Error in exact hash check:', exactCheckError);
      // Continue to similarity check instead of failing
    }
    
    // STEP 2: Check if this hash belongs to a similarity group (cross-device)
    try {
      const similarityResult = await checkSimilarityGroupWithRetry(fileHash);
      
      if (similarityResult.success) {
        const groupId = similarityResult.groupId;
        console.log(`✅ Found similarity group after ${similarityResult.attempt} attempts:`, groupId);
        
        // Get cached group count for performance
        const groupCountRef = doc(db, "group_counts", groupId);
        const groupCountSnap = await getDoc(groupCountRef);

        // Always calculate the actual count from group members
        const groupMembersQuery = query(
          collection(db, "similarity_groups"),
          where("groupId", "==", groupId)
        );
        const groupMembers = await getDocs(groupMembersQuery);

        if (groupMembers.empty) {
          console.warn('⚠️ No members found in group:', groupId);
          throw new Error('No group members found');
        }

        // Calculate the real total count from all members
        let actualTotalCount = 0;
        const allUploads = [];
        const relatedHashes = [];

        for (const memberDoc of groupMembers.docs) {
          const memberHash = memberDoc.id;
          relatedHashes.push(memberHash);
          
          const uploadLog = await getUploadLog(memberHash);
          if (uploadLog) {
            actualTotalCount += uploadLog.count || 0;
            const uploads = (uploadLog.uploads || []).map(u => ({
              ...u,
              imageHash: memberHash
            }));
            allUploads.push(...uploads);
          }
        }

        // Sort uploads by timestamp
        allUploads.sort((a, b) => a.timestamp - b.timestamp);

        const duration = performance.now() - startTime;
        console.log(`⏱️ Cross-device detection: ${actualTotalCount} uploads across ${relatedHashes.length} similar images (${duration.toFixed(2)}ms)`);

        // If cached count exists but differs, log the discrepancy
        if (groupCountSnap.exists()) {
          const cachedCount = groupCountSnap.data()?.totalCount || 0;
          if (cachedCount !== actualTotalCount) {
            console.warn(`⚠️ Count mismatch - Cached: ${cachedCount}, Actual: ${actualTotalCount}`);
          }
        }

        return {
          isDuplicate: actualTotalCount > 0,
          isExact: false,
          totalCount: actualTotalCount,
          detectionMethod: 'similarity_group',
          relatedHashes: relatedHashes,
          groupId: groupId,
          performanceMs: duration,
          allUploads: allUploads,
          processingAttempts: similarityResult.attempt
        };
      } else {
        console.log(`ℹ️ No similarity group found after ${similarityResult.attempt} attempts: ${similarityResult.reason}`);
      }
    } catch (similarityCheckError) {
      console.error('❌ Error in similarity group check:', similarityCheckError);
      // Continue to manual check instead of failing
    }
    
    // STEP 3: Fallback - manual perceptual hash comparison
    console.log('🔄 Performing manual perceptual hash comparison...');
    try {
      const result = await performManualSimilarityCheck(fileHash);
      if (!result) {
        throw new Error('Manual check returned null result');
      }
      
      result.performanceMs = performance.now() - startTime;
      return {
        ...result,
        detectionMethod: 'manual_check',
        relatedHashes: result.relatedHashes || [fileHash]
      };
    } catch (manualCheckError) {
      console.error('❌ Error in manual similarity check:', manualCheckError);
      throw manualCheckError; // Let this error propagate for retry logic
    }
    
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
      console.log(`🔄 Retrying duplicate check... (${retryCount + 1}/${maxRetries})`);
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
      error: errorInfo,
      errorMessage: error.message
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

// Update checkAndHandleDuplicates with enhanced logging
async function checkAndHandleDuplicates(fileHash, currentUser) {
  const startTime = getTimestamp();
  
  try {
    logDuplicateEvent('DUPLICATE_CHECK_START', {
      fileHash: fileHash.substring(0, 12) + '...',
      userId: currentUser?.uid
    });
    
    // Get total count including similar images
    const totalCount = await getTotalUploadCount(fileHash);
    
    // Define blocking conditions - Block on 3rd upload, warn on 2nd
    const isBlocked = totalCount.totalCount >= 3;
    const isWarning = totalCount.totalCount === 2;
    
    logDuplicateEvent('DUPLICATE_CHECK_RESULT', {
      isBlocked,
      isWarning,
      totalCount: totalCount.totalCount,
      relatedImages: totalCount.relatedHashes.length,
      timeElapsedMs: Date.now() - startTime.unix
    });
    
    // Prepare response object
    const response = {
      isBlocked,
      isWarning,
      totalCount: totalCount.totalCount,
      allUploads: totalCount.allUploads || [],
      relatedHashes: totalCount.relatedHashes || [fileHash],
      warningMessage: '',
      blockedMessage: '',
      firstUploaderName: totalCount.allUploads?.[0]?.userName || 'Unknown',
      checkTimestamp: startTime.iso
    };
    
    // Set appropriate messages
    if (isBlocked) {
      response.blockedMessage = `Upload blocked: This image (or similar versions) has been uploaded ${totalCount.totalCount} times. Maximum allowed: 3 per unique image.`;
      response.warningMessage = response.blockedMessage;
      logDuplicateEvent('DUPLICATE_BLOCKED', {
        totalCount: totalCount.totalCount,
        relatedImages: totalCount.relatedHashes.length
      });
    } else if (isWarning) {
      response.warningMessage = `⚠️ WARNING: This image has been uploaded twice before. One more upload will reach the limit.`;
      logDuplicateEvent('DUPLICATE_WARNING', {
        totalCount: totalCount.totalCount
      });
    } else {
      response.warningMessage = '✅ New image ready to upload';
      logDuplicateEvent('DUPLICATE_NONE', {
        totalCount: totalCount.totalCount
      });
    }
    
    return response;
    
  } catch (error) {
    logDuplicateEvent('DUPLICATE_CHECK_ERROR', {
      error: error.message,
      stack: error.stack,
      timeElapsedMs: Date.now() - startTime.unix
    });
    
    return {
      isBlocked: false,
      isWarning: false,
      totalCount: 0,
      allUploads: [],
      relatedHashes: [fileHash],
      warningMessage: '❌ Error checking duplicates. Please try again.',
      blockedMessage: 'Error checking duplicates. Please try again.',
      error: error.message,
      checkTimestamp: startTime.iso
    };
  }
}

// Update handleCrossDeviceUpload to use consolidated logic
async function handleCrossDeviceUpload(imageUri, imageFile, currentUser) {
  const uploadStartTime = performance.now();
  
  try {
    // Step 1: Generate file hash
    console.log('Generating device-specific file hash...');
    const hashStartTime = performance.now();
    const fileHash = await getFileHash(imageUri);
    const hashDuration = performance.now() - hashStartTime;
    console.log(`File hash generated in ${hashDuration.toFixed(2)}ms:`, fileHash);
    
    // Step 2: Check duplicates using consolidated logic
    console.log('Checking for duplicates...');
    const duplicateCheck = await checkAndHandleDuplicates(fileHash, currentUser);
    
    if (duplicateCheck.isBlocked) {
      console.log('⛔ Upload blocked BEFORE storage upload due to duplicate limit');
      return {
        imageUrl: null,
        imageHash: fileHash,
        imageTag: 'blocked',
        warningMessage: duplicateCheck.blockedMessage,
        duplicateInfo: {
          totalCount: duplicateCheck.totalCount,
          allUploads: duplicateCheck.allUploads,
          relatedHashes: duplicateCheck.relatedHashes
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
    
    // Step 5: Wait for Cloud Function to process similarity
    console.log('⏳ Waiting for similarity processing...');
    await waitForSimilarityProcessing(fileHash);
    
    // Step 6: Get final duplicate check
    console.log('🔍 Performing final duplicate check after similarity processing...');
    const finalCheck = await checkAndHandleDuplicates(fileHash, currentUser);
    const totalDuration = performance.now() - uploadStartTime;
    
    if (finalCheck.isBlocked) {
      console.log('⛔ Upload blocked AFTER similarity processing - image was uploaded but message will be blocked');
      return {
        imageUrl,
        imageHash: fileHash,
        imageTag: 'blocked',
        warningMessage: finalCheck.blockedMessage,
        duplicateInfo: {
          totalCount: finalCheck.totalCount,
          allUploads: finalCheck.allUploads,
          relatedHashes: finalCheck.relatedHashes
        },
        blocked: true,
        performance: {
          totalDuration,
          hashDuration,
          uploadStorageDuration,
          logUpdateDuration
        }
      };
    }
    
    // Log comprehensive performance metrics
    console.log('Upload Performance Metrics:', {
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      hashGeneration: `${hashDuration.toFixed(2)}ms`,
      storageUpload: `${uploadStorageDuration.toFixed(2)}ms`,
      logUpdate: `${logUpdateDuration.toFixed(2)}ms`,
      finalCount: finalCheck.totalCount
    });
    
    return {
      imageUrl,
      imageHash: fileHash,
      imageTag: finalCheck.isWarning ? 'warning' : 'original',
      warningMessage: finalCheck.warningMessage,
      duplicateInfo: {
        totalCount: finalCheck.totalCount,
        allUploads: finalCheck.allUploads,
        relatedHashes: finalCheck.relatedHashes
      },
      blocked: false,
      performance: {
        totalDuration,
        hashDuration,
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
    
    // Use uploadBytesResumable instead of uploadBytes
    const uploadTask = uploadBytesResumable(storageRef, blob, metadata);
    
    // Wait for upload to complete
    await new Promise((resolve, reject) => {
      uploadTask.on('state_changed', 
        null,
        (error) => reject(error),
        () => resolve()
      );
    });
    
    const downloadURL = await getDownloadURL(storageRef);
    
    // Clean up the blob to prevent memory leaks
    blob.close();
    
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

// Add this function BEFORE the MessageInput component
async function waitForSimilarityProcessing(fileHash, maxChecks = 3, checkInterval = 3000) {
  const db = getFirestore();
  const startTime = getTimestamp();
  
  logDuplicateEvent('SIMILARITY_PROCESSING_START', {
    fileHash: fileHash.substring(0, 12) + '...',
    maxChecks,
    checkInterval
  });
  
  for (let i = 0; i < maxChecks; i++) {
    logDuplicateEvent('SIMILARITY_PROCESSING_CHECK', {
      attempt: i + 1,
      maxChecks,
      elapsedMs: Date.now() - startTime.unix
    });
    
    // Check if similarity group exists
    const groupDoc = await getDoc(doc(db, "similarity_groups", fileHash));
    
    if (groupDoc.exists()) {
      const groupData = groupDoc.data();
      logDuplicateEvent('SIMILARITY_PROCESSING_COMPLETE', {
        groupId: groupData.groupId,
        attempts: i + 1,
        totalTimeMs: Date.now() - startTime.unix
      });
      return true;
    }
    
    // Wait before next check (except on last iteration)
    if (i < maxChecks - 1) {
      logDuplicateEvent('SIMILARITY_PROCESSING_WAIT', {
        nextAttempt: i + 2,
        waitTime: checkInterval
      });
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }
  }
  
  logDuplicateEvent('SIMILARITY_PROCESSING_TIMEOUT', {
    maxChecks,
    totalTimeMs: Date.now() - startTime.unix
  });
  
  return false;
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
  const [blobErrors, setBlobErrors] = useState([]);
  const mounted = useRef(true);

  // Add error catching useEffect
  useEffect(() => {
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    console.error = (...args) => {
      const errorString = args.join(' ');
      if (errorString.includes('RCTBlobManager') || errorString.includes('attempt to insert nil object')) {
        console.log('🚨 [MessageInput] RCTBlobManager error captured:', {
          timestamp: new Date().toISOString(),
          args: args,
          currentImageUri: imageUri ? imageUri.substring(0, 50) + '...' : 'none',
          currentImageFile: imageFile ? {
            fileName: imageFile.fileName,
            type: imageFile.type,
            size: imageFile.fileSize
          } : 'none',
          uploading: uploading
        });
        
        setBlobErrors(prev => [...prev, {
          timestamp: Date.now(),
          error: errorString,
          context: {
            hasImageUri: !!imageUri,
            hasImageFile: !!imageFile,
            uploading: uploading
          }
        }]);
      }
      originalConsoleError.apply(console, args);
    };
    
    console.warn = (...args) => {
      const warnString = args.join(' ');
      if (warnString.includes('RCTBlobManager')) {
        console.log('⚠️ [MessageInput] RCTBlobManager warning captured:', args);
      }
      originalConsoleWarn.apply(console, args);
    };
    
    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, [imageUri, imageFile, uploading]);

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
    console.log('📷 [handleImagePick] Starting image picker...');
    
    if (!hasPermission) {
      console.error('❌ [handleImagePick] No permission');
      Alert.alert('Permission Required', 'Permission to access gallery is required!');
      return;
    }

    try {
      console.log('🔍 [handleImagePick] Launching image library...');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
      });

      console.log('📋 [handleImagePick] Picker result:', {
        canceled: result.canceled,
        assetsLength: result.assets?.length,
        firstAsset: result.assets?.[0] ? {
          uri: result.assets[0].uri?.substring(0, 50) + '...',
          type: result.assets[0].type,
          mimeType: result.assets[0].mimeType,
          fileName: result.assets[0].fileName,
          fileSize: result.assets[0].fileSize,
          width: result.assets[0].width,
          height: result.assets[0].height
        } : null
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        
        // Validate the asset
        if (!asset.uri) {
          throw new Error('Asset URI is null');
        }
        
        if (asset.fileSize && asset.fileSize > 50 * 1024 * 1024) {
          throw new Error(`File too large: ${(asset.fileSize / (1024 * 1024)).toFixed(2)}MB`);
        }
        
        console.log('✅ [handleImagePick] Asset validated, setting state...');
        
        if (mounted.current) {
          setImageUri(asset.uri);
          setImageFile(asset);
          setDuplicateWarning('');
          
          // Immediately test the URI
          console.log('🧪 [handleImagePick] Testing URI accessibility...');
          try {
            const testResponse = await fetch(asset.uri);
            console.log('✅ [handleImagePick] URI is accessible:', {
              status: testResponse.status,
              contentType: testResponse.headers.get('content-type'),
              contentLength: testResponse.headers.get('content-length')
            });
          } catch (testError) {
            console.error('❌ [handleImagePick] URI test failed:', testError);
            Alert.alert('Error', 'Selected image cannot be accessed');
            return;
          }
        }
      }
    } catch (error) {
      console.error('❌ [handleImagePick] Error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      Alert.alert('Error', `Failed to pick image: ${error.message}`);
    }
  };

  const showBlobErrors = () => {
    if (blobErrors.length === 0) {
      Alert.alert('No Errors', 'No RCTBlobManager errors captured yet');
      return;
    }
    
    const errorSummary = blobErrors.map((err, i) => 
      `${i + 1}. ${new Date(err.timestamp).toLocaleTimeString()}: ${err.error.substring(0, 100)}...`
    ).join('\n\n');
    
    Alert.alert('Captured Blob Errors', errorSummary);
    console.log('🚨 [showBlobErrors] All captured errors:', blobErrors);
  };

  const handleSend = async () => {
    if ((!text.trim() && !imageUri) || !data.chatId || uploading) return;
    
    let imageHash = null;
    let imageUrl = null;
    let imageTag = null;
    let warningMessage = '';
    
    if (imageUri) {
      console.log('🖼️ About to upload image...');
      setDuplicateWarning('');
      setUploading(true);
      
      try {
        if (!currentUser || !currentUser.uid) {
          console.error('❌ Authentication error: No current user');
          Alert.alert('Authentication Error', 'Please sign in again');
          return;
        }

        // Generate file hash first
        const fileHash = await getFileHash(imageUri);
        
        // Check duplicates using consolidated logic (pre-upload check)
        const duplicateCheck = await checkAndHandleDuplicates(fileHash, currentUser);
        
        if (duplicateCheck.isBlocked) {
          console.log('⛔ Upload blocked due to duplicate limit (pre-upload)');
          
          // Show detailed modal with upload history
          setDuplicateModalData({
            totalCount: duplicateCheck.totalCount,
            isExact: false,
            detectionMethod: 'pre_upload_check',
            allUploads: duplicateCheck.allUploads || [],
            fileHash: fileHash,
            canProceed: false
          });
          setShowDuplicateModal(true);
          
          if (mounted.current) {
            setUploading(false);
            // Clear the image selection
            setImageUri(null);
            setImageFile(null);
          }
          return; // STOP HERE - Don't upload!
        }
        
        // Set warning if needed
        if (duplicateCheck.isWarning) {
          setDuplicateWarning(duplicateCheck.warningMessage);
        }

        console.log('📝 About to track upload in database...');
        // Use enhanced upload handler
        const uploadResult = await handleCrossDeviceUpload(imageUri, imageFile, currentUser);
        console.log('✅ Upload tracking completed');
        
        // *** CRITICAL FIX: Check blocked status from BOTH pre-upload AND post-similarity checks ***
        if (uploadResult.blocked) {
          console.log('⛔ Upload was blocked after similarity processing');
          
          setDuplicateModalData({
            totalCount: uploadResult.duplicateInfo.totalCount,
            isExact: false,
            detectionMethod: 'post_similarity_check',
            allUploads: uploadResult.duplicateInfo.allUploads || [],
            fileHash: uploadResult.imageHash,
            canProceed: false
          });
          setShowDuplicateModal(true);
          
          if (mounted.current) {
            setUploading(false);
            setImageUri(null);
            setImageFile(null);
          }
          return; // *** CRITICAL: STOP HERE - Don't send message! ***
        }
        
        imageUrl = uploadResult.imageUrl;
        imageHash = uploadResult.imageHash;
        imageTag = uploadResult.imageTag;
        warningMessage = uploadResult.warningMessage;
        
      } catch (err) {
        console.error('❌ Upload error:', err);
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
    
    // *** IMPORTANT: Only send message if we have a valid upload (or text-only message) ***
    // The imageUrl check ensures we only send if upload succeeded AND wasn't blocked
    if (!imageUri || (imageUrl && imageTag !== 'blocked')) {
      try {
        console.log('📤 Sending message...');
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
        console.log('✅ Message sent successfully');
        
        if (mounted.current) {
          setText('');
          setImageUri(null);
          setImageFile(null);
          setDuplicateWarning('');
          setDuplicateModalData(null);
          setShowDuplicateModal(false);
        }
      } catch (error) {
        console.error('❌ Message send error:', error);
        Alert.alert('Send Failed', 'Failed to send message. Please try again.');
      }
    } else {
      console.log('🚫 Message not sent - image was blocked or failed to upload');
      // Clean up UI state
      if (mounted.current) {
        setText('');
        setImageUri(null);
        setImageFile(null);
        setDuplicateWarning('');
      }
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
    
    const isBlocked = duplicateModalData.totalCount >= 3;  // Changed from >= 2
    const isWarning = duplicateModalData.totalCount === 2;  // Changed from === 1
    
    // Calculate timing information
    const firstUpload = duplicateModalData.allUploads?.[0];
    const lastUpload = duplicateModalData.allUploads?.[duplicateModalData.allUploads.length - 1];
    const timeSinceFirstUpload = firstUpload ? new Date().getTime() - firstUpload.timestamp : 0;
    const timeSinceLastUpload = lastUpload ? new Date().getTime() - lastUpload.timestamp : 0;
    
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
                      {index === duplicateModalData.allUploads.length - 1 && (
                        <Text style={styles.timeAgo}> ({formatTimeAgo(timeSinceLastUpload)})</Text>
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
        
        <TouchableOpacity
          style={[
            styles.sendButton,
            uploading && styles.disabledButton,
            duplicateModalData?.totalCount >= 3 && imageUri && styles.blockedButton
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
            {duplicateModalData && (
              <View style={styles.uploadCountContainer}>
                <Text style={[
                  styles.uploadCount,
                  duplicateModalData.totalCount >= 3 && styles.uploadCountBlocked
                ]}>
                  {duplicateModalData.totalCount}/3 uploads
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity style={styles.removeImageButton} onPress={removeImage}>
            <Ionicons name="close-circle" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      )}

      {duplicateWarning ? (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>{duplicateWarning}</Text>
        </View>
      ) : null}

      {renderDuplicateModal()}
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
  blockedButton: {
    backgroundColor: '#e53e3e',
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
  uploadCountContainer: {
    marginTop: 4,
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
  warningContainer: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  warningText: {
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
  timeAgo: {
    color: '#666',
    fontSize: 11,
    marginLeft: 4,
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