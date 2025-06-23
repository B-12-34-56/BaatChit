// AWS Lambda Handler for Bundi Presign URL Generation
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// AWS Configuration - Use environment variables
const awsConfig = {
  bucket: process.env.AWS_BUCKET || 'YOUR_S3_BUCKET_NAME',
  region: process.env.AWS_REGION || 'us-east-1',
  s3ImagesPath: 'images/',
}; 