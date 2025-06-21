// ENV VARS NEEDED:
// AWS_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
require('dotenv').config();

// Debug: Print loaded environment variables
console.log('AWS config loaded from environment variables');

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = process.env.PORT || 4000;

// Blocked keywords for filenames
const BLOCKED_KEYWORDS = ['name', 'signature', 'sign', 'signed'];

// AWS Configuration - using the same credentials as your React Native app
const AWS_CONFIG = {
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || "YOUR_ACCESS_KEY_ID",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "YOUR_SECRET_ACCESS_KEY",
  sessionToken: process.env.AWS_SESSION_TOKEN || "YOUR_SESSION_TOKEN",
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_BUCKET || "YOUR_S3_BUCKET_NAME"
};

const S3_SUBFOLDER = process.env.S3_SUBFOLDER || 'images/';

console.log('🔧 Presign server configuration:', {
  region: AWS_CONFIG.region,
  bucket: AWS_CONFIG.bucket,
  hasAccessKey: !!AWS_CONFIG.accessKeyId,
  hasSecretKey: !!AWS_CONFIG.secretAccessKey,
  subfolder: S3_SUBFOLDER
});

const s3Client = new S3Client({
  region: AWS_CONFIG.region,
  credentials: {
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
    sessionToken: AWS_CONFIG.sessionToken,
  },
  bucket: AWS_CONFIG.bucket
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

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

app.get('/presign', async (req, res) => {
  const { filename, contentType = 'image/jpeg' } = req.query;
  
  console.log('📤 Presign request:', { filename, contentType });
  
  if (!filename) {
    return res.status(400).json({ error: 'filename required' });
  }
  
  if (isBlockedFilename(filename)) {
    return res.status(400).json({ error: 'This filename is blocked (contains a forbidden keyword).' });
  }

  // S3 key should match frontend (e.g. images/filename)
  const key = `${S3_SUBFOLDER}${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: AWS_CONFIG.bucket,
      Key: key,
      ContentType: contentType,
      ACL: 'public-read', // Make uploaded files publicly readable
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min
    
    console.log('✅ Presigned URL generated:', {
      key: key,
      expiresIn: '15 minutes',
      urlPreview: presignedUrl.substring(0, 50) + '...'
    });
    
    res.json({ 
      presignedUrl,
      key: key,
      bucket: AWS_CONFIG.bucket,
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
      region: AWS_CONFIG.region,
      bucket: AWS_CONFIG.bucket,
      subfolder: S3_SUBFOLDER
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Presign server running on http://localhost:${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`📤 Presign endpoint: http://localhost:${port}/presign?filename=test.jpg&contentType=image/jpeg`);
}); 