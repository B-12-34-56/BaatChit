// ENV VARS NEEDED:
// AWS_REGION, AWS_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// UPLOAD_IMAGE_API_URL, UPLOAD_IMAGE_API_KEY
// CONFIRM_UPLOAD_API_URL, CONFIRM_UPLOAD_API_KEY
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';

const getEnv = (key, fallback = '') =>
  process.env[key] || Constants.expoConfig?.extra?.[key] || fallback;

// API Configuration - Use environment variables
const apiConfig = {
  uploadImageUrl: getEnv('UPLOAD_IMAGE_API_URL', 'YOUR_UPLOAD_IMAGE_API_URL'),
  uploadImageKey: getEnv('UPLOAD_IMAGE_API_KEY', 'YOUR_UPLOAD_IMAGE_API_KEY'),
  confirmUploadUrl: getEnv('CONFIRM_UPLOAD_API_URL', 'YOUR_CONFIRM_UPLOAD_API_URL'),
  confirmUploadKey: getEnv('CONFIRM_UPLOAD_API_KEY', 'YOUR_CONFIRM_UPLOAD_API_KEY'),
};

/**
 * Generate a file hash for duplicate detection
 * @param {string} fileUri - The URI of the file to hash
 * @returns {Promise<string>} - The SHA-256 hash of the file
 */
export const generateFileHash = async (fileUri) => {
  try {
    console.log('🔍 [generateFileHash] Generating hash for:', fileUri.substring(0, 50) + '...');
    
    // Read file as base64 for hashing
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Generate SHA-256 hash
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Data
    );
    
    console.log('✅ [generateFileHash] Hash generated:', hash.substring(0, 12) + '...');
    return hash;
  } catch (error) {
    console.error('❌ [generateFileHash] Error generating hash:', error);
    throw new Error('Failed to generate file hash');
  }
};

/**
 * Get a presigned URL for direct S3 upload
 * @param {string} fileHash - The hash of the file
 * @param {string} fileName - The name of the file
 * @param {string} contentType - The MIME type of the file
 * @param {string} userId - The ID of the user uploading
 * @returns {Promise<{presignedUrl: string, s3Key: string}>} - The presigned URL and S3 key
 */
export const getPresignedUploadUrl = async (fileHash, fileName, contentType, userId) => {
  try {
    console.log('🔍 [getPresignedUploadUrl] Requesting presigned URL for:', {
      fileHash: fileHash.substring(0, 12) + '...',
      fileName,
      contentType,
      userId
    });
    
    const response = await fetch(apiConfig.uploadImageUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiConfig.uploadImageKey,
      },
      body: JSON.stringify({
        fileHash,
        fileName,
        contentType,
        userId,
        uploadMethod: 'presigned-url', // Indicate this is a presigned URL request
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [getPresignedUploadUrl] API error:', response.status, errorText);
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [getPresignedUploadUrl] Presigned URL received:', {
      s3Key: result.s3Key,
      presignedUrl: result.presignedUrl.substring(0, 50) + '...'
    });
    
    return {
      presignedUrl: result.presignedUrl,
      s3Key: result.s3Key,
    };
  } catch (error) {
    console.error('❌ [getPresignedUploadUrl] Error:', error);
    throw error;
  }
};

/**
 * Upload file directly to S3 using presigned URL
 * @param {string} presignedUrl - The presigned URL from S3
 * @param {string} fileUri - The local file URI
 * @param {string} contentType - The MIME type of the file
 * @returns {Promise<string>} - The S3 URL of the uploaded file
 */
export const uploadFileToS3 = async (presignedUrl, fileUri, contentType) => {
  try {
    console.log('📤 [uploadFileToS3] Uploading file to S3...');
    
    // Read file as base64
    const base64Data = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    
    // Convert base64 to binary data
    const binaryData = Buffer.from(base64Data, 'base64');
    
    // Upload to S3 using presigned URL
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Content-Length': binaryData.length.toString(),
      },
      body: binaryData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [uploadFileToS3] S3 upload failed:', response.status, errorText);
      throw new Error(`S3 upload failed: ${response.status} ${errorText}`);
    }
    
    // Extract S3 URL from presigned URL
    const s3Url = presignedUrl.split('?')[0];
    console.log('✅ [uploadFileToS3] File uploaded successfully:', s3Url.substring(0, 50) + '...');
    
    return s3Url;
  } catch (error) {
    console.error('❌ [uploadFileToS3] Error:', error);
    throw error;
  }
};

/**
 * Confirm upload completion with the backend
 * @param {string} fileHash - The hash of the uploaded file
 * @param {string} s3Key - The S3 key of the uploaded file
 * @param {string} userId - The ID of the user who uploaded
 * @param {string} fileName - The name of the uploaded file
 * @returns {Promise<{success: boolean, imageUrl: string, uploadCount: number}>} - Upload confirmation result
 */
export const confirmUpload = async (fileHash, s3Key, userId, fileName) => {
  try {
    console.log('✅ [confirmUpload] Confirming upload completion...', {
      fileHash: fileHash.substring(0, 12) + '...',
      s3Key,
      userId
    });
    
    const response = await fetch(apiConfig.confirmUploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiConfig.confirmUploadKey,
      },
      body: JSON.stringify({
        fileHash,
        s3Key,
        userId,
        fileName,
        uploadTimestamp: Date.now(),
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [confirmUpload] API error:', response.status, errorText);
      throw new Error(`Confirmation failed: ${response.status} ${errorText}`);
    }
    
    const result = await response.json();
    console.log('✅ [confirmUpload] Upload confirmed:', {
      success: result.success,
      uploadCount: result.uploadCount,
      imageUrl: result.imageUrl?.substring(0, 50) + '...'
    });
    
    return {
      success: result.success,
      imageUrl: result.imageUrl,
      uploadCount: result.uploadCount || 0,
      blocked: result.blocked || false,
      warning: result.warning || false,
    };
  } catch (error) {
    console.error('❌ [confirmUpload] Error:', error);
    throw error;
  }
};

/**
 * Complete presigned URL upload flow
 * @param {string} fileUri - The local file URI
 * @param {string} userId - The ID of the user uploading
 * @param {Object} fileInfo - Additional file information
 * @returns {Promise<{success: boolean, imageUrl: string, fileHash: string, uploadCount: number, blocked: boolean, warning: boolean}>} - Upload result
 */
export const uploadImageWithPresignedUrl = async (fileUri, userId, fileInfo = {}) => {
  try {
    console.log('🚀 [uploadImageWithPresignedUrl] Starting presigned URL upload flow...');
    
    // Step 1: Generate file hash
    const fileHash = await generateFileHash(fileUri);
    
    // Step 2: Get file info
    const fileDetails = await FileSystem.getInfoAsync(fileUri);
    const fileName = fileInfo.fileName || `image_${Date.now()}_${fileHash.substring(0, 8)}.jpg`;
    const contentType = fileInfo.contentType || 'image/jpeg';
    
    console.log('📁 [uploadImageWithPresignedUrl] File details:', {
      fileName,
      contentType,
      size: fileDetails.size,
      fileHash: fileHash.substring(0, 12) + '...'
    });
    
    // Step 3: Get presigned URL
    const { presignedUrl, s3Key } = await getPresignedUploadUrl(fileHash, fileName, contentType, userId);
    
    // Step 4: Upload file to S3
    const s3Url = await uploadFileToS3(presignedUrl, fileUri, contentType);
    
    // Step 5: Confirm upload with backend
    const confirmation = await confirmUpload(fileHash, s3Key, userId, fileName);
    
    console.log('🎉 [uploadImageWithPresignedUrl] Upload completed successfully!');
    
    return {
      success: true,
      imageUrl: s3Url,
      fileHash,
      uploadCount: confirmation.uploadCount,
      blocked: confirmation.blocked,
      warning: confirmation.warning,
      s3Key,
    };
    
  } catch (error) {
    console.error('❌ [uploadImageWithPresignedUrl] Upload failed:', error);
    return {
      success: false,
      imageUrl: null,
      fileHash: null,
      uploadCount: 0,
      blocked: false,
      warning: false,
      error: error.message,
    };
  }
};

/**
 * Check if presigned URL upload is available
 * @returns {boolean} - Whether presigned URL upload is configured
 */
export const isPresignedUploadAvailable = () => {
  return !!(apiConfig.uploadImageUrl && apiConfig.confirmUploadUrl);
};

// Export configuration for debugging
export const getPresignedUploadConfig = () => ({
  uploadImageUrl: apiConfig.uploadImageUrl,
  confirmUploadUrl: apiConfig.confirmUploadUrl,
  hasUploadKey: !!apiConfig.uploadImageKey,
  hasConfirmKey: !!apiConfig.confirmUploadKey,
  isAvailable: isPresignedUploadAvailable(),
}); 