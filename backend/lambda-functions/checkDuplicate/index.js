// ===========================
// PURE AWS LAMBDA: CheckDuplicate with Perceptual Hashing
// ===========================
// NO Firebase dependencies - runs entirely on AWS

const { DynamoDBClient, QueryCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { S3Client, DeleteObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const { generateRobustHash, compareHashes, binaryToHex } = require('./imageHash');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const crypto = require('crypto');

// AWS Configuration - Use environment variables
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  s3: {
    bucketName: process.env.S3_BUCKET || 'YOUR_S3_BUCKET_NAME',
    baseURL: process.env.S3_BASE_URL || 'YOUR_S3_BASE_URL',
  },
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE || 'YOUR_DYNAMODB_TABLE',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  api: {
    uploadUrl: process.env.UPLOAD_API_URL || 'YOUR_UPLOAD_API_URL',
    uploadKey: process.env.UPLOAD_API_KEY || 'YOUR_UPLOAD_API_KEY',
    blockUrl: process.env.BLOCK_API_URL || 'YOUR_BLOCK_API_URL',
    blockKey: process.env.BLOCK_API_KEY || 'YOUR_BLOCK_API_KEY',
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

// AWS Services - NO Firebase
const dynamoClient = new DynamoDBClient({ region: awsConfig.dynamodb.region });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: awsConfig.region });

// Configuration
const IMAGES_TABLE = awsConfig.dynamodb.tableName;
const MAX_UPLOADS = 3;
const SIMILARITY_THRESHOLD = 25;

// API Keys
const UPLOAD_KEY = awsConfig.api.uploadKey;
const BLOCK_KEY = awsConfig.api.blockKey;
const CHECK_DUPLICATE_KEY = awsConfig.api.uploadKey;
const S3_BUCKET = awsConfig.s3.bucketName;

// ===========================
// CROSS-DEVICE DUPLICATE DETECTION
// ===========================

/**
 * Find similar images across devices using enhanced perceptual hashing
 */
async function findSimilarImages(hashData, threshold = SIMILARITY_THRESHOLD) {
  try {
    const params = {
      TableName: IMAGES_TABLE
    };
    
    const result = await dynamodb.send(new ScanCommand(params));
    const similar = [];
    
    console.log(`🔍 Scanning ${result.Items.length} images for similarities...`);
    
    for (const item of result.Items) {
      if (item.perceptualHash !== hashData.perceptualHash) {
        // Create hash object for comparison
        const existingHashData = {
          perceptualHash: item.perceptualHash,
          averageHash: item.averageHash,
          dctHash: item.dctHash,
          colorHash: item.colorHash
        };
        
        const comparison = compareHashes(hashData, existingHashData, threshold);
        if (comparison.isSimilar) {
          similar.push({
            hash: item.perceptualHash,
            distance: comparison.distance,
            uploadCount: item.uploadCount || 0,
            firstUpload: item.firstUpload,
            lastUpload: item.lastUpload
          });
          
          console.log(`🎯 Found similar image: ${item.perceptualHash.substring(0, 16)}... (distance: ${comparison.distance})`);
        }
      }
    }
    
    console.log(`✅ Found ${similar.length} similar images`);
    return similar;
  } catch (error) {
    console.error('Error finding similar images:', error);
    return [];
  }
}

/**
 * Calculate total upload count including similar images
 */
async function calculateTotalUploadCount(hashData, baseCount = 0) {
  try {
    const similarImages = await findSimilarImages(hashData, SIMILARITY_THRESHOLD);
    
    let totalCount = baseCount;
    const similarDetails = [];
    
    for (const similar of similarImages) {
      totalCount += similar.uploadCount;
      similarDetails.push({
        hash: similar.hash,
        distance: similar.distance,
        uploadCount: similar.uploadCount
      });
    }
    
    console.log(`📊 Total upload count: ${totalCount} (base: ${baseCount}, similar: ${totalCount - baseCount})`);
    
    return {
      totalCount,
      similarCount: similarImages.length,
      similarDetails
    };
  } catch (error) {
    console.error('Error calculating total upload count:', error);
    return {
      totalCount: baseCount,
      similarCount: 0,
      similarDetails: []
    };
  }
}

// ===========================
// AWS LAMBDA HANDLER
// ===========================

exports.handler = async (event) => {
  console.log('🔍 [checkDuplicate] Lambda processing image upload');
  console.log('🔍 [checkDuplicate] Event:', JSON.stringify(event, null, 2));
  
  try {
    let imageBuffer, userId, fileName, fileHash;
    
    // Extract fields from the request
    const { imageData, fileHash: eventFileHash, userId: eventUserId, fileName: eventFileName } = event.body ? JSON.parse(event.body) : event;
    
    console.log('🔍 [checkDuplicate] Extracted fields:', {
      hasImageData: !!imageData,
      imageDataLength: imageData ? imageData.length : 0,
      fileHash: eventFileHash?.substring(0, 12) + '...',
      userId: eventUserId,
      fileName: eventFileName
    });
    
    // Validate required fields
    if (!imageData || !eventUserId || !eventFileName) {
      console.error('❌ [checkDuplicate] Missing required fields:', { 
        hasImageData: !!imageData, 
        userId: eventUserId, 
        fileName: eventFileName 
      });
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          success: false,
          blocked: false,
          totalCount: 0,
          uploadCount: 0,
          imageUrl: null,
          perceptualHash: null,
          similarImages: [],
          message: 'Missing required fields'
        })
      };
    }
    
    imageBuffer = Buffer.from(imageData, 'base64');
    userId = eventUserId;
    fileName = eventFileName;
    fileHash = eventFileHash; // Use the hash provided by client
    
    // Generate enhanced perceptual hash (visual fingerprint)
    console.log('🔍 [checkDuplicate] Generating robust perceptual hash...');
    const hashData = await generateRobustHash(imageBuffer);
    const perceptualHash = hashData.perceptualHash; // This is already in hex format
    
    console.log('✅ [checkDuplicate] Perceptual hash generated:', {
      perceptualHash: perceptualHash.substring(0, 16) + '...',
      averageHashLength: hashData.averageHash?.length || 0,
      dctHashLength: hashData.dctHash?.length || 0,
      colorHashLength: hashData.colorHash?.length || 0
    });
    
    // Check if this exact image already exists
    const existingItem = await dynamodb.send(new GetCommand({
      TableName: IMAGES_TABLE,
      Key: { perceptualHash: perceptualHash }
    }));
    
    let uploadCount = 0;
    let blocked = false;
    let message = 'Upload allowed';
    let similarImages = [];
    let imageUrl = null;
    
    if (existingItem.Item) {
      // Exact image already exists - check count
      uploadCount = existingItem.Item.uploadCount || 0;
      
      // Calculate total count including similar images
      const totalCountData = await calculateTotalUploadCount(hashData, uploadCount);
      
      if (totalCountData.totalCount >= MAX_UPLOADS) {
        blocked = true;
        message = `This image (or similar versions) has been uploaded ${totalCountData.totalCount} times. Maximum allowed: ${MAX_UPLOADS}.`;
        similarImages = totalCountData.similarDetails;
        
        // If S3 triggered and blocked, delete the file
        if (event.Records) {
          const s3Event = event.Records[0].s3;
          await s3Client.send(new DeleteObjectCommand({
            Bucket: s3Event.bucket.name || S3_BUCKET,
            Key: decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '))
          }));
          console.log('🗑️ Deleted blocked image from S3');
        }
      } else {
        // Increment count for exact match
        await dynamodb.send(new UpdateCommand({
          TableName: IMAGES_TABLE,
          Key: { perceptualHash: perceptualHash },
          UpdateExpression: 'SET uploadCount = uploadCount + :inc, lastUpload = :time, uploads = list_append(uploads, :upload)',
          ExpressionAttributeValues: {
            ':inc': 1,
            ':time': new Date().toISOString(),
            ':upload': [{
              userId: userId,
              fileName: fileName,
              timestamp: new Date().toISOString()
            }]
          }
        }));
        
        uploadCount++;
        message = `Image uploaded successfully. This exact image has now been uploaded ${uploadCount} time(s).`;
        similarImages = totalCountData.similarDetails;
      }
    } else {
      // New image - check for similar images first
      const totalCountData = await calculateTotalUploadCount(hashData, 0);
      
      if (totalCountData.totalCount >= MAX_UPLOADS) {
        blocked = true;
        message = `Similar images have been uploaded ${totalCountData.totalCount} times. Maximum allowed: ${MAX_UPLOADS}.`;
        similarImages = totalCountData.similarDetails;
        
        // If S3 triggered and blocked, delete the file
        if (event.Records) {
          const s3Event = event.Records[0].s3;
          await s3Client.send(new DeleteObjectCommand({
            Bucket: s3Event.bucket.name || S3_BUCKET,
            Key: decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '))
          }));
          console.log('🗑️ Deleted blocked image from S3');
        }
      } else {
        // Store all hash components in DynamoDB
        await dynamodb.send(new PutCommand({
          TableName: IMAGES_TABLE,
          Item: {
            perceptualHash: perceptualHash,
            fileHash: fileHash, // SHA-256 from client
            averageHash: hashData.averageHash,
            dctHash: hashData.dctHash,
            colorHash: hashData.colorHash,
            uploadCount: 1,
            firstUpload: new Date().toISOString(),
            lastUpload: new Date().toISOString(),
            uploads: [{
              userId: userId,
              fileName: fileName,
              timestamp: new Date().toISOString()
            }]
          }
        }));
        
        uploadCount = 1;
        message = 'New image uploaded successfully.';
        similarImages = totalCountData.similarDetails;
      }
    }
    
    // Calculate total count for response
    const totalCount = uploadCount + similarImages.reduce((sum, img) => sum + (img.uploadCount || 0), 0);
    
    console.log('✅ [checkDuplicate] Processing complete:', {
      blocked,
      uploadCount,
      totalCount,
      similarImages: similarImages.length,
      message
    });
    
    // For API Gateway response
    if (event.httpMethod === 'POST') {
      if (blocked) {
        return {
          statusCode: 409,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: false,
            blocked: true,
            totalCount: totalCount,
            uploadCount: uploadCount,
            imageUrl: null,
            perceptualHash: perceptualHash,
            similarImages: similarImages,
            message: message
          })
        };
      } else {
        // Direct upload to S3 (since we have the image data)
        const uploadKey = `images/${userId}/${perceptualHash}_${Date.now()}.jpg`;
        
        try {
          // Upload the image directly to S3
          await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET,
            Key: uploadKey,
            Body: imageBuffer,
            ContentType: 'image/jpeg',
            Metadata: {
              fileHash: fileHash || '',
              userId: userId || 'anonymous',
              uploadTimestamp: Date.now().toString(),
              originalFilename: fileName,
              perceptualHash: perceptualHash,
              uploadKey: UPLOAD_KEY,
              blockKey: BLOCK_KEY
            }
          }));
          
          console.log('✅ [checkDuplicate] Image uploaded to S3:', uploadKey);
          
          // Generate public URL for the uploaded image
          imageUrl = `https://${S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uploadKey}`;
          
          if (!imageUrl) {
            console.warn('[Lambda] No imageUrl set for key', { fileName });
            return {
              statusCode: 500,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
              },
              body: JSON.stringify({
                success: false,
                error: 'Image upload failed: no imageUrl returned',
                message: 'Lambda did not return an imageUrl',
                imageUrl: null
              })
            };
          }
          
          return {
            statusCode: 200,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: true,
              blocked: false,
              totalCount: totalCount,
              uploadCount: uploadCount,
              imageUrl: imageUrl,
              perceptualHash: perceptualHash,
              similarImages: similarImages,
              message: message
            })
          };
        } catch (uploadError) {
          console.error('❌ [checkDuplicate] S3 upload failed:', uploadError);
          return {
            statusCode: 500,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
              success: false,
              blocked: false,
              totalCount: 0,
              uploadCount: 0,
              imageUrl: null,
              perceptualHash: null,
              similarImages: [],
              message: 'Failed to upload image to S3'
            })
          };
        }
      }
    }
    
    // For S3 trigger - return success with proper format
    return { 
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        blocked: blocked,
        totalCount: totalCount,
        uploadCount: uploadCount,
        imageUrl: imageUrl,
        message: message
      })
    };
    
  } catch (error) {
    console.error('❌ [checkDuplicate] Lambda error:', error);
    return {
      statusCode: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        success: false,
        blocked: false,
        totalCount: 0,
        uploadCount: 0,
        imageUrl: null,
        perceptualHash: null,
        similarImages: [],
        message: `Error: ${error.message || 'Unknown error occurred'}`
      })
    };
  }
};

// ===========================
// ADDITIONAL FUNCTIONS
// ===========================

/**
 * Get upload statistics for an image including similar images
 */
exports.getImageStats = async (event) => {
  const { perceptualHash } = JSON.parse(event.body || '{}');
  
  if (!perceptualHash) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'perceptualHash required' })
    };
  }
  
  try {
    const result = await dynamodb.send(new GetCommand({
      TableName: IMAGES_TABLE,
      Key: { perceptualHash: perceptualHash }
    }));
    
    if (!result.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Image not found' })
      };
    }
    
    // Create hash data object for similarity search
    const hashData = {
      perceptualHash: result.Item.perceptualHash,
      averageHash: result.Item.averageHash,
      dctHash: result.Item.dctHash,
      colorHash: result.Item.colorHash
    };
    
    // Find similar images
    const similarImages = await findSimilarImages(hashData, SIMILARITY_THRESHOLD);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        perceptualHash: perceptualHash,
        uploadCount: result.Item.uploadCount,
        firstUpload: result.Item.firstUpload,
        lastUpload: result.Item.lastUpload,
        uploads: result.Item.uploads,
        similarImages: similarImages,
        totalSimilarCount: similarImages.reduce((sum, img) => sum + img.uploadCount, 0)
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 