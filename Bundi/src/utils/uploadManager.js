import 'react-native-get-random-values';

// Upload Manager - Handles both base64 and presigned URL upload methods
// Automatically chooses the best method based on availability and performance
import { uploadImageToS3, apiHelpers } from './aws';
import { uploadImageWithPresignedUrl, isPresignedUploadAvailable } from '../services/presignedUploadService';

/**
 * Upload manager that automatically chooses the best upload method
 */
export class UploadManager {
  constructor() {
    this.presignedAvailable = isPresignedUploadAvailable();
    this.uploadMethod = this.presignedAvailable ? 'presigned-url' : 'base64';
    
    console.log('🚀 [UploadManager] Initialized with method:', this.uploadMethod);
  }

  /**
   * Upload image using the best available method
   * @param {string} fileUri - The local file URI
   * @param {string} userId - The ID of the user uploading
   * @param {Object} fileInfo - Additional file information
   * @returns {Promise<Object>} - Upload result
   */
  async uploadImage(fileUri, userId, fileInfo = {}) {
    try {
      console.log('📤 [UploadManager] Starting upload with method:', this.uploadMethod);
      
      if (this.uploadMethod === 'presigned-url') {
        return await this.uploadWithPresignedUrl(fileUri, userId, fileInfo);
      } else {
        return await this.uploadWithBase64(fileUri, userId, fileInfo);
      }
    } catch (error) {
      console.error('❌ [UploadManager] Upload failed:', error);
      
      // Fallback to base64 if presigned URL fails
      if (this.uploadMethod === 'presigned-url') {
        console.log('🔄 [UploadManager] Falling back to base64 upload...');
        this.uploadMethod = 'base64';
        return await this.uploadWithBase64(fileUri, userId, fileInfo);
      }
      
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
  }

  /**
   * Upload using presigned URL method (faster, more efficient)
   */
  async uploadWithPresignedUrl(fileUri, userId, fileInfo) {
    console.log('⚡ [UploadManager] Using presigned URL upload method');
    return await uploadImageWithPresignedUrl(fileUri, userId, fileInfo);
  }

  /**
   * Upload using base64 method (legacy, slower but more reliable)
   */
  async uploadWithBase64(fileUri, userId, fileInfo) {
    console.log('📄 [UploadManager] Using base64 upload method');
    
    try {
      // Generate file hash for duplicate checking
      const { generateFileHash } = await import('../services/presignedUploadService');
      const fileHash = await generateFileHash(fileUri);
      
      // Check upload count
      const count = await apiHelpers.getImageUploadCount(fileHash);
      if (count >= 3) {
        return {
          success: false,
          imageUrl: null,
          fileHash: fileHash,
          uploadCount: count,
          blocked: true,
          warning: false,
          error: `Upload blocked: This image has been uploaded ${count} times. Maximum allowed: 3 per unique image.`,
        };
      }
      
      // Upload to S3
      const imageUrl = await uploadImageToS3(fileUri, userId, fileHash, fileInfo);
      
      // Increment upload count
      await apiHelpers.incrementImageUploadCount(fileHash, userId, fileInfo.fileName || 'image.jpg');
      
      // Re-check count after increment
      const newCount = await apiHelpers.getImageUploadCount(fileHash);
      const isWarning = newCount === 2;
      
      return {
        success: true,
        imageUrl: imageUrl,
        fileHash: fileHash,
        uploadCount: newCount,
        blocked: false,
        warning: isWarning,
        error: null,
      };
      
    } catch (error) {
      console.error('❌ [UploadManager] Base64 upload failed:', error);
      throw error;
    }
  }

  /**
   * Get current upload method
   */
  getUploadMethod() {
    return this.uploadMethod;
  }

  /**
   * Check if presigned URL upload is available
   */
  isPresignedAvailable() {
    return this.presignedAvailable;
  }

  /**
   * Force a specific upload method
   */
  setUploadMethod(method) {
    if (method === 'presigned-url' && !this.presignedAvailable) {
      console.warn('⚠️ [UploadManager] Presigned URL upload not available, falling back to base64');
      this.uploadMethod = 'base64';
    } else {
      this.uploadMethod = method;
    }
    console.log('🔄 [UploadManager] Upload method set to:', this.uploadMethod);
  }

  /**
   * Get upload statistics and configuration
   */
  getStats() {
    return {
      uploadMethod: this.uploadMethod,
      presignedAvailable: this.presignedAvailable,
      recommendedMethod: this.presignedAvailable ? 'presigned-url' : 'base64',
    };
  }
}

// Create a singleton instance
export const uploadManager = new UploadManager();

/**
 * Convenience function for quick uploads
 */
export const uploadImage = async (fileUri, userId, fileInfo = {}) => {
  return await uploadManager.uploadImage(fileUri, userId, fileInfo);
};

/**
 * Upload with specific method
 */
export const uploadImageWithMethod = async (fileUri, userId, fileInfo = {}, method = 'auto') => {
  if (method === 'auto') {
    return await uploadManager.uploadImage(fileUri, userId, fileInfo);
  } else {
    const tempManager = new UploadManager();
    tempManager.setUploadMethod(method);
    return await tempManager.uploadImage(fileUri, userId, fileInfo);
  }
}; 