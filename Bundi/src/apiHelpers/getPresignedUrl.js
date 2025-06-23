import { awsConfig } from '../utils/aws';

// Use environment variables for API configuration
const WORKING_API_URL = process.env.EXPO_PUBLIC_WORKING_API_URL || 'YOUR_WORKING_API_URL';
const WORKING_API_KEY = process.env.EXPO_PUBLIC_WORKING_API_KEY || 'YOUR_WORKING_API_KEY';

// Bundi Presign API (currently has authentication issues)
const BUNDI_PRESIGN_URL = process.env.EXPO_PUBLIC_BUNDI_PRESIGN_URL || 'YOUR_BUNDI_PRESIGN_URL';
const BUNDI_API_KEY = process.env.EXPO_PUBLIC_BUNDI_API_KEY || 'YOUR_BUNDI_API_KEY';

export async function getPresignedUrl(filename, contentType = 'image/jpeg', method = 'post') {
  try {
    console.log('🔗 [getPresignedUrl] Getting presigned URL from working API for:', { filename, contentType, method });
    console.log('🔗 [getPresignedUrl] Using working API:', WORKING_API_URL);
    
    // Use the working upload API temporarily
    const res = await fetch(WORKING_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': WORKING_API_KEY
      },
      body: JSON.stringify({ 
        filename, 
        contentType, 
        method,
        uploadMethod: 'presigned-url',
        imageHash: `presign_${Date.now()}_${Math.random().toString(36).substring(7)}`
      }),
    });
    
    console.log('🔗 [getPresignedUrl] Response received:', {
      status: res.status,
      ok: res.ok,
      statusText: res.statusText
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ [getPresignedUrl] Failed to get presigned URL:', res.status, errorText);
      throw new Error(`presign failed: ${res.status} ${errorText}`);
    }
    
    const result = await res.json();
    
    // Handle the response format from the working API
    const response = {
      method: method,
      uploadUrl: result.presignedUrl,
      uploadFields: result.uploadFields || {},
      s3Key: result.s3Key
    };
    
    console.log('✅ [getPresignedUrl] Presigned URL result from working API:', {
      method: response.method,
      hasUploadUrl: !!response.uploadUrl,
      hasUploadFields: !!response.uploadFields,
      s3Key: response.s3Key
    });

    return response;
  } catch (error) {
    console.error('❌ [getPresignedUrl] Error details:', {
      message: error.message,
      stack: error.stack,
      url: WORKING_API_URL
    });
    throw error;
  }
} 