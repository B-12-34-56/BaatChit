import Constants from 'expo-constants';
import { getPresignedUrl as getPresignedUrlFromHelper } from '../apiHelpers/getPresignedUrl';

/**
 * Gets a presigned URL for S3 upload
 * @param {string} filename - The filename to get a presigned URL for
 * @param {string} contentType - The content type of the file
 * @param {string} apiUrl - The API URL to use for getting the presigned URL (optional, uses default from awsConfig)
 * @returns {Promise<{method: string, uploadUrl: string, uploadFields: object, s3Key: string}>} The presigned URL response
 */
export const getPresignedUrl = async (filename, contentType, apiUrl) => {
  try {
    console.log('🔗 [presignService] Getting presigned URL for:', { filename, contentType });
    
    // Use the standardized implementation
    const result = await getPresignedUrlFromHelper(filename, contentType, 'post');
    
    console.log('✅ [presignService] Presigned URL received:', {
      method: result.method,
      hasUploadUrl: !!result.uploadUrl,
      s3Key: result.s3Key
    });
    
    return result;
  } catch (error) {
    console.error('❌ [presignService] Error getting presigned URL:', error);
    throw error;
  }
};

/**
 * Uploads a file to S3 using a presigned URL (POST method - recommended)
 * @param {string} presignedUrl - The presigned URL to upload to
 * @param {Object} file - The file object (in RN this could be from ImagePicker or DocumentPicker)
 * @param {string} file.uri - The local URI of the file
 * @param {string} file.type - The MIME type of the file
 * @returns {Promise<string>} The S3 URL (without query params) if successful
 */
export const uploadFileToS3 = async (presignedUrl, file) => {
  try {
    console.log('📤 [presignService] Uploading file to S3 using POST method...');
    
    // Create FormData for POST upload
    const form = new FormData();
    
    // Add the file as a blob
    const fileBlob = await (await fetch(file.uri)).blob();
    form.append('file', fileBlob);

    const response = await fetch(presignedUrl, {
      method: 'POST',
      body: form,
    });
    
    if (!response.ok) {
      let text = '';
      try { 
        text = await response.text(); 
      } catch (_) {
        // Ignore error when reading response text
      }
      throw new Error(`S3 upload failed (status ${response.status}): ${text}`);
    }
    
    // Remove query params to get the S3 object URL
    const url = presignedUrl.split('?')[0];
    console.log('✅ [presignService] File uploaded successfully:', url.substring(0, 50) + '...');
    return url;
  } catch (err) {
    console.error('❌ [presignService] Error uploading file to S3:', err);
    throw err;
  }
};

/**
 * Alternative upload method for React Native using FormData (useful for some file types)
 * @param {string} presignedUrl - The presigned URL to upload to
 * @param {Object} file - File object with uri, type, and optionally name
 * @returns {Promise<string>} The S3 URL if successful
 */
export const uploadFileToS3WithFormData = async (presignedUrl, file) => {
  // Validate input parameters
  if (!presignedUrl || typeof presignedUrl !== 'string') {
    throw new Error('Invalid presigned URL provided');
  }
  if (!file || typeof file !== 'object') {
    throw new Error('Invalid file object provided');
  }
  if (!file.uri || typeof file.uri !== 'string') {
    throw new Error('Invalid file URI provided');
  }

  try {
    console.log('📤 [presignService] Uploading file with FormData...');
    
    const formData = new FormData();
    
    // Validate file properties before appending
    const fileData = {
      uri: file.uri,
      type: file.type || 'application/octet-stream',
      name: file.name || 'upload',
    };

    // Additional validation for file data
    if (!fileData.uri || typeof fileData.uri !== 'string') {
      throw new Error('Invalid file URI in FormData');
    }
    if (!fileData.type || typeof fileData.type !== 'string') {
      throw new Error('Invalid file type in FormData');
    }
    if (!fileData.name || typeof fileData.name !== 'string') {
      throw new Error('Invalid file name in FormData');
    }

    formData.append('file', fileData);

    const response = await fetch(presignedUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      let text = '';
      try { 
        text = await response.text(); 
      } catch (_) {
        // Ignore error when reading response text
      }
      throw new Error(`S3 upload failed (status ${response.status}): ${text}`);
    }

    // Remove query params to get the S3 object URL
    const url = presignedUrl.split('?')[0];
    console.log('✅ [presignService] File uploaded successfully with FormData:', url.substring(0, 50) + '...');
    return url;
  } catch (err) {
    console.error('❌ [presignService] Error uploading file to S3 with FormData:', err);
    throw err;
  }
};