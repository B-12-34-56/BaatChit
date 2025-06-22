// src/utils/aws.js
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
if (typeof global.Buffer === 'undefined') global.Buffer = Buffer;

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { CognitoIdentityProviderClient, InitiateAuthCommand, SignUpCommand } from '@aws-sdk/client-cognito-identity-provider';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-provider-cognito-identity';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

// Centralized API client with retry logic
export const api = {
  baseURL: process.env.REACT_APP_LAMBDA_BASE_URL || 'https://np39lyhj20.execute-api.us-east-1.amazonaws.com/Deployment',
  checkDuplicateURL: process.env.CHECK_DUPLICATE_URL || 'https://71yegno641.execute-api.us-east-1.amazonaws.com/Deployment/check-duplicate',
  uploadImageURL: process.env.UPLOAD_IMAGE_URL || 'https://np39lyhj20.execute-api.us-east-1.amazonaws.com/Deployment/upload-image',
  uploadKey: process.env.UPLOAD_KEY || '',
  blockKey: process.env.BLOCK_KEY || '',
  checkDuplicateKey: process.env.CHECK_DUPLICATE_KEY || '',
  timeout: 15000,
  
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.uploadKey, // Default to upload key
        ...options.headers,
      },
      timeout: this.timeout,
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (response.status === 403) {
        throw new Error('Auth token missing – check API key or stage name');
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  },
  
  async checkDuplicate(payload) {
    try {
      const response = await fetch(this.checkDuplicateURL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.checkDuplicateKey
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Ensure all required fields have values
      return {
        success: result.success !== undefined ? result.success : false,
        blocked: result.blocked !== undefined ? result.blocked : false,
        totalCount: result.totalCount || 0,
        uploadCount: result.uploadCount || 0,
        imageUrl: result.imageUrl || null,
        perceptualHash: result.perceptualHash || null,
        similarImages: result.similarImages || [],
        message: result.message || 'No message from Lambda function'
      };
    } catch (error) {
      console.error(`API checkDuplicate failed:`, error);
      throw error;
    }
  }
};

// ─────────────────────────
//  AWS CONFIGURATION
// ─────────────────────────


const awsConfig = {
 accessKeyId: process.env.AWS_ACCESS_KEY_ID,
 secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
 sessionToken: process.env.AWS_SESSION_TOKEN,
 region: process.env.AWS_REGION || 'us-east-1',
  s3: {
   bucketName: process.env.S3_BUCKET_NAME,
   region: process.env.AWS_REGION || "us-east-1",
   imagesPath: "images/",
   baseURL: process.env.AWS_S3_BASE_URL,
 },
  apiGateway: {
   upload: {
     url: process.env.UPLOAD_IMAGE_URL || 'https://np39lyhj20.execute-api.us-east-1.amazonaws.com/Deployment/upload-image',
     apiKey: process.env.UPLOAD_KEY,
   },
   getTag: {
     url: process.env.AWS_GETTAG_API_URL,
     apiKey: process.env.AWS_GETTAG_API_KEY,
   },
   blockImage: {
     url: process.env.AWS_BLOCKIMAGE_API_URL,
     apiKey: process.env.BLOCK_KEY,
   },
   checkDuplicate: {
     url: process.env.CHECK_DUPLICATE_URL || 'https://71yegno641.execute-api.us-east-1.amazonaws.com/Deployment/check-duplicate',
     apiKey: process.env.CHECK_DUPLICATE_KEY,
   },
 },
  lambda: {
   functions: {
     uploadImageHandler: {
       name: 'UploadToS3',
       runtime: 'nodejs18.x',
       handler: 'index.handler',
       timeout: 30,
       memorySize: 256,
       environment: {
         AWS_REGION: process.env.AWS_REGION || 'us-east-1',
         AWS_BUCKET: process.env.AWS_S3_BUCKET,
         S3_IMAGES_PATH: 'images/',
         DYNAMODB_TABLE: process.env.DYNAMODB_TABLE || 'ImageSignatures',
         DYNAMODB_REGION: process.env.AWS_REGION || 'us-east-1'
       },
       dependencies: [
         '@aws-sdk/client-s3',
         '@aws-sdk/client-dynamodb',
         '@aws-sdk/s3-request-presigner'
       ]
     },
     testEchoHandler: {
       name: 'test-echo-handler',
       runtime: 'nodejs18.x',
       handler: 'index.handler',
       timeout: 10,
       memorySize: 128,
       environment: {}
     }
   },
   deployment: {
     region: process.env.AWS_REGION || 'us-east-1',
     zipFileName: 'lambda-deployment.zip',
     sourceDir: 'src/lambdaHandlers'
   }
 },
  dynamoDB: {
   tableName: "ImageSignatures",
   region: process.env.AWS_REGION || "us-east-1",
   endpoint: process.env.AWS_DYNAMODB_ENDPOINT,
   getTagApiGateway: process.env.AWS_GETTAG_API_GATEWAY,
 },
  cognito: {
   userPoolId: process.env.AWS_COGNITO_USER_POOL_ID,
   userPoolClientId: process.env.AWS_COGNITO_USER_POOL_CLIENT_ID,
   identityPoolId: process.env.AWS_COGNITO_IDENTITY_POOL_ID,
   region: process.env.AWS_REGION || "us-east-1",
 },
  app: {
   defaultTTLInDays: 30,
   hashFieldName: "ContentHash",
   timestampFieldName: "Timestamp",
   ttlFieldName: "TTL",
 },
  network: {
   requestTimeoutSeconds: 30,
   resourceTimeoutSec: 300,
   maxRetryCount: 3,
   initialRetryDelaySec: 1,
   maxRetryDelaySec: 30,
 },
};


// ─────────────────────────
//  AWS CLIENTS INITIALIZATION
// ─────────────────────────


// Initialize S3 Client with environment credentials or fallback to Cognito
const s3Client = new S3Client({
 region: awsConfig.s3.region,
 credentials: awsConfig.accessKeyId && awsConfig.secretAccessKey ? {
   accessKeyId: awsConfig.accessKeyId,
   secretAccessKey: awsConfig.secretAccessKey,
   sessionToken: awsConfig.sessionToken,
 } : process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
   sessionToken: process.env.AWS_SESSION_TOKEN,
 } : fromCognitoIdentityPool({
   client: new CognitoIdentityProviderClient({ region: awsConfig.cognito.region }),
   identityPoolId: awsConfig.cognito.identityPoolId,
 }),
});


// Initialize DynamoDB Client with environment credentials or fallback to Cognito
const dynamoDbClient = new DynamoDBClient({
 region: awsConfig.dynamoDB.region,
 credentials: awsConfig.accessKeyId && awsConfig.secretAccessKey ? {
   accessKeyId: awsConfig.accessKeyId,
   secretAccessKey: awsConfig.secretAccessKey,
   sessionToken: awsConfig.sessionToken,
 } : process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
   accessKeyId: process.env.AWS_ACCESS_KEY_ID,
   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
   sessionToken: process.env.AWS_SESSION_TOKEN,
 } : fromCognitoIdentityPool({
   client: new CognitoIdentityProviderClient({ region: awsConfig.cognito.region }),
   identityPoolId: awsConfig.cognito.identityPoolId,
 }),
});


// Initialize Cognito Client
const cognitoClient = new CognitoIdentityProviderClient({
 region: awsConfig.cognito.region,
});


console.log('AWS services initialized successfully');


// ─────────────────────────
//  CREDENTIALS CHECK
// ─────────────────────────


/**
* Check if AWS credentials are available
*/
export const checkAWSCredentials = () => {
 const hasConfigCredentials = !!(awsConfig.accessKeyId && awsConfig.secretAccessKey);
 const hasEnvCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
 const hasCognitoConfig = !!(awsConfig.cognito.identityPoolId && awsConfig.cognito.region);
  console.log('🔍 AWS Credentials Check:', {
   hasConfigCredentials,
   hasEnvCredentials,
   hasCognitoConfig,
   region: awsConfig.s3.region,
   bucket: awsConfig.s3.bucketName,
 });
  return {
   hasCredentials: hasConfigCredentials || hasEnvCredentials || hasCognitoConfig,
   hasConfigCredentials,
   hasEnvCredentials,
   hasCognitoConfig,
   message: hasConfigCredentials
     ? 'Using config credentials'
     : hasEnvCredentials
       ? 'Using environment credentials'
       : hasCognitoConfig
         ? 'Using Cognito Identity Pool (requires authentication)'
         : 'No AWS credentials configured'
 };
};


// ─────────────────────────
//  API HELPERS
// ─────────────────────────


/**
* Get image upload count from DynamoDB
* @param {string} fileHash - File hash to check
* @returns {Promise<number>} Upload count
*/
const getImageUploadCount = async (fileHash) => {
 try {
   const getItemCommand = new GetItemCommand({
     TableName: awsConfig.dynamoDB.tableName,
     Key: {
       [awsConfig.app.hashFieldName]: { S: fileHash },
     },
   });


   const result = await dynamoDbClient.send(getItemCommand);
  
   if (!result.Item) {
     return 0;
   }


   const item = unmarshall(result.Item);
   return item.UploadCount || 0;
 } catch (error) {
   console.error('Error getting image upload count:', error);
   return 0; // Return 0 on error to allow upload
 }
};


/**
* Increment image upload count in DynamoDB
* @param {string} fileHash - File hash
* @param {string} userId - User ID
* @param {string} userName - User name
* @param {string} fileName - File name
* @returns {Promise<number>} New count
*/
const incrementImageUploadCount = async (fileHash, userId, userName, fileName) => {
 try {
   // First, get current count
   const currentCount = await getImageUploadCount(fileHash);
   const newCount = currentCount + 1;
  
   const timestamp = Math.floor(Date.now() / 1000) + (awsConfig.app.defaultTTLInDays * 24 * 60 * 60);
  
   const putItemCommand = new PutItemCommand({
     TableName: awsConfig.dynamoDB.tableName,
     Item: {
       [awsConfig.app.hashFieldName]: { S: fileHash },
       [awsConfig.app.timestampFieldName]: { S: new Date().toISOString() },
       [awsConfig.app.ttlFieldName]: { N: timestamp.toString() },
       UserId: { S: userId },
       UserName: { S: userName },
       FileName: { S: fileName },
       UploadCount: { N: newCount.toString() },
       LastUploadedBy: { S: userId },
       LastUploadedAt: { S: new Date().toISOString() },
     },
   });


   await dynamoDbClient.send(putItemCommand);
   console.log(`✅ DynamoDB updated: ${fileHash} count: ${newCount}`);
   return newCount;
 } catch (error) {
   console.error('❌ Error incrementing image upload count:', error);
   throw error;
 }
};


// API helpers object for export
const apiHelpers = {
 getImageUploadCount,
 incrementImageUploadCount,
};


// ─────────────────────────
//  IMAGE UPLOAD HANDLER
// ─────────────────────────


/**
* Upload image to S3 and store metadata in DynamoDB
* @param {File|Blob} imageFile - The image file to upload
* @param {string} userId - User ID for tracking
* @param {Object} metadata - Additional metadata
* @returns {Promise<Object>} Upload result with URLs and metadata
*/
export const uploadImageHandler = async (imageFile, userId, metadata = {}) => {
 try {
   // Generate unique filename
   const timestamp = Date.now();
   const fileExtension = imageFile.name ? imageFile.name.split('.').pop() : 'jpg';
   const fileName = `${userId}_${timestamp}.${fileExtension}`;
   const s3Key = `${awsConfig.s3.imagesPath}${fileName}`;


   // For React Native: read file as blob/buffer
   let fileBody = imageFile;
   if (imageFile.uri) {
     // If using Expo FileSystem or React Native fetch
     const response = await fetch(imageFile.uri);
     fileBody = await response.blob();
   }


   // Upload to S3
   const uploadParams = {
     Bucket: awsConfig.s3.bucketName,
     Key: s3Key,
     Body: fileBody,
     ContentType: imageFile.type || 'image/jpeg',
     ACL: 'public-read',
   };


   const uploadCommand = new PutObjectCommand(uploadParams);
   await s3Client.send(uploadCommand);


   // Generate image URL
   const imageUrl = `${awsConfig.s3.baseURL}${fileName}`;
   console.log('✅ S3 Upload Result:', { imageUrl, s3Key });


   // Calculate content hash (simplified - in production use proper hashing)
   const contentHash = `${userId}_${timestamp}_${fileName}`;


   // Store metadata in DynamoDB
   const ttlTimestamp = Math.floor(Date.now() / 1000) + (awsConfig.app.defaultTTLInDays * 24 * 60 * 60);
  
   const dynamoItem = {
     [awsConfig.app.hashFieldName]: { S: contentHash },
     [awsConfig.app.timestampFieldName]: { S: new Date().toISOString() },
     [awsConfig.app.ttlFieldName]: { N: ttlTimestamp.toString() },
     UserId: { S: userId },
     ImageUrl: { S: imageUrl },
     S3Key: { S: s3Key },
     FileName: { S: fileName },
     FileSize: { N: imageFile.size?.toString() || '0' },
     ContentType: { S: imageFile.type || 'image/jpeg' },
     ...Object.keys(metadata).reduce((acc, key) => {
       acc[key] = { S: metadata[key].toString() };
       return acc;
     }, {}),
   };


   const putItemCommand = new PutItemCommand({
     TableName: awsConfig.dynamoDB.tableName,
     Item: dynamoItem,
   });


   await dynamoDbClient.send(putItemCommand);


   // Call image tagging API
   const tagResponse = await fetch(awsConfig.apiGateway.getTag.url, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-api-key': awsConfig.apiGateway.getTag.apiKey,
     },
     body: JSON.stringify({
       imageUrl: imageUrl,
       contentHash: contentHash,
       userId: userId,
     }),
   });


   const tagResult = await tagResponse.json();


   return {
     success: true,
     imageUrl: imageUrl,
     s3Key: s3Key,
     contentHash: contentHash,
     fileName: fileName,
     tags: tagResult.tags || [],
     metadata: {
       ...metadata,
       uploadTimestamp: timestamp,
       fileSize: imageFile.size,
       contentType: imageFile.type || 'image/jpeg',
     },
   };


 } catch (error) {
   console.error('Error uploading image:', error);
   throw new Error(`Image upload failed: ${error.message}`);
 }
};


// ─────────────────────────
//  DYNAMODB HANDLER
// ─────────────────────────


/**
* Get image metadata from DynamoDB by content hash
* @param {string} contentHash - Content hash to search for
* @returns {Promise<Object|null>} Image metadata or null if not found
*/
export const getImageMetadata = async (contentHash) => {
 try {
   const getItemCommand = new GetItemCommand({
     TableName: awsConfig.dynamoDB.tableName,
     Key: {
       [awsConfig.app.hashFieldName]: { S: contentHash },
     },
   });


   const result = await dynamoDbClient.send(getItemCommand);
  
   if (!result.Item) {
     return null;
   }


   return unmarshall(result.Item);
 } catch (error) {
   console.error('Error getting image metadata:', error);
   throw new Error(`Failed to get image metadata: ${error.message}`);
 }
};


/**
* Query images by user ID
* @param {string} userId - User ID to search for
* @param {number} limit - Maximum number of results (default: 10)
* @returns {Promise<Array>} Array of image metadata
*/
export const getUserImages = async (userId, limit = 10) => {
 try {
   const queryCommand = new QueryCommand({
     TableName: awsConfig.dynamoDB.tableName,
     IndexName: 'UserIdIndex', // Assuming you have a GSI on UserId
     KeyConditionExpression: 'UserId = :userId',
     ExpressionAttributeValues: {
       ':userId': { S: userId },
     },
     ScanIndexForward: false, // Most recent first
     Limit: limit,
   });


   const result = await dynamoDbClient.send(queryCommand);
  
   return result.Items ? result.Items.map(item => unmarshall(item)) : [];
 } catch (error) {
   console.error('Error querying user images:', error);
   throw new Error(`Failed to get user images: ${error.message}`);
 }
};


/**
* Block an image by updating its status in DynamoDB
* @param {string} contentHash - Content hash of the image to block
* @param {string} reason - Reason for blocking
* @returns {Promise<Object>} Update result
*/
export const blockImage = async (contentHash, reason = 'Inappropriate content') => {
 try {
   // First, call the block image API
   const blockResponse = await fetch(awsConfig.apiGateway.blockImage.url, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-api-key': api.blockKey,
     },
     body: JSON.stringify({
       contentHash: contentHash,
       reason: reason,
     }),
   });


   const blockResult = await blockResponse.json();


   // Update DynamoDB with blocked status
   const updateCommand = new PutItemCommand({
     TableName: awsConfig.dynamoDB.tableName,
     Item: {
       [awsConfig.app.hashFieldName]: { S: contentHash },
       [awsConfig.app.timestampFieldName]: { S: new Date().toISOString() },
       Status: { S: 'BLOCKED' },
       BlockReason: { S: reason },
       BlockedAt: { S: new Date().toISOString() },
     },
   });


   await dynamoDbClient.send(updateCommand);


   return {
     success: true,
     contentHash: contentHash,
     status: 'BLOCKED',
     reason: reason,
     apiResult: blockResult,
   };


 } catch (error) {
   console.error('Error blocking image:', error);
   throw new Error(`Failed to block image: ${error.message}`);
 }
};


// ─────────────────────────
//  LAMBDA DEPLOYMENT & MANAGEMENT
// ─────────────────────────


/**
* Deploy Lambda function using the centralized config
* @param {string} functionKey - Key of the function in awsConfig.lambda.functions
* @returns {Promise<Object>} Deployment result
*/
export const deployLambdaFunction = async (functionKey) => {
 try {
   const functionConfig = awsConfig.lambda.functions[functionKey];
   if (!functionConfig) {
     throw new Error(`Function ${functionKey} not found in config`);
   }


   console.log(`🚀 Deploying Lambda function: ${functionConfig.name}`);
  
   // This would typically use AWS SDK, but for now we'll return the config
   // In a real implementation, you'd use AWS.Lambda to deploy
   return {
     success: true,
     functionName: functionConfig.name,
     config: functionConfig,
     message: `Function ${functionConfig.name} configured for deployment`
   };
 } catch (error) {
   console.error('❌ Lambda deployment failed:', error);
   throw error;
 }
};


/**
* Test Lambda function with echo handler
* @param {Object} testData - Data to send to the test function
* @returns {Promise<Object>} Test result
*/
export const testLambdaFunction = async (testData = {}) => {
 try {
   console.log('🧪 Testing Lambda function with echo handler...');
  
   // Use the test echo handler URL if available, otherwise simulate
   const testUrl = api.uploadImageURL.replace('/upload-image', '/test-echo');
  
   const response = await fetch(testUrl, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-api-key': api.uploadKey,
     },
     body: JSON.stringify({
       test: true,
       timestamp: new Date().toISOString(),
       data: testData
     }),
   });


   if (!response.ok) {
     throw new Error(`Test failed: ${response.status} ${response.statusText}`);
   }


   const result = await response.json();
   console.log('✅ Lambda test successful:', result);
   return result;
 } catch (error) {
   console.error('❌ Lambda test failed:', error);
   throw error;
 }
};


/**
* Get Lambda function configuration
* @param {string} functionKey - Key of the function in config
* @returns {Object} Function configuration
*/
export const getLambdaConfig = (functionKey) => {
 return awsConfig.lambda.functions[functionKey] || null;
};


/**
* List all configured Lambda functions
* @returns {Array} Array of function configurations
*/
export const listLambdaFunctions = () => {
 return Object.keys(awsConfig.lambda.functions).map(key => ({
   key,
   ...awsConfig.lambda.functions[key]
 }));
};


// ─────────────────────────
//  EXPORTS
// ─────────────────────────


// Additional functions for compatibility with existing code
export const uploadImageToS3 = async (fileUri, userId, fileHash, fileInfo) => {
 try {
   console.log('🚀 [uploadImageToS3] Starting multipart upload...', {
     fileUri: fileUri?.substring(0, 50) + '...',
     userId,
     fileHash: fileHash?.substring(0, 12) + '...'
   });

   const timestamp = Date.now();
   const fileExtension = fileInfo?.fileName?.split('.').pop() || fileInfo?.name?.split('.').pop() || 'jpg';
   const fileName = `${userId}_${timestamp}_${fileHash.substring(0, 8)}.${fileExtension}`;
   
   // Fix content type if it's just "image"
   let finalContentType = fileInfo?.type || 'image/jpeg';
   if (finalContentType === 'image') {
     if (fileName.toLowerCase().endsWith('.png')) {
       finalContentType = 'image/png';
     } else if (fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')) {
       finalContentType = 'image/jpeg';
     } else if (fileName.toLowerCase().endsWith('.gif')) {
       finalContentType = 'image/gif';
     } else if (fileName.toLowerCase().endsWith('.webp')) {
       finalContentType = 'image/webp';
     } else {
       finalContentType = 'image/jpeg';
     }
   }

        // Use AWS API credentials
     const uploadApiKey = api.uploadKey;
     const checkDuplicateApiKey = api.checkDuplicateKey;
     const blockApiKey = api.blockKey;
     
     // Check file size first to avoid 413 errors
   const fileInfo = await FileSystem.getInfoAsync(fileUri);
   const fileSizeInMB = (fileInfo.size || 0) / (1024 * 1024);
   
   if (fileSizeInMB > 15) { // Increased to 15MB limit for base64 uploads
     console.warn('⚠️ [uploadImageToS3] File too large for base64 upload, size:', fileSizeInMB.toFixed(2) + 'MB');
     throw new Error('File too large for direct upload. Please use presigned URL method.');
   }

   // Convert file to base64 for upload
   const base64Data = await FileSystem.readAsStringAsync(fileUri, {
     encoding: FileSystem.EncodingType.Base64,
   });

   console.log('📤 [uploadImageToS3] Base64 data prepared:', {
     fileName,
     contentType: finalContentType,
     fileHash: fileHash?.substring(0, 12) + '...',
     userId,
     dataSize: (base64Data.length / 1024).toFixed(2) + 'KB'
   });

   // Use JSON payload instead of multipart
   const apiGatewayUrl = awsConfig.apiGateway.upload.url;
   if (!apiGatewayUrl) throw new Error("Upload API Gateway URL is not configured.");
  
   const response = await fetch(apiGatewayUrl, {
     method: 'POST',
     headers: {
       'Content-Type': 'application/json',
       'x-api-key': awsConfig.apiGateway.upload.apiKey,
     },
     body: JSON.stringify({
       image: base64Data,  // Use 'image' as expected by the deployed Lambda
       filename: fileName,  // Use 'filename' as expected by the deployed Lambda
       imageHash: fileHash,  // Use 'imageHash' as expected by the deployed Lambda
       contentType: finalContentType,
       userId: userId
     }),
   });

   console.log('📥 [uploadImageToS3] Response status:', response.status);
  
   let result;
   try {
     const responseText = await response.text();
     console.log('📥 [uploadImageToS3] Raw response text:', responseText.substring(0, 200) + '...');
     
     result = JSON.parse(responseText);
   } catch (parseError) {
     console.error('❌ [uploadImageToS3] JSON parse error:', parseError);
     throw new Error(`Invalid JSON response from server: ${parseError.message}`);
   }
   
   console.log('📥 [uploadImageToS3] Parsed response:', {
     hasSuccess: !!result.success,
     hasImageUrl: !!result.imageUrl,
     hasError: !!result.error,
     hasBody: !!result.body
   });

   // Handle error responses
   if (response.status === 413) {
     throw new Error('File too large for upload. Please use presigned URL method.');
   }
   
   if (response.status !== 200) {
     throw new Error(`Upload failed with status ${response.status}: ${result.error || result.message || 'Unknown error'}`);
   }
  
   // Handle cases where the lambda returns an error in a 200 OK response
   if (result.body && typeof result.body === 'string') {
       try {
           const parsedBody = JSON.parse(result.body);
           if (parsedBody.error) {
               throw new Error(`Lambda returned error: ${parsedBody.error}`);
           }
           // If parsedBody has success and imageUrl, use those
           if (parsedBody.success && parsedBody.imageUrl) {
               console.log('✅ [uploadImageToS3] Upload successful from parsed body:', {
                   imageUrl: parsedBody.imageUrl.substring(0, 80) + '...',
               });
               return parsedBody.imageUrl;
           }
       } catch (e) {
           console.warn('⚠️ [uploadImageToS3] Failed to parse body as JSON:', e.message);
           // Not a JSON error body, proceed
       }
   }
  
   if (!result.success || !result.imageUrl) {
     console.error('❌ [uploadImageToS3] Missing success or imageUrl in response:', {
       success: result.success,
       hasImageUrl: !!result.imageUrl,
       error: result.error,
       message: result.message
     });
     throw new Error(`API response missing required fields. Success: ${result.success}, Has ImageUrl: ${!!result.imageUrl}`);
   }

   console.log('✅ [uploadImageToS3] Upload successful:', {
     imageUrl: result.imageUrl.substring(0, 80) + '...',
   });

   return result.imageUrl;
 } catch (error) {
   console.error('❌ [uploadImageToS3] Error:', error);
   throw new Error(`Image upload failed: ${error.message}`);
 }
};


export const generateS3Url = (fileName, userId) => {
 const timestamp = Date.now();
 const fileExtension = fileName.split('.').pop() || 'jpg';
 const uniqueFileName = `${userId}_${timestamp}.${fileExtension}`;
 return `${awsConfig.s3.baseURL}${uniqueFileName}`;
};


// Alias functions for DynamoDB operations
export const getImageUploadCountDynamo = getImageUploadCount;
export const incrementImageUploadCountDynamo = incrementImageUploadCount;


export { awsConfig, s3Client, dynamoDbClient, cognitoClient, apiHelpers };

export default awsConfig;