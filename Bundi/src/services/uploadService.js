// Upload Service - Direct S3 uploads with presigned URLs
import { awsConfig } from '../utils/aws';
import * as FileSystem from 'expo-file-system';
import { getPresignedUrl } from '../apiHelpers/getPresignedUrl';

// Use environment variables for API configuration
const CHECK_DUPLICATE_URL = process.env.EXPO_PUBLIC_CHECK_DUPLICATE_URL || 'YOUR_CHECK_DUPLICATE_URL';
const CHECK_DUPLICATE_KEY = process.env.EXPO_PUBLIC_CHECK_DUPLICATE_API_KEY || 'YOUR_CHECK_DUPLICATE_API_KEY';

// Debug configuration
console.log('🔧 [uploadService] Configuration:', {
  checkDuplicateUrl: CHECK_DUPLICATE_URL,
  hasCheckDuplicateKey: !!CHECK_DUPLICATE_KEY,
  bucket: awsConfig.s3.bucketName,
  region: awsConfig.region,
  presignUrl: awsConfig.presignUrl
});

const MAX_DIRECT_BYTES = 4.5 * 1024 * 1024;   // 4.5 MB raw ≈ 6 MB b64
const MAX_GATEWAY_BYTES = 10 * 1024 * 1024; // 10 MB

async function shouldUsePresigned(uri) {
  const { size } = await FileSystem.getInfoAsync(uri, { size: true });
  return size > MAX_DIRECT_BYTES;
}

async function s3ObjectExists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch (e) {
    return false;
  }
}

async function waitForS3(url, attempts = 3, delayMs = 600) {
  const start = Date.now();
  console.log(`[waitForS3] Waiting for S3 object: ${url} (attempts: ${attempts}, delay: ${delayMs}ms)`);
  for (let i = 0; i < attempts; i++) {
    if (await s3ObjectExists(url)) {
      const elapsed = Date.now() - start;
      console.log(`[waitForS3] S3 object found after ${i + 1} attempt(s), waited ${elapsed}ms: ${url}`);
      return true;
    }
    await new Promise(r => setTimeout(r, delayMs));
  }
  const elapsed = Date.now() - start;
  console.warn(`[waitForS3] S3 object NOT found after ${attempts} attempts, waited ${elapsed}ms: ${url}`);
  return false;
}

// Helper function to upload via S3 presigned URL (POST method - recommended)
async function s3UploadViaForm(uploadUrl, fields, localUri) {
  try {
    console.log('📤 [s3UploadViaForm] Starting POST upload...');
    
    const form = new FormData();
    Object.entries(fields).forEach(([k, v]) => form.append(k, v));
    const fileBlob = await (await fetch(localUri)).blob();
    form.append('file', fileBlob);        // MUST be last

    const res = await fetch(uploadUrl, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`S3 POST failed: ${res.status}`);
    
    console.log('✅ [s3UploadViaForm] POST upload successful');
    return true;
  } catch (error) {
    console.error('❌ [s3UploadViaForm] Error:', error);
    throw error;
  }
}

// Check for duplicates first (without image data)
async function checkForDuplicates(fileHash, userId, fileName) {
  try {
    console.log('🔍 [uploadService] Checking for duplicates...');
    
    const response = await fetch(CHECK_DUPLICATE_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': CHECK_DUPLICATE_KEY
      },
      body: JSON.stringify({ 
        fileHash: fileHash,
        userId: userId,
        fileName: fileName
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [uploadService] Duplicate check failed:', response.status, errorText);
      throw new Error(`Duplicate check failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    console.log('🔍 [uploadService] Duplicate check result:', {
      success: result.success,
      blocked: result.blocked,
      totalCount: result.totalCount,
      uploadCount: result.uploadCount
    });
    
    return result;
  } catch (error) {
    console.error('❌ [uploadService] Duplicate check error:', error);
    throw error;
  }
}

// Upload directly to S3 using presigned URL
async function uploadToS3Directly(fileUri, filename, contentType, userId) {
  try {
    console.log('📤 [uploadService] Getting presigned URL for direct upload...');
    
    // Get presigned URL using the new helper with POST method
    const { method, uploadUrl, uploadFields, s3Key } = await getPresignedUrl(filename, contentType, 'post');
    
    // Validate presigned URL response
    if (!uploadUrl) {
      console.error('❌ [uploadService] Invalid presigned URL response:', { method, uploadUrl, uploadFields });
      throw new Error('Failed to get valid presigned URL from server');
    }
    
    console.log('📤 [uploadService] Uploading directly to S3 using presigned URL...');
    console.log('📤 [uploadService] Presigned URL details:', {
      method,
      hasUploadUrl: !!uploadUrl,
      hasUploadFields: !!uploadFields,
      s3Key
    });
    
    // Upload using the form data approach
    await s3UploadViaForm(uploadUrl, uploadFields, fileUri);
    
    // Generate the final image URL using the generated S3 key
    const imageUrl = `https://${awsConfig.s3.bucketName}.s3.${awsConfig.region}.amazonaws.com/${s3Key}`;
    
    console.log('✅ [uploadService] Direct S3 upload successful:', {
      imageUrl: imageUrl.substring(0, 50) + '...',
      key: s3Key
    });
    
    return {
      success: true,
      imageUrl: imageUrl,
      message: 'Upload successful'
    };
  } catch (error) {
    console.error('❌ [uploadService] Direct S3 upload error:', error);
    throw error;
  }
}

/**
 * Upload image with proper flow: check duplicates first, then upload directly to S3
 * @param {Object} params - Upload parameters
 * @param {string} params.fileUri - Local file URI
 * @param {string} params.filename - Name of the file
 * @param {string} params.fileHash - Hash of the image for duplicate detection
 * @param {string} params.contentType - MIME type of the image
 * @param {string} params.userId - ID of the user uploading
 * @returns {Promise<Object>} - Upload result
 */
export const uploadImage = async ({ fileUri, filename, fileHash, contentType, userId }) => {
  try {
    // Fix content type if it's just "image"
    let finalContentType = contentType;
    if (contentType === 'image') {
      if (filename.toLowerCase().endsWith('.png')) {
        finalContentType = 'image/png';
      } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
        finalContentType = 'image/jpeg';
      } else if (filename.toLowerCase().endsWith('.gif')) {
        finalContentType = 'image/gif';
      } else if (filename.toLowerCase().endsWith('.webp')) {
        finalContentType = 'image/webp';
      } else {
        finalContentType = 'image/jpeg';
      }
    }

    console.log('📤 [uploadService] Starting upload process...', {
      filename,
      fileHash: fileHash?.substring(0, 12) + '...',
      contentType: finalContentType,
      userId
    });

    // Step 1: Check for duplicates (without image data)
    const duplicateCheck = await checkForDuplicates(fileHash, userId, filename);
    
    if (duplicateCheck.blocked) {
      console.log('🚫 [uploadService] Upload blocked due to duplicates');
      return {
        success: false,
        blocked: true,
        totalCount: duplicateCheck.totalCount,
        uploadCount: duplicateCheck.uploadCount,
        imageUrl: null,
        message: duplicateCheck.message || 'Image blocked due to duplicates'
      };
    }

    // Step 2: Upload directly to S3
    const uploadResult = await uploadToS3Directly(fileUri, filename, finalContentType, userId);
    
    if (!uploadResult.success || !uploadResult.imageUrl) {
      throw new Error('S3 upload failed - no image URL returned');
    }

    console.log('✅ [uploadService] Upload completed successfully');
    
    return {
      success: true,
      blocked: false,
      totalCount: duplicateCheck.totalCount || 1,
      uploadCount: duplicateCheck.uploadCount || 1,
      imageUrl: uploadResult.imageUrl,
      message: 'Upload successful'
    };
    
  } catch (error) {
    console.error('❌ [uploadService] Upload process error:', error);
    throw error;
  }
};

/**
 * Check if upload service is available
 */
export const isUploadServiceAvailable = () => {
  return !!CHECK_DUPLICATE_URL;
};

/**
 * Get upload service configuration
 */
export const getUploadServiceConfig = () => ({
  checkDuplicateUrl: CHECK_DUPLICATE_URL,
  checkDuplicateKey: CHECK_DUPLICATE_KEY ? 'configured' : 'missing',
  available: isUploadServiceAvailable(),
  bucket: awsConfig.s3.bucketName,
  region: awsConfig.region
}); 