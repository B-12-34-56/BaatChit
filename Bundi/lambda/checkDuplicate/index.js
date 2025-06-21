// ===========================
// PURE AWS LAMBDA: CheckDuplicate with Perceptual Hashing
// ===========================
// NO Firebase dependencies - runs entirely on AWS

const AWS = require('aws-sdk');
const sharp = require('sharp');
const { generateRobustHash, compareHashes, binaryToHex } = require('./imageHash');

// AWS Configuration with proper region
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1'
});

// AWS Services - NO Firebase
const dynamodb = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION || 'us-east-1'
});
const s3 = new AWS.S3({
  region: process.env.AWS_REGION || 'us-east-1'
});

// Configuration
const IMAGES_TABLE = process.env.IMAGES_TABLE || 'ImageSignatures';
const MAX_UPLOADS = parseInt(process.env.MAX_UPLOADS || '3');
const SIMILARITY_THRESHOLD = parseInt(process.env.SIMILARITY_THRESHOLD || '25');

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
    
    const result = await dynamodb.scan(params).promise();
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
  console.log('AWS Lambda processing image upload');
  
  try {
    let imageBuffer, userId, fileName, fileHash;
    
    // Handle API Gateway request (pre-upload check)
    if (event.httpMethod === 'POST') {
      const body = JSON.parse(event.body);
      
      if (!body.imageData) {
        return {
          statusCode: 400,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({ 
            error: 'No image data provided',
            success: false,
            blocked: false,
            totalCount: 0,
            uploadCount: 0,
            imageUrl: null,
            perceptualHash: null,
            similarImages: 0,
            message: 'No image data provided'
          })
        };
      }
      
      imageBuffer = Buffer.from(body.imageData, 'base64');
      userId = body.userId || 'anonymous';
      fileName = body.fileName || 'unnamed.jpg';
      fileHash = body.fileHash || null; // SHA-256 from client
    }
    // Handle S3 trigger (post-upload processing)
    else if (event.Records && event.Records[0].s3) {
      const s3Event = event.Records[0].s3;
      const bucket = s3Event.bucket.name;
      const key = decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '));
      
      // Download image from S3
      const s3Object = await s3.getObject({ Bucket: bucket, Key: key }).promise();
      imageBuffer = s3Object.Body;
      userId = s3Object.Metadata?.userid || 'anonymous';
      fileName = key;
      fileHash = s3Object.Metadata?.filehash || null;
    }
    else {
      return {
        statusCode: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ 
          error: 'Invalid event type',
          success: false,
          blocked: false,
          totalCount: 0,
          uploadCount: 0,
          imageUrl: null,
          perceptualHash: null,
          similarImages: 0,
          message: 'Invalid event type'
        })
      };
    }
    
    // Generate enhanced perceptual hash (visual fingerprint)
    console.log('🔍 Generating robust perceptual hash...');
    const hashData = await generateRobustHash(imageBuffer);
    const perceptualHash = hashData.perceptualHash; // This is already in hex format
    
    console.log('✅ Perceptual hash generated:', {
      perceptualHash: perceptualHash.substring(0, 16) + '...',
      averageHashLength: hashData.averageHash?.length || 0,
      dctHashLength: hashData.dctHash?.length || 0,
      colorHashLength: hashData.colorHash?.length || 0
    });
    
    // Check if this exact image already exists
    const existingItem = await dynamodb.get({
      TableName: IMAGES_TABLE,
      Key: { perceptualHash: perceptualHash }
    }).promise();
    
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
          await s3.deleteObject({
            Bucket: s3Event.bucket.name,
            Key: decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '))
          }).promise();
          console.log('🗑️ Deleted blocked image from S3');
        }
      } else {
        // Increment count for exact match
        await dynamodb.update({
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
        }).promise();
        
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
          await s3.deleteObject({
            Bucket: s3Event.bucket.name,
            Key: decodeURIComponent(s3Event.object.key.replace(/\+/g, ' '))
          }).promise();
          console.log('🗑️ Deleted blocked image from S3');
        }
      } else {
        // Store all hash components in DynamoDB
        await dynamodb.put({
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
        }).promise();
        
        uploadCount = 1;
        message = 'New image uploaded successfully.';
        similarImages = totalCountData.similarDetails;
      }
    }
    
    // Calculate total count for response
    const totalCount = uploadCount + similarImages.reduce((sum, img) => sum + (img.uploadCount || 0), 0);
    
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
            totalCount: totalCount || 0,
            uploadCount: uploadCount || 0,
            imageUrl: null,
            perceptualHash: perceptualHash || null,
            similarImages: similarImages.length || 0,
            message: message || 'Image blocked'
          })
        };
      } else {
        // Generate pre-signed URL for upload
        const uploadKey = `images/${perceptualHash}_${Date.now()}.jpg`;
        const uploadUrl = await s3.getSignedUrlPromise('putObject', {
          Bucket: process.env.S3_BUCKET || 'YOUR_S3_BUCKET_NAME',
          Key: uploadKey,
          Expires: 300,
          ContentType: 'image/jpeg'
        });
        
        // Generate public URL for the uploaded image
        imageUrl = `https://${process.env.S3_BUCKET || 'YOUR_S3_BUCKET_NAME'}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${uploadKey}`;
        
        return {
          statusCode: 200,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          },
          body: JSON.stringify({
            success: true,
            blocked: false,
            totalCount: totalCount || 1,
            uploadCount: uploadCount || 1,
            imageUrl: imageUrl || null,
            uploadUrl: uploadUrl || null,
            perceptualHash: perceptualHash || null,
            similarImages: similarImages.length || 0,
            message: message || 'Upload successful'
          })
        };
      }
    }
    
    // For S3 trigger - return success with proper format
    return { 
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        blocked: blocked || false,
        totalCount: totalCount || 0,
        uploadCount: uploadCount || 0,
        imageUrl: imageUrl || null,
        perceptualHash: perceptualHash || null,
        similarImages: similarImages.length || 0,
        message: message || 'Processing complete'
      })
    };
    
  } catch (error) {
    console.error('Lambda error:', error);
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
        similarImages: 0,
        error: 'Internal server error',
        message: error.message || 'Unknown error occurred'
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
    const result = await dynamodb.get({
      TableName: IMAGES_TABLE,
      Key: { perceptualHash: perceptualHash }
    }).promise();
    
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
        uploadCount: result.Item.uploadCount || 0,
        firstUpload: result.Item.firstUpload || null,
        lastUpload: result.Item.lastUpload || null,
        uploads: result.Item.uploads || [],
        similarImages: similarImages || [],
        totalSimilarCount: similarImages.reduce((sum, img) => sum + (img.uploadCount || 0), 0) || 0
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
}; 