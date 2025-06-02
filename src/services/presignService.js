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