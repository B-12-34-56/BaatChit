// ENV VARS NEEDED:
// AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
require('dotenv').config();

// Debug: Print loaded environment variables
console.log('AWS config loaded from environment variables');

const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 4000;

// Blocked keywords for filenames
const BLOCKED_KEYWORDS = ['name', 'signature', 'sign', 'signed'];

// AWS Configuration - Use environment variables
const awsConfig = {
  bucket: process.env.AWS_BUCKET || 'YOUR_S3_BUCKET_NAME',
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'YOUR_AWS_ACCESS_KEY_ID',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'YOUR_AWS_SECRET_ACCESS_KEY',
  s3ImagesPath: 'images/',
};

console.log('🔧 Presign server configuration:', {
  region: awsConfig.region,
  bucket: awsConfig.bucket,
  hasAccessKey: !!awsConfig.accessKeyId,
  hasSecretKey: !!awsConfig.secretAccessKey,
  subfolder: awsConfig.s3ImagesPath
});

const s3Client = new S3Client({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  }
});

/**
 * IAM Policy (UploadToS3) required for S3 uploads:
 * {
 *   "Version": "2012-10-17",
 *   "Statement": [
 *     {
 *       "Sid": "UploadToS3",
 *       "Effect": "Allow",
 *       "Action": "s3:PutObject",
 *       "Resource": "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*"
 *     }
 *   ]
 * }
 */

// CORS middleware for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Parse JSON bodies
app.use(express.json());

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

// POST endpoint for presigned URL generation (recommended)
app.post('/presign', async (req, res) => {
  const { filename, contentType = 'image/jpeg', method = 'post' } = req.body;
  
  console.log('📤 Presign POST request:', { filename, contentType, method });
  
  if (!filename) {
    return res.status(400).json({ error: 'filename required' });
  }
  
  if (isBlockedFilename(filename)) {
    return res.status(400).json({ error: 'This filename is blocked (contains a forbidden keyword).' });
  }

  // Generate unique S3 key with timestamp
  const timestamp = Date.now();
  const fileExtension = filename.split('.').pop() || 'jpg';
  const uniqueFilename = `${timestamp}_${filename}`;
  const s3Key = `${awsConfig.s3ImagesPath}${uniqueFilename}`;

  try {
    if (method === 'put') {
      // PUT method - direct upload
      const command = new PutObjectCommand({
        Bucket: awsConfig.bucket,
        Key: s3Key,
        ContentType: contentType,
        ACL: 'public-read',
      });
      
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      
      console.log('✅ PUT Presigned URL generated:', {
        key: s3Key,
        expiresIn: '15 minutes',
        urlPreview: presignedUrl.substring(0, 50) + '...'
      });
      
      res.json({ 
        method: 'put',
        uploadUrl: presignedUrl,
        uploadFields: {},
        s3Key: s3Key,
        bucket: awsConfig.bucket,
        expiresIn: 900
      });
    } else {
      // POST method - multipart form upload (recommended)
      const command = new PutObjectCommand({
        Bucket: awsConfig.bucket,
        Key: s3Key,
        ContentType: contentType,
        ACL: 'public-read',
      });
      
      const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
      
      // For POST, we need to provide the form fields
      const uploadFields = {
        'Content-Type': contentType,
        'key': s3Key,
        'bucket': awsConfig.bucket,
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': `${awsConfig.accessKeyId}/${new Date().toISOString().slice(0, 10)}/${awsConfig.region}/s3/aws4_request`,
        'X-Amz-Date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''),
        'Policy': process.env.S3_POLICY || 'YOUR_S3_POLICY',
        'X-Amz-Signature': process.env.S3_SIGNATURE || 'YOUR_S3_SIGNATURE'
      };
      
      console.log('✅ POST Presigned URL generated:', {
        key: s3Key,
        expiresIn: '15 minutes',
        urlPreview: presignedUrl.substring(0, 50) + '...',
        hasFields: !!uploadFields
      });
      
      res.json({ 
        method: 'post',
        uploadUrl: presignedUrl,
        uploadFields: uploadFields,
        s3Key: s3Key,
        bucket: awsConfig.bucket,
        expiresIn: 900
      });
    }
  } catch (err) {
    console.error('❌ Presign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Keep GET endpoint for backward compatibility
app.get('/presign', async (req, res) => {
  const { filename, contentType = 'image/jpeg' } = req.query;
  
  console.log('📤 Presign GET request:', { filename, contentType });
  
  if (!filename) {
    return res.status(400).json({ error: 'filename required' });
  }
  
  if (isBlockedFilename(filename)) {
    return res.status(400).json({ error: 'This filename is blocked (contains a forbidden keyword).' });
  }

  // S3 key should match frontend (e.g. images/filename)
  const key = `${awsConfig.s3ImagesPath}${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read', // Make uploaded files publicly readable
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min
    
    console.log('✅ Presigned URL generated (GET):', {
      key: key,
      expiresIn: '15 minutes',
      urlPreview: presignedUrl.substring(0, 50) + '...'
    });
    
    res.json({ 
      presignedUrl,
      key: key,
      bucket: awsConfig.bucket,
      expiresIn: 900
    });
  } catch (err) {
    console.error('❌ Presign error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    config: {
      region: awsConfig.region,
      bucket: awsConfig.bucket,
      subfolder: awsConfig.s3ImagesPath
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Presign server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`📤 Presign POST endpoint: http://localhost:${PORT}/presign`);
  console.log(`📤 Presign GET endpoint: http://localhost:${PORT}/presign?filename=test.jpg&contentType=image/jpeg`);
}); 