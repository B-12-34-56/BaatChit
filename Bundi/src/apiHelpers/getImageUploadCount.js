import 'react-native-get-random-values';

// ENV VARS NEEDED:
// AWS_REGION, AWS_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
// DYNAMODB_TABLE, DYNAMODB_REGION
import Constants from 'expo-constants';
import { GetItemCommand, UpdateItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { ddbClient } from '../utils/aws';

// Environment configuration
const getEnv = (key, fallback = '') =>
  process.env[key] || Constants.expoConfig?.extra?.[key] || fallback;

const awsConfig = {
  region: 'us-east-1',
  aws_access_key_id: getEnv('AWS_ACCESS_KEY_ID', 'YOUR_ACCESS_KEY_ID'),
  aws_secret_access_key: getEnv('AWS_SECRET_ACCESS_KEY', 'YOUR_SECRET_ACCESS_KEY'),
  aws_session_token: getEnv('AWS_SESSION_TOKEN', 'YOUR_SESSION_TOKEN'),
  dynamodb: {
    tableName: getEnv('DYNAMODB_TABLE', 'ImageSignatures'),
    region: getEnv('AWS_REGION', 'us-east-1')
  },
  fields: {
    hashFieldName: 'ContentHash',
  },
};

/**
 * Get the current upload count for a file hash
 * @param {string} fileHash - The hash of the file to check
 * @returns {Promise<{success: boolean, count: number, error?: string}>} - The current count and success status
 */
export const getImageUploadCount = async (fileHash) => {
  try {
    console.log(`🔍 [getImageUploadCount] Checking count for:`, fileHash.substring(0, 12) + '...');
    
    const command = new GetItemCommand({
      TableName: awsConfig.dynamodb.tableName,
      Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
      ProjectionExpression: 'UploadCount',
    });
    
    const data = await ddbClient.send(command);
    const count = data.Item?.UploadCount?.N ? parseInt(data.Item.UploadCount.N, 10) : 0;
    
    console.log(`📊 [getImageUploadCount] Count for ${fileHash.substring(0, 12)}...: ${count}`);
    
    return {
      success: true,
      count,
    };
  } catch (error) {
    console.error(`❌ [getImageUploadCount] Error:`, error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Increment the upload count for a file hash with race condition protection
 * @param {string} userId - The ID of the user uploading
 * @param {string} userName - The name of the user uploading
 * @param {string} fileHash - The hash of the file being uploaded
 * @param {string} fileName - The name of the file being uploaded
 * @returns {Promise<{success: boolean, newCount: number, error?: string}>} - The new count and success status
 */
export const incrementImageUploadCount = async (userId, userName, fileHash, fileName) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      console.log(`🔄 [incrementImageUploadCount] Attempt ${retryCount + 1}/${maxRetries} for hash:`, fileHash.substring(0, 12) + '...');
      
      // First, try to get the current item to check if it exists
      const getCommand = new GetItemCommand({
        TableName: awsConfig.dynamodb.tableName,
        Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
        ProjectionExpression: 'UploadCount',
      });
      
      const getResult = await ddbClient.send(getCommand);
      const itemExists = !!getResult.Item;
      
      if (itemExists && getResult.Item) {
        // Item exists - use conditional update to prevent race conditions
        const currentCount = parseInt(getResult.Item.UploadCount?.N || '0', 10);
        const newCount = currentCount + 1;
        
        console.log(`📊 [incrementImageUploadCount] Current count: ${currentCount}, new count: ${newCount}`);
        
        const updateCommand = new UpdateItemCommand({
          TableName: awsConfig.dynamodb.tableName,
          Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
          UpdateExpression: 'SET UploadCount = :newCount, LastUploaderId = :uid, LastUploaderName = :uname, LastUploadedAt = :ts, FileName = :fname',
          ConditionExpression: 'UploadCount = :currentCount',
          ExpressionAttributeValues: {
            ':newCount': { N: newCount.toString() },
            ':currentCount': { N: currentCount.toString() },
            ':uid': { S: userId },
            ':uname': { S: userName || 'Anonymous' },
            ':ts': { N: Date.now().toString() },
            ':fname': { S: fileName },
          },
          ReturnValues: 'UPDATED_NEW',
        });
        
        await ddbClient.send(updateCommand);
        console.log(`✅ [incrementImageUploadCount] Successfully incremented count to ${newCount}`);
        
        return {
          success: true,
          newCount,
        };
        
      } else {
        // Item doesn't exist - use conditional create to prevent race conditions
        console.log(`🆕 [incrementImageUploadCount] Creating new item for hash:`, fileHash.substring(0, 12) + '...');
        
        const putCommand = new PutItemCommand({
          TableName: awsConfig.dynamodb.tableName,
          Item: {
            [awsConfig.fields.hashFieldName]: { S: fileHash },
            UploadCount: { N: '1' },
            LastUploaderId: { S: userId },
            LastUploaderName: { S: userName || 'Anonymous' },
            LastUploadedAt: { N: Date.now().toString() },
            FileName: { S: fileName },
            FirstUploaderId: { S: userId },
            FirstUploaderName: { S: userName || 'Anonymous' },
            FirstUploadedAt: { N: Date.now().toString() },
          },
          ConditionExpression: 'attribute_not_exists(#hash)',
          ExpressionAttributeNames: {
            '#hash': awsConfig.fields.hashFieldName,
          },
        });
        
        await ddbClient.send(putCommand);
        console.log(`✅ [incrementImageUploadCount] Successfully created new item with count 1`);
        
        return {
          success: true,
          newCount: 1,
        };
      }
      
    } catch (error) {
      retryCount++;
      
      // Handle specific DynamoDB errors
      if (error.name === 'ConditionalCheckFailedException') {
        console.log(`⚠️ [incrementImageUploadCount] Conditional check failed (attempt ${retryCount}/${maxRetries}) - item was modified concurrently`);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ [incrementImageUploadCount] Max retries reached for hash:`, fileHash.substring(0, 12) + '...');
          return {
            success: false,
            newCount: 0,
            error: `Failed to increment count after ${maxRetries} attempts due to concurrent modifications`,
          };
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(100 * Math.pow(2, retryCount - 1), 1000);
        console.log(`⏳ [incrementImageUploadCount] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
        
      } else if (error.name === 'ResourceNotFoundException') {
        console.error(`❌ [incrementImageUploadCount] DynamoDB table not found:`, awsConfig.dynamodb.tableName);
        return {
          success: false,
          newCount: 0,
          error: `DynamoDB table ${awsConfig.dynamodb.tableName} not found`,
        };
        
      } else if (error.name === 'ProvisionedThroughputExceededException') {
        console.warn(`⚠️ [incrementImageUploadCount] Throughput exceeded (attempt ${retryCount}/${maxRetries})`);
        
        if (retryCount >= maxRetries) {
          console.error(`❌ [incrementImageUploadCount] Max retries reached due to throughput limits`);
          return {
            success: false,
            newCount: 0,
            error: `Failed to increment count due to DynamoDB throughput limits`,
          };
        }
        
        // Wait before retry with exponential backoff
        const delay = Math.min(200 * Math.pow(2, retryCount - 1), 2000);
        console.log(`⏳ [incrementImageUploadCount] Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
        
      } else {
        console.error(`❌ [incrementImageUploadCount] Unexpected error:`, {
          error: error.message,
          retryCount,
          fileHash: fileHash.substring(0, 12) + '...'
        });
        return {
          success: false,
          newCount: 0,
          error: error.message || 'Unknown error',
        };
      }
    }
  }
  
  return {
    success: false,
    newCount: 0,
    error: `Failed to increment count after ${maxRetries} attempts`,
  };
};

/**
 * Check if an image should be blocked based on upload count
 * @param {string} fileHash - The hash of the file to check
 * @param {number} maxUploads - Maximum allowed uploads (default: 3)
 * @returns {Promise<{blocked: boolean, count: number, warning: boolean}>}
 */
export const checkImageUploadLimit = async (fileHash, maxUploads = 3) => {
  const result = await getImageUploadCount(fileHash);
  
  if (!result.success) {
    console.warn(`⚠️ [checkImageUploadLimit] Failed to get count, allowing upload`);
    return { blocked: false, count: 0, warning: false };
  }
  
  const count = result.count;
  const blocked = count >= maxUploads;
  const warning = count === maxUploads - 1; // Warn on second-to-last upload
  
  console.log(`🔍 [checkImageUploadLimit] Hash: ${fileHash.substring(0, 12)}..., Count: ${count}, Blocked: ${blocked}, Warning: ${warning}`);
  
  return { blocked, count, warning };
}; 