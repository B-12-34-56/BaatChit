// AWS Lambda Handler for Presigned URL Upload System
// This template shows how to implement the two-step upload process:
// 1. /upload-image - Returns presigned URL for direct S3 upload
// 2. /confirm-upload - Confirms upload and updates DynamoDB

const AWS = require('aws-sdk');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_BUCKET || '2314823894myawsbucket',
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE || 'ImageSignatures',
    region: process.env.DYNAMODB_REGION || 'us-east-1',
  },
  s3: {
    imagesPath: process.env.S3_IMAGES_PATH || 'images/',
  },
  fields: {
    hashFieldName: 'ContentHash',
  },
};

// Initialize AWS clients
const s3Client = new S3Client({ region: awsConfig.region });
const dynamoClient = new DynamoDBClient({ region: awsConfig.dynamodb.region });

/**
 * Generate presigned URL for direct S3 upload
 */
const generatePresignedUrl = async (fileHash, fileName, contentType, userId) => {
  const timestamp = Date.now();
  const s3Key = `${awsConfig.s3.imagesPath}${userId}/${timestamp}_${fileHash.substring(0, 8)}_${fileName}`;
  
  const command = new PutObjectCommand({
    Bucket: awsConfig.bucket,
    Key: s3Key,
    ContentType: contentType,
    Metadata: {
      fileHash: fileHash,
      userId: userId,
      uploadTimestamp: timestamp.toString(),
      uploadMethod: 'presigned-url',
    },
  });
  
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 minutes
  
  return {
    presignedUrl,
    s3Key,
    expiresIn: 900,
  };
};

/**
 * Check upload count for duplicate detection
 */
const getUploadCount = async (fileHash) => {
  try {
    const command = new GetItemCommand({
      TableName: awsConfig.dynamodb.tableName,
      Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
      ProjectionExpression: 'UploadCount',
    });
    
    const data = await dynamoClient.send(command);
    return data.Item?.UploadCount?.N ? parseInt(data.Item.UploadCount.N, 10) : 0;
  } catch (error) {
    console.error('Error getting upload count:', error);
    return 0;
  }
};

/**
 * Increment upload count with race condition protection
 */
const incrementUploadCount = async (fileHash, userId, userName, fileName) => {
  const maxRetries = 3;
  let retryCount = 0;
  
  while (retryCount < maxRetries) {
    try {
      // Check if item exists
      const getCommand = new GetItemCommand({
        TableName: awsConfig.dynamodb.tableName,
        Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
        ProjectionExpression: 'UploadCount',
      });
      
      const getResult = await dynamoClient.send(getCommand);
      const itemExists = !!getResult.Item;
      
      if (itemExists && getResult.Item) {
        // Item exists - conditional update
        const currentCount = parseInt(getResult.Item.UploadCount?.N || '0', 10);
        const newCount = currentCount + 1;
        
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
        
        await dynamoClient.send(updateCommand);
        return newCount;
        
      } else {
        // Item doesn't exist - conditional create
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
        
        await dynamoClient.send(putCommand);
        return 1;
      }
      
    } catch (error) {
      retryCount++;
      
      if (error.name === 'ConditionalCheckFailedException') {
        if (retryCount >= maxRetries) {
          throw new Error(`Failed to increment count after ${maxRetries} attempts`);
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retryCount - 1)));
        continue;
      } else {
        throw error;
      }
    }
  }
  
  throw new Error(`Failed to increment count after ${maxRetries} attempts`);
};

/**
 * Main Lambda handler for /upload-image endpoint
 */
exports.handler = async (event) => {
  try {
    console.log('📤 [uploadImageHandler] Event received:', JSON.stringify(event, null, 2));
    
    // Parse request with two-step parser
    const bodyString = typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {});
    const body = JSON.parse(bodyString);
    const { fileHash, fileName, contentType, userId, uploadMethod } = body;
    
    // Validate required fields
    if (!fileHash || !fileName || !contentType || !userId) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Missing required fields: fileHash, fileName, contentType, userId',
        }),
      };
    }
    
    // Check if this is a presigned URL request
    if (uploadMethod === 'presigned-url') {
      // Generate presigned URL for direct S3 upload
      const { presignedUrl, s3Key, expiresIn } = await generatePresignedUrl(
        fileHash, fileName, contentType, userId
      );
      
      console.log('✅ [uploadImageHandler] Presigned URL generated:', {
        s3Key,
        expiresIn,
        fileHash: fileHash.substring(0, 12) + '...'
      });
      
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          success: true,
          presignedUrl,
          s3Key,
          expiresIn,
          message: 'Presigned URL generated successfully. Upload file to S3, then call /confirm-upload',
        }),
      };
    } else {
      // Legacy base64 upload handling (if needed)
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Base64 uploads are deprecated. Use presigned URL upload method.',
        }),
      };
    }
    
  } catch (error) {
    console.error('❌ [uploadImageHandler] Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

/**
 * Lambda handler for /confirm-upload endpoint
 */
exports.confirmUploadHandler = async (event) => {
  try {
    console.log('✅ [confirmUploadHandler] Event received:', JSON.stringify(event, null, 2));
    
    // Parse request with two-step parser
    const bodyString = typeof event.body === 'string' ? event.body : JSON.stringify(event.body || {});
    const body = JSON.parse(bodyString);
    const { fileHash, s3Key, userId, fileName, uploadTimestamp } = body;
    
    // Validate required fields
    if (!fileHash || !s3Key || !userId || !fileName) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          error: 'Missing required fields: fileHash, s3Key, userId, fileName',
        }),
      };
    }
    
    // Get current upload count
    const currentCount = await getUploadCount(fileHash);
    
    // Check if upload should be blocked (e.g., max 3 uploads)
    const maxUploads = 3;
    const isBlocked = currentCount >= maxUploads;
    const isWarning = currentCount === maxUploads - 1;
    
    if (isBlocked) {
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
          'Access-Control-Allow-Methods': 'POST,OPTIONS',
        },
        body: JSON.stringify({
          success: false,
          blocked: true,
          uploadCount: currentCount,
          message: `Upload blocked: This image has been uploaded ${currentCount} times. Maximum allowed: ${maxUploads}`,
        }),
      };
    }
    
    // Increment upload count
    const newCount = await incrementUploadCount(fileHash, userId, 'User', fileName);
    
    // Generate S3 URL
    const s3Url = `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${s3Key}`;
    
    console.log('✅ [confirmUploadHandler] Upload confirmed:', {
      fileHash: fileHash.substring(0, 12) + '...',
      s3Key,
      newCount,
      isWarning
    });
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({
        success: true,
        imageUrl: s3Url,
        uploadCount: newCount,
        blocked: false,
        warning: isWarning,
        message: isWarning 
          ? `⚠️ WARNING: This image has been uploaded ${newCount} times. One more upload will reach the limit.`
          : 'Upload confirmed successfully',
      }),
    };
    
  } catch (error) {
    console.error('❌ [confirmUploadHandler] Error:', error);
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
      }),
    };
  }
};

/**
 * CORS preflight handler
 */
exports.optionsHandler = async (event) => {
  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,x-api-key',
      'Access-Control-Allow-Methods': 'POST,OPTIONS',
    },
    body: '',
  };
}; 