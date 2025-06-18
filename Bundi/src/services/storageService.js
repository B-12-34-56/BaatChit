// ENV VARS NEEDED:
// AWS_REGION, AWS_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// S3_IMAGES_PATH, S3_BASE_URL
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { uploadImageToS3, generateS3Url } from '../utils/aws';

const getEnv = (key, fallback = '') =>
  process.env[key] || Constants.expoConfig?.extra?.[key] || fallback;

export const uploadAvatarToFirebase = async (fileUri, userId) => {
  try {
    // Generate a simple hash for avatar (since we don't need duplicate checking for avatars)
    const timestamp = Date.now();
    const simpleHash = `avatar_${timestamp}_${userId}`;
    
    // Use AWS S3 upload helper
    const s3Url = await uploadImageToS3(fileUri, userId, simpleHash, {
      type: 'image/jpeg',
      fileName: `avatar_${userId}_${timestamp}.jpg`
    });
    
    return s3Url;
  } catch (error) {
    console.error('Error uploading avatar to S3:', error);
    throw error;
  }
};

export const uploadImageToFirebase = async (fileUri, folder = 'images') => {
  try {
    // Generate a simple hash for general images
    const timestamp = Date.now();
    const simpleHash = `image_${timestamp}_${Math.random().toString(36).substring(7)}`;
    
    // Use AWS S3 upload helper with a generic user ID for general uploads
    const s3Url = await uploadImageToS3(fileUri, 'general', simpleHash, {
      type: 'image/jpeg',
      fileName: `${folder}/${timestamp}_${Math.random().toString(36).substring(7)}.jpg`
    });
    
    return s3Url;
  } catch (error) {
    console.error('Error uploading image to S3:', error);
    throw error;
  }
};

// Add a new function for user content uploads (used by MessageInput)
export const uploadUserContent = async (imageFile, userId) => {
  try {
    // Generate file hash for duplicate checking
    const timestamp = Date.now();
    const fileHash = `user_${userId}_${timestamp}_${Math.random().toString(36).substring(7)}`;
    
    // Use AWS S3 upload helper
    const s3Url = await uploadImageToS3(imageFile.uri, userId, fileHash, imageFile);
    
    return {
      downloadURL: s3Url,
      fileHash: fileHash,
      success: true
    };
  } catch (error) {
    console.error('Error uploading user content to S3:', error);
    throw error;
  }
}; 