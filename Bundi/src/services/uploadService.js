// Upload Service - Sends single JSON payload to API
import { awsConfig } from '../utils/aws';

// Get API URL from centralized AWS config
const API_URL = awsConfig.apiGateway.upload.url;
const API_KEY = awsConfig.apiGateway.upload.apiKey;

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
    console.log('📤 [uploadService] Starting upload...', {
      filename,
      fileHash: fileHash?.substring(0, 12) + '...',
      contentType,
      userId,
      apiUrl: API_URL ? 'configured' : 'missing'
    });

    // Check if API URL is configured
    if (!API_URL) {
      throw new Error('Upload API URL not configured in AWS config');
    }

    // Send the correct payload structure
    const payload = { 
      image, 
      filename, 
      fileHash, 
      imageHash: fileHash,
      contentType: contentType === 'image' ? 'image/png' : contentType, 
      userId 
    };
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [uploadService] Upload failed:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    // Handle cases where the lambda returns an error in a 200 OK response
    if (result.body && typeof result.body === 'string') {
      try {
        const parsedBody = JSON.parse(result.body);
        if (parsedBody.error) {
          throw new Error(`Lambda returned error: ${parsedBody.error}`);
        }
      } catch (e) {
        // Not a JSON error body, proceed
      }
    }
    
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
  apiKey: API_KEY ? 'configured' : 'missing',
  available: isUploadServiceAvailable(),
  bucket: awsConfig.s3.bucketName,
  region: awsConfig.region
}); 