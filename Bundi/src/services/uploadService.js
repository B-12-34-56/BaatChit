// Upload Service - Sends single JSON payload to API
import { awsConfig } from '../utils/aws';
import axios from 'axios';

// Use environment variable with fallback
const API_URL = 'https://71yegno641.execute-api.us-east-1.amazonaws.com/Deployment/check-duplicate';
const API_KEY = 'UGnuPquBcp8GZHhRzg3Rs6CR9TXcap5zmF9edDh0';

// Debug configuration
console.log('🔧 [uploadService] Configuration:', {
  apiUrl: API_URL,
  hasApiKey: !!API_KEY,
  bucket: awsConfig.s3.bucketName,
  region: awsConfig.region
});

/**
 * Upload image with single JSON payload
 * @param {Object} params - Upload parameters
 * @param {string} params.image - Base64 encoded image data
 * @param {string} params.filename - Name of the file
 * @param {string} params.fileHash - Hash of the image for duplicate detection
 * @param {string} params.contentType - MIME type of the image
 * @param {string} params.userId - ID of the user uploading
 * @returns {Promise<Object>} - Upload result
 */
export const uploadImage = async ({ image, filename, fileHash, contentType, userId }) => {
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

    console.log('📤 [uploadService] Starting upload...', {
      filename,
      fileHash: fileHash?.substring(0, 12) + '...',
      contentType: finalContentType,
      userId
    });

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({ 
        imageData: image,  // Use 'imageData' as expected by checkDuplicate Lambda
        filename: filename,  // Use 'filename' as expected by checkDuplicate Lambda
        fileHash: fileHash,  // Use 'fileHash' as expected by checkDuplicate Lambda
        contentType: finalContentType, 
        userId: userId 
      }),
    });

    console.log('📥 [uploadService] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [uploadService] HTTP error:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    console.log('📥 [uploadService] Response parsed:', {
      success: result.success,
      hasImageUrl: !!result.imageUrl,
      blocked: result.blocked,
      totalCount: result.totalCount
    });
    
    // Warn if required fields are missing
    if (typeof result.success === 'undefined' || typeof result.imageUrl === 'undefined') {
      console.warn('⚠️ [uploadService] Response missing required fields:', result);
    }
    
    return result;
  } catch (error) {
    console.error('❌ [uploadService] Error:', error);
    throw error;
  }
};

/**
 * Check if upload service is available
 */
export const isUploadServiceAvailable = () => {
  return !!API_URL;
};

/**
 * Get upload service configuration
 */
export const getUploadServiceConfig = () => ({
  apiUrl: API_URL,
  apiKey: API_KEY ? 'configured' : 'missing',
  available: isUploadServiceAvailable(),
  bucket: awsConfig.s3.bucketName,
  region: awsConfig.region
}); 