// ===========================
// BACKEND SERVICE: CheckDuplicate
// ===========================
const express = require('express');
const cors = require('cors');
const AWS = require('aws-sdk');
const imageHash = require('node-image-hash');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Handle large base64 images

// AWS Configuration
const ddb = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

// DynamoDB table for storing perceptual hashes
const HASH_TABLE = 'ImagePerceptualHashes';
const MAX_UPLOADS = 3;

// Configure AWS (use environment variables or IAM roles)
AWS.config.update({
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Main duplicate check endpoint
app.post('/check-duplicate', async (req, res) => {
  try {
    let imageBuffer;
    let originalHash = null;
    
    const { imageData, fileHash, userId } = req.body;
    
    // Option 1: Client sends the image data
    if (imageData) {
      imageBuffer = Buffer.from(imageData, 'base64');
    }
    // Option 2: Client sends S3 key of staged image
    else if (req.body.s3Key && req.body.bucket) {
      const obj = await s3.getObject({
        Bucket: req.body.bucket,
        Key: req.body.s3Key
      }).promise();
      imageBuffer = obj.Body;
    }
    
    // Store original file hash if provided (for logging)
    originalHash = fileHash;
    
    if (!imageBuffer) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    console.log('Processing image for user:', userId);
    
    // Normalize image for consistent hashing
    const normalizedBuffer = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'cover' }) // Normalize size
      .grayscale() // Convert to grayscale
      .toBuffer();
    
    // Compute perceptual hash (dHash)
    const hashResult = await imageHash.hash(normalizedBuffer, 8, 'hex');
    const perceptualHash = hashResult.hash;
    
    console.log('Perceptual hash computed:', perceptualHash);
    
    // Check and update DynamoDB
    const updateParams = {
      TableName: process.env.HASH_TABLE,
      Key: { perceptualHash: perceptualHash },
      UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc, lastUpload = :timestamp, #uploads = list_append(if_not_exists(#uploads, :empty), :upload)',
      ExpressionAttributeNames: { 
        '#count': 'uploadCount',
        '#uploads': 'uploadHistory'
      },
      ExpressionAttributeValues: { 
        ':zero': 0, 
        ':inc': 1, 
        ':max': MAX_UPLOADS,
        ':timestamp': new Date().toISOString(),
        ':empty': [],
        ':upload': [{
          timestamp: new Date().toISOString(),
          originalHash: originalHash,
          userId: userId || 'anonymous'
        }]
      },
      ConditionExpression: 'attribute_not_exists(#count) OR #count < :max',
      ReturnValues: 'ALL_NEW'
    };
    
    try {
      const result = await ddb.update(updateParams).promise();
      const newCount = result.Attributes.uploadCount;
      
      // Generate pre-signed URL for upload
      const uploadKey = `images/${perceptualHash}_${Date.now()}.jpg`;
      const uploadUrl = await s3.getSignedUrlPromise('putObject', {
        Bucket: process.env.S3_BUCKET,
        Key: uploadKey,
        Expires: 300,
        ContentType: 'image/jpeg'
      });
      
      console.log(`✅ Upload allowed for hash ${perceptualHash}, count: ${newCount}`);
      
      return res.json({
        allowed: true,
        uploadUrl: uploadUrl,
        perceptualHash: perceptualHash,
        uploadCount: newCount,
        isDuplicate: newCount > 1,
        message: newCount === 2 ? 'Warning: This image has been uploaded twice' : 'Upload allowed'
      });
      
    } catch (err) {
      if (err.code === 'ConditionalCheckFailedException') {
        // Upload limit reached
        console.log('Upload blocked - limit reached for hash:', perceptualHash);
        
        return res.status(409).json({
          allowed: false,
          perceptualHash: perceptualHash,
          uploadCount: MAX_UPLOADS,
          isDuplicate: true,
          message: `Upload blocked: This image has already been uploaded ${MAX_UPLOADS} times`
        });
      }
      throw err;
    }
    
  } catch (error) {
    console.error('Error processing duplicate check:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Test endpoint for debugging
app.post('/test-hash', async (req, res) => {
  try {
    const { imageData } = req.body;
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    const imageBuffer = Buffer.from(imageData, 'base64');
    const normalizedBuffer = await sharp(imageBuffer)
      .resize(256, 256, { fit: 'cover' })
      .grayscale()
      .toBuffer();
    
    const hashResult = await imageHash.hash(normalizedBuffer, 8, 'hex');
    
    res.json({
      perceptualHash: hashResult.hash,
      originalSize: imageBuffer.length,
      normalizedSize: normalizedBuffer.length
    });
  } catch (error) {
    console.error('Test hash error:', error);
    res.status(500).json({ error: 'Hash computation failed' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Duplicate check service running on port ${PORT}`);
  console.log(`📊 DynamoDB Table: ${HASH_TABLE}`);
  console.log(`🪣 S3 Bucket: ${process.env.S3_BUCKET}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app; 