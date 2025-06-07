import Constants from 'expo-constants';

/**
 * Gets a presigned URL for S3 upload
 * @param {string} filename - The filename to get a presigned URL for
 * @param {string} contentType - The content type of the file
 * @param {string} apiUrl - The API URL to use for getting the presigned URL
 * @returns {Promise<string>} The presigned URL
 */
export const getPresignedUrl = async (filename, contentType, apiUrl) => {
  // In React Native, get API URL from expo config if not provided
  apiUrl = apiUrl || Constants.expoConfig?.extra?.presignApiUrl || Constants.manifest?.extra?.presignApiUrl;
  
  if (!apiUrl) {
    throw new Error("Presign API URL not set in app configuration.");
  }
  
  let urlWithQuery = `${apiUrl}?filename=${encodeURIComponent(filename)}`;
  if (contentType) {
    urlWithQuery += `&contentType=${encodeURIComponent(contentType)}`;
  }
  
  try {
    const response = await fetch(urlWithQuery, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const data = await response.json();
    if (data && data.presignedUrl) {
      return data.presignedUrl;
    }
    
    throw new Error("Failed to get presigned URL from response");
  } catch (error) {
    console.error("Error getting presigned URL:", error);
    throw new Error(error instanceof Error ? error.message : "Failed to get presigned URL");
  }
};

/**
 * Uploads a file to S3 using a presigned URL
 * @param {string} presignedUrl - The presigned URL to upload to
 * @param {Object} file - The file object (in RN this could be from ImagePicker or DocumentPicker)
 * @param {string} file.uri - The local URI of the file
 * @param {string} file.type - The MIME type of the file
 * @returns {Promise<string>} The S3 URL (without query params) if successful
 */
export const uploadFileToS3 = async (presignedUrl, file) => {
  try {
    // In React Native, we need to create a FormData or use the file URI directly
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 
        'Content-Type': file.type || 'application/octet-stream'
      },
      body: file.uri ? 
        // If it's a React Native file object with URI
        await fetch(file.uri).then(res => res.blob()) :
        // If it's already a blob/file object
        file,
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
    return url;
  } catch (err) {
    console.error('Error uploading file to S3:', err);
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
      method: 'PUT',
      body: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
    return url;
  } catch (err) {
    console.error('Error uploading file to S3 with FormData:', err);
    throw err;
  }
};