import { getPresignedUrl, uploadFileToS3 } from './presignService';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';

/**
 * Upload service using presigned URLs to avoid AWS credential issues
 */
export class PresignUploadService {
  constructor(presignApiUrl) {
    this.presignApiUrl = presignApiUrl || 'http://localhost:4000/presign';
  }

  /**
   * Generate a file hash for duplicate detection
   * @param {string} fileUri - The URI of the file to hash
   * @returns {Promise<string>} - The SHA-256 hash of the file
   */
  async generateFileHash(fileUri) {
    try {
      console.log('🔍 [PresignUploadService] Generating hash for:', fileUri.substring(0, 50) + '...');
      
      // Read file as base64 for hashing
      const base64Data = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Generate SHA-256 hash
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        base64Data
      );
      
      console.log('✅ [PresignUploadService] Hash generated:', hash.substring(0, 12) + '...');
      return hash;
    } catch (error) {
      console.error('❌ [PresignUploadService] Error generating hash:', error);
      throw new Error('Failed to generate file hash');
    }
  }

  /**
   * Upload image using presigned URL approach
   */
  async uploadImage(imageFile, userId) {
    try {
      console.log('🔄 [PresignUploadService] Starting presigned upload...', {
        fileName: imageFile.fileName,
        type: imageFile.type,
        userId
      });

      // Generate unique filename
      const timestamp = Date.now();
      const fileExtension = imageFile.type === 'image/png' ? 'png' : 'jpg';
      const filename = `image_${timestamp}_${userId}_${Math.random().toString(36).substring(7)}.${fileExtension}`;

      console.log('📝 [PresignUploadService] Generated filename:', filename);

      // Get presigned URL using the new standardized implementation
      const { method, uploadUrl, uploadFields, s3Key } = await getPresignedUrl(filename, imageFile.type);
      
      console.log('🔑 [PresignUploadService] Got presigned URL:', {
        method,
        hasUploadUrl: !!uploadUrl,
        s3Key
      });

      // Upload file using presigned URL
      const s3Url = await uploadFileToS3(uploadUrl, imageFile);

      console.log('✅ [PresignUploadService] Upload successful:', s3Url.substring(0, 50) + '...');

      return {
        downloadURL: s3Url,
        fileHash: await this.generateFileHash(imageFile.uri),
        success: true,
        filename,
        s3Key
      };
    } catch (error) {
      console.error('❌ [PresignUploadService] Upload failed:', error);
      throw error;
    }
  }

  /**
   * Check if presign server is available
   */
  async checkServerHealth() {
    try {
      const response = await fetch(this.presignApiUrl.replace('/presign', '/health'));
      return response.ok;
    } catch (error) {
      console.warn('Presign server health check failed:', error);
      return false;
    }
  }
}

// Default instance
export const presignUploadService = new PresignUploadService(); 