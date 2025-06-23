require('dotenv').config();

// Debug: Print loaded environment variables
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY);
console.log('AWS_BUCKET:', process.env.AWS_BUCKET);
console.log('AWS_REGION:', process.env.AWS_REGION);

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
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

// Initialize Lambda client
const lambda = new LambdaClient({
  region: awsConfig.region,
  credentials: {
    accessKeyId: awsConfig.accessKeyId,
    secretAccessKey: awsConfig.secretAccessKey,
  },
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

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

// New endpoint to handle check-duplicate Lambda function calls
app.post('/check-duplicate', async (req, res) => {
  try {
    console.log('🔍 [presign-server] Check duplicate request received:', {
      hasImageData: !!req.body.imageData,
      imageDataLength: req.body.imageData?.length || 0,
      fileHash: req.body.fileHash?.substring(0, 12) + '...',
      userId: req.body.userId,
      fileName: req.body.fileName
    });

    // Prepare payload for Lambda
    const lambdaPayload = {
      httpMethod: 'POST',
      body: JSON.stringify(req.body),
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Call the check-duplicate Lambda function
    const command = new InvokeCommand({
      FunctionName: 'check-duplicate',
      Payload: JSON.stringify(lambdaPayload),
      InvocationType: 'RequestResponse'
    });

    console.log('🚀 [presign-server] Invoking Lambda function: check-duplicate');
    const lambdaResponse = await lambda.send(command);
    
    // Parse Lambda response
    const responsePayload = JSON.parse(Buffer.from(lambdaResponse.Payload).toString());
    
    console.log('✅ [presign-server] Lambda response:', {
      statusCode: responsePayload.statusCode,
      success: responsePayload.body ? JSON.parse(responsePayload.body).success : false,
      blocked: responsePayload.body ? JSON.parse(responsePayload.body).blocked : false
    });

    // Return the Lambda response to the client
    res.status(responsePayload.statusCode || 200).json(
      responsePayload.body ? JSON.parse(responsePayload.body) : responsePayload
    );

  } catch (error) {
    console.error('❌ [presign-server] Error calling Lambda:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check for duplicates',
      message: error.message
    });
  }
});

app.get('/presign', async (req, res) => {
  const { filename, contentType = 'image/jpeg' } = req.query;
  if (!filename) return res.status(400).json({ error: 'filename required' });
  if (isBlockedFilename(filename)) {
    return res.status(400).json({ error: 'This filename is blocked (contains a forbidden keyword).' });
  }

  // S3 key should match frontend (e.g. image-test/filename)
  const key = `${awsConfig.s3ImagesPath}${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: awsConfig.bucket,
      Key: key,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 }); // 15 min
    res.json({ presignedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Presign server running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /presign - Get presigned URL for S3 upload');
  console.log('  POST /check-duplicate - Check for duplicate images via Lambda');
}); 