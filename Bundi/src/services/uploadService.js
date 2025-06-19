// Upload Service - Sends single JSON payload to API
import Constants from 'expo-constants';

// Get API URL from environment
const API_URL = process.env.EXPO_PUBLIC_UPLOAD_API_URL || 
                Constants.expoConfig?.extra?.uploadApiUrl || 
                '';

/**
 * Upload image with single JSON payload
 * @param {Object} params - Upload parameters
 * @param {string} params.image - Base64 encoded image data
 * @param {string} params.filename - Name of the file
 * @param {string} params.imageHash - Hash of the image for duplicate detection
 * @param {string} params.contentType - MIME type of the image
 * @param {string} params.userId - ID of the user uploading
 * @returns {Promise<Object>} - Upload result
 */
export const uploadImage = async ({ image, filename, imageHash, contentType, userId }) => {
  try {
    console.log('📤 [uploadService] Starting upload...', {
      filename,
      imageHash: imageHash?.substring(0, 12) + '...',
      contentType,
      userId
    });

    const payload = { image, filename, imageHash, contentType, userId };
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [uploadService] Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ [uploadService] Upload successful:', {
      success: result.success,
      imageUrl: result.imageUrl?.substring(0, 50) + '...'
    });

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
  available: isUploadServiceAvailable(),
}); 