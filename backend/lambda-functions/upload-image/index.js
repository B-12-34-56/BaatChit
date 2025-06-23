// AWS Lambda Handler for Presigned URL Upload System & Direct Multipart Upload
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { DynamoDBClient, GetItemCommand, UpdateItemCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const multipart = require('parse-multipart');
const { marshall } = require('@aws-sdk/util-dynamodb');
const crypto = require('crypto');

// AWS Configuration - Use environment variables
const awsConfig = {
  s3: {
    bucket: process.env.AWS_BUCKET || 'YOUR_S3_BUCKET_NAME',
    region: process.env.AWS_REGION || 'us-east-1',
    imagesPath: 'images/',
  },
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE || 'YOUR_DYNAMODB_TABLE',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  fields: {
    hashFieldName: 'ContentHash',
    timestampFieldName: 'Timestamp',
    ttlFieldName: 'TTL',
  },
  app: {
    defaultTTLInDays: 30,
  },
};

const s3Client = new S3Client({
  region: 'us-east-1',
  bucket: process.env.AWS_BUCKET || 'YOUR_S3_BUCKET_NAME',
});

const dynamoClient = new DynamoDBClient({
  tableName: 'ImageSignatures',
  region: 'us-east-1',
});

const imagesPath = 'images/';

/**
 * Parse multipart form data
 */
const parseMultipartData = (event) => {
  try {
    const boundary = multipart.getBoundary(event.headers['content-type']);
    const parts = multipart.Parse(Buffer.from(event.body, 'base64'), boundary);
    
    const result = {};
    parts.forEach(part => {
      const fieldName = part.name;
      if (part.filename) {
        // File field
        result[fieldName] = {
          filename: part.filename,
          contentType: part.type,
          data: part.data
        };
      } else {
        // Text field
        result[fieldName] = part.data.toString('utf8');
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error parsing multipart data:', error);
    throw new Error('Failed to parse multipart form data');
  }
};

/**
 * Helper function to create consistent error response
 */
const createErrorResponse = (statusCode, error, message, debug = null) => {
  const response = {
    statusCode,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ 
      success: false,
      blocked: false,
      totalCount: 0,
      uploadCount: 0,
      imageUrl: null,
      error,
      message
    })
  };
  
  if (debug) {
    response.body = JSON.stringify({
      ...JSON.parse(response.body),
      debug
    });
  }
  
  return response;
};

/**
 * Helper function to create consistent success response
 */
const createSuccessResponse = (imageUrl, message, additionalData = {}) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify({ 
      success: true, 
      imageUrl,
      blocked: false,
      totalCount: 1,
      uploadCount: 1,
      message,
      ...additionalData
    }),
  };
};

/**
 * Main Lambda handler: supports both presigned URL requests and direct multipart uploads.
 */
exports.handler = async (event) => {
  console.log('🔍 [uploadImageHandler] AWS Config:', awsConfig);
  
  // Validate AWS configuration
  if (!awsConfig.bucket) {
    console.error('❌ [uploadImageHandler] AWS_BUCKET not configured');
    return createErrorResponse(500, 'AWS_BUCKET not configured', 'Server configuration error');
  }
  
  console.log('🔍 [uploadImageHandler] Raw event:', JSON.stringify(event, null, 2));
  console.log('🔍 [uploadImageHandler] Event type:', typeof event);
  console.log('🔍 [uploadImageHandler] Event keys:', Object.keys(event));
  console.log('🔍 [uploadImageHandler] Content-Type:', event.headers?.['content-type']);
  console.log('🔍 [uploadImageHandler] Body type:', typeof event.body);
  console.log('🔍 [uploadImageHandler] Body length:', event.body ? event.body.length : 0);
  
  let payload;
  let isMultipart = false;
  
  try {
    // Check if it's multipart form data
    if (event.headers['content-type'] && event.headers['content-type'].includes('multipart/form-data')) {
      console.log('📤 [uploadImageHandler] Processing multipart form data');
      isMultipart = true;
      payload = parseMultipartData(event);
    } else {
      console.log('📤 [uploadImageHandler] Processing JSON payload');
      
      // Handle both string and object body
      if (typeof event.body === 'string') {
        console.log('📤 [uploadImageHandler] Body is string, parsing JSON...');
        payload = JSON.parse(event.body || '{}');
      } else if (typeof event.body === 'object') {
        console.log('📤 [uploadImageHandler] Body is already object, using directly...');
        payload = event.body || {};
      } else {
        console.log('📤 [uploadImageHandler] Body is neither string nor object, using empty object...');
        payload = {};
      }
    }
    
    console.log('🔍 [uploadImageHandler] Parsed payload keys:', Object.keys(payload));
    console.log('🔍 [uploadImageHandler] Raw payload values:', {
      hasUploadMethod: !!payload.uploadMethod,
      hasImage: !!payload.image,
      hasFilename: !!payload.filename,
      hasContentType: !!payload.contentType,
      hasFileHash: !!payload.fileHash,
      hasImageHash: !!payload.imageHash,
      hasUserId: !!payload.userId,
      payloadKeys: Object.keys(payload)
    });
  } catch (e) {
    console.warn('[uploadImageHandler] Failed to parse payload:', e);
    return createErrorResponse(400, "Invalid payload format", "Invalid payload format");
  }
  
  try {
    const { uploadMethod, image, filename, contentType, fileHash, imageHash, userId } = payload;
    
    // Support both fileHash and imageHash for backward compatibility
    const hash = fileHash || imageHash;
    
    console.log('🔍 [uploadImageHandler] Extracted fields →', {
      uploadMethod,
      hasImage: !!image,
      imageLength: image ? image.length : 0,
      filename,
      contentType,
      fileHash,
      imageHash,
      hash,
      userId,
      isMultipart
    });

    // Add detailed field validation logging
    console.log('🔍 [uploadImageHandler] Field validation:', {
      imageExists: !!image,
      imageType: typeof image,
      imageLength: image ? image.length : 0,
      filenameExists: !!filename,
      filenameType: typeof filename,
      filenameValue: filename,
      contentTypeExists: !!contentType,
      contentTypeValue: contentType,
      userIdExists: !!userId,
      userIdValue: userId
    });

    // Validate required fields for direct upload
    if (!image || !filename) {
      console.error('[uploadImageHandler] Missing required fields:', { 
        hasImage: !!image, 
        filename, 
        imageLength: image ? image.length : 0,
        imageType: typeof image,
        filenameType: typeof filename,
        payloadKeys: Object.keys(payload),
        payloadValues: {
          image: image ? 'present' : 'missing',
          filename: filename ? 'present' : 'missing',
          contentType: contentType ? 'present' : 'missing',
          userId: userId ? 'present' : 'missing'
        }
      });
      return createErrorResponse(400, 'Missing required fields: image and filename are required', 'Missing image or filename', {
        receivedFields: Object.keys(payload),
        imagePresent: !!image,
        filenamePresent: !!filename
      });
    }

    // --- ROUTE 1: Presigned URL Generation ---
    if (uploadMethod === 'presigned-url') {
      if (!hash || !filename || !contentType || !userId) {
        console.error('[uploadImageHandler] Missing fields for presigned URL:', { hash, filename, contentType, userId });
        return createErrorResponse(400, 'Missing fields for presigned URL: fileHash/imageHash, filename, contentType, userId', 'Missing required fields for presigned URL');
      }
      
      try {
        const { presignedUrl, s3Key } = await generatePresignedUrl(hash, filename, contentType, userId);
        
        // Generate the public URL for the uploaded image
        const imageUrl = `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${s3Key}`;
        
        return createSuccessResponse(imageUrl, 'Presigned URL generated successfully', {
          presignedUrl, 
          s3Key,
          perceptualHash: hash,
          similarImages: 0
        });
      } catch (error) {
        console.error('[uploadImageHandler] Error generating presigned URL:', error);
        return createErrorResponse(500, 'Failed to generate presigned URL', error.message);
      }
    }

    // --- ROUTE 2: Direct Multipart Upload ---
    if (image && filename) {
      console.log('🔍 [uploadImageHandler] Processing direct multipart upload route');
      
      // Validate userId for direct upload
      if (!userId) {
        console.error('[uploadImageHandler] Missing userId for direct upload');
        return createErrorResponse(400, 'Missing userId for direct upload', 'User ID is required for direct upload');
      }
      
      // Handle multipart image data
      let imageData, finalContentType;
      if (isMultipart && image.data) {
        // Multipart upload - image.data is a Buffer
        imageData = image.data;
        finalContentType = image.contentType || contentType || 'image/jpeg';
        console.log('📤 [uploadImageHandler] Multipart image data:', {
          dataSize: imageData.length,
          contentType: finalContentType,
          filename: image.filename
        });
      } else {
        // Base64 upload (fallback)
        imageData = Buffer.from(image, 'base64');
        finalContentType = contentType || 'image/jpeg';
        console.log('📤 [uploadImageHandler] Base64 image data:', {
          dataSize: imageData.length,
          contentType: finalContentType
        });
      }
      
      // Fix contentType if it's just "image" instead of a proper MIME type
      if (finalContentType === 'image') {
        if (filename.toLowerCase().endsWith('.png')) {
          finalContentType = 'image/png';
        } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
          finalContentType = 'image/jpeg';
        } else if (filename.toLowerCase().endsWith('.gif')) {
          finalContentType = 'image/gif';
        } else if (filename.toLowerCase().endsWith('.webp')) {
          finalContentType = 'image/webp';
        } else {
          finalContentType = 'image/jpeg';
        }
      }
      
      // Generate a unique filename with timestamp and hash
      const timestamp = Date.now();
      const fileExtension = filename.split('.').pop() || 'jpg';
      const uniqueFilename = `${awsConfig.s3.imagesPath}${userId}/${timestamp}_${hash ? hash.substring(0, 8) : 'img'}.${fileExtension}`;
      
      console.log('📤 [uploadImageHandler] S3 upload details:', {
        bucket: awsConfig.bucket,
        key: uniqueFilename,
        contentType: finalContentType,
        dataSize: imageData.length,
        userId: userId
      });
      
      try {
        await s3Client.send(new PutObjectCommand({
          Bucket: awsConfig.bucket,
          Key: uniqueFilename,
          Body: imageData,
          ContentType: finalContentType,
          Metadata: {
            fileHash: hash || '',
            userId: userId,
            uploadTimestamp: timestamp.toString(),
            originalFilename: filename
          }
        }));

        const imageUrl = `https://${awsConfig.bucket}.s3.${awsConfig.region}.amazonaws.com/${uniqueFilename}`;
        console.log('✅ [uploadImageHandler] Direct upload successful:', { 
          imageUrl,
          bucket: awsConfig.bucket,
          region: awsConfig.region,
          key: uniqueFilename,
          fullUrl: imageUrl
        });
        
        // Optionally, you can still log the hash for tracking
        if (hash) {
          try {
            await incrementUploadCount(hash, userId, 'DirectUploader', filename);
          } catch (hashError) {
            console.warn('[uploadImageHandler] Failed to increment upload count:', hashError);
            // Don't fail the upload if hash tracking fails
          }
        }

        return createSuccessResponse(imageUrl, 'Image uploaded successfully', {
          perceptualHash: hash,
          similarImages: 0
        });
      } catch (s3Error) {
        console.error('[uploadImageHandler] S3 upload failed:', s3Error);
        return createErrorResponse(500, 'Failed to upload image to S3', s3Error.message);
      }
    }

    // --- If neither route is matched, return error ---
    console.error('[uploadImageHandler] Route matching failed - neither presigned-url nor direct upload conditions met');
    console.error('[uploadImageHandler] Received fields:', { hasImage: !!image, filename, hasHash: !!hash, uploadMethod });
    return createErrorResponse(400, 'Missing image, filename, or imageHash', 'Invalid request format');

  } catch (error) {
    console.error('❌ [uploadImageHandler] Error:', error);
    return createErrorResponse(500, 'Internal server error', error.message || 'Unknown error occurred');
  }
};

// --- HELPER FUNCTIONS ---

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
    },
  });
  const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
  return { presignedUrl, s3Key, expiresIn: 900 };
};

const incrementUploadCount = async (fileHash, userId, userName, fileName) => {
  try {
    const getCommand = new GetItemCommand({
      TableName: awsConfig.dynamodb.tableName,
      Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
      ProjectionExpression: 'UploadCount',
    });
    const getResult = await dynamoClient.send(getCommand);

    if (getResult.Item) {
      const currentCount = parseInt(getResult.Item.UploadCount?.N || '0', 10);
      const newCount = currentCount + 1;
      const updateCommand = new UpdateItemCommand({
        TableName: awsConfig.dynamodb.tableName,
        Key: { [awsConfig.fields.hashFieldName]: { S: fileHash } },
        UpdateExpression: 'SET UploadCount = :newCount, LastUploaderId = :uid',
        ConditionExpression: 'UploadCount = :currentCount',
        ExpressionAttributeValues: {
          ':newCount': { N: newCount.toString() },
          ':currentCount': { N: currentCount.toString() },
          ':uid': { S: userId },
        },
      });
      await dynamoClient.send(updateCommand);
    } else {
      const putCommand = new PutItemCommand({
        TableName: awsConfig.dynamodb.tableName,
        Item: {
          [awsConfig.fields.hashFieldName]: { S: fileHash },
          UploadCount: { N: '1' },
          LastUploaderId: { S: userId },
          FirstUploaderId: { S: userId },
        },
        ConditionExpression: `attribute_not_exists(${awsConfig.fields.hashFieldName})`,
      });
      await dynamoClient.send(putCommand);
    }
  } catch (error) {
    if (error.name !== 'ConditionalCheckFailedException') {
      console.error("Error incrementing upload count:", error);
    }
  }
};

/**
 * Handles CORS preflight requests.
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

/**
 * Placeholder for confirming presigned URL uploads. Not used in the direct upload flow.
 */
exports.confirmUploadHandler = async (event) => {
  console.log('✅ [confirmUploadHandler] Bypassed for direct base64 upload.');
  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Confirmation step bypassed." }),
  };
}; 