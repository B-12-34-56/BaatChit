require('dotenv').config();

// Debug: Print loaded environment variables
console.log('AWS_ACCESS_KEY_ID:', process.env.AWS_ACCESS_KEY_ID);
console.log('AWS_SECRET_ACCESS_KEY:', process.env.AWS_SECRET_ACCESS_KEY);
console.log('AWS_BUCKET:', process.env.AWS_BUCKET);
console.log('AWS_REGION:', process.env.AWS_REGION);

const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = process.env.PORT || 4000;

// Blocked keywords for filenames
const BLOCKED_KEYWORDS = ['name', 'signature', 'sign', 'signed'];

// Use environment variables for AWS config
const AWS_BUCKET = process.env.AWS_BUCKET;
const AWS_REGION = process.env.AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN; // Optional, for temporary creds
const S3_SUBFOLDER = process.env.S3_SUBFOLDER || 'image-test/';

if (!AWS_BUCKET || !AWS_REGION || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  throw new Error('Missing AWS config in environment variables.');
}

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
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
 *       "Resource": "arn:aws:s3:::2314823894myawsbucket/images/*"
 *     }
 *   ]
 * }
 */

// CORS middleware for local dev
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

function isBlockedFilename(filename) {
  const lower = filename.toLowerCase();
  return BLOCKED_KEYWORDS.some(word => lower.includes(word));
}

app.get('/presign', async (req, res) => {
  const { filename, contentType = 'image/jpeg' } = req.query;
  if (!filename) return res.status(400).json({ error: 'filename required' });
  if (isBlockedFilename(filename)) {
    return res.status(400).json({ error: 'This filename is blocked (contains a forbidden keyword).' });
  }

  // S3 key should match frontend (e.g. image-test/filename)
  const key = `${S3_SUBFOLDER}${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: AWS_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const presignedUrl = await getSignedUrl(s3, command, { expiresIn: 900 }); // 15 min
    res.json({ presignedUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Presign server running on http://localhost:${port}`);
}); 