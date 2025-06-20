import { awsConfig } from '../utils/aws';

/**
 * Gets image tags from the API
 * @param {string} filename - The filename to check for tags
 * @returns {Promise<Object|null>} The tag response object or null if error
 */
export const getImageTag = async (filename) => {
  const apiUrl = awsConfig.apiGateway.getTag.url;
  const apiKey = awsConfig.apiGateway.getTag.apiKey;
  
  if (!apiUrl) {
    console.error('Get Tag API URL not configured in AWS config');
    return null;
  }
  
  const urlWithQuery = `${apiUrl}?filename=${encodeURIComponent(filename)}`;
  
  try {
    const response = await fetch(urlWithQuery, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-api-key': apiKey
      },
      body: '',
    });
    
    if (response.ok) {
      const data = await response.json();
      return data;
    } else {
      console.error('Get Tag request failed', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Error fetching image tag:', error);
  }
  
  return null;
};