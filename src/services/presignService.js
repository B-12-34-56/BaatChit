/**
 * Gets a presigned URL for S3 upload
 * @param {string} filename - The filename to get a presigned URL for
 * @param {string} contentType - The content type of the file
 * @param {string} apiUrl - The API URL to use for getting the presigned URL
 * @returns {Promise<string>} The presigned URL
 */
export const getPresignedUrl = async (filename, contentType, apiUrl) => {
  apiUrl = apiUrl || process.env.REACT_APP_PRESIGN_API_URL;
  if (!apiUrl) {
    throw new Error("Presign API URL not set in environment variables.");
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
 * @param {File} file - The file to upload
 * @returns {Promise<string>} The S3 URL (without query params) if successful
 */
export const uploadFileToS3 = async (presignedUrl, file) => {
  try {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!response.ok) {
      let text = '';
      try { text = await response.text(); } catch (_) {}
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