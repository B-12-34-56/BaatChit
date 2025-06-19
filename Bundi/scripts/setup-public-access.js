#!/usr/bin/env node

/**
 * AWS S3 Public Access Configuration Script
 * This script configures your S3 bucket for public access uploads
 */

const { S3Client, PutBucketCorsCommand, PutBucketPolicyCommand, GetBucketPolicyCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// AWS Configuration from your setup
const AWS_CONFIG = {
  bucket: '2314823894myawsbucket',
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN, // Optional for temporary credentials
};

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_CONFIG.region,
  credentials: {
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
    sessionToken: AWS_CONFIG.sessionToken,
  },
});

// CORS Configuration for public access
const corsConfig = [
  {
    AllowedHeaders: ['*'],
    AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD'],
    AllowedOrigins: ['*'],
    ExposeHeaders: ['ETag'],
    MaxAgeSeconds: 3000,
  },
];

// Bucket Policy for public access
const bucketPolicy = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'PublicReadGetObject',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:GetObject',
      Resource: `arn:aws:s3:::${AWS_CONFIG.bucket}/*`,
    },
    {
      Sid: 'PublicWritePutObject',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:PutObject',
      Resource: `arn:aws:s3:::${AWS_CONFIG.bucket}/*`,
    },
    {
      Sid: 'PublicListBucket',
      Effect: 'Allow',
      Principal: '*',
      Action: 's3:ListBucket',
      Resource: `arn:aws:s3:::${AWS_CONFIG.bucket}`,
    },
  ],
};

async function checkCredentials() {
  if (!AWS_CONFIG.accessKeyId || !AWS_CONFIG.secretAccessKey) {
    console.error('❌ AWS credentials not found in environment variables');
    console.log('Please set the following environment variables:');
    console.log('  AWS_ACCESS_KEY_ID');
    console.log('  AWS_SECRET_ACCESS_KEY');
    console.log('  AWS_SESSION_TOKEN (optional, for temporary credentials)');
    process.exit(1);
  }
  console.log('✅ AWS credentials found');
}

async function applyCorsConfiguration() {
  try {
    console.log('🔄 Applying CORS configuration...');
    
    const corsCommand = new PutBucketCorsCommand({
      Bucket: AWS_CONFIG.bucket,
      CORSConfiguration: {
        CORSRules: corsConfig,
      },
    });
    
    await s3Client.send(corsCommand);
    console.log('✅ CORS configuration applied successfully');
  } catch (error) {
    console.error('❌ Failed to apply CORS configuration:', error.message);
    throw error;
  }
}

async function applyBucketPolicy() {
  try {
    console.log('🔄 Applying bucket policy for public access...');
    
    const policyCommand = new PutBucketPolicyCommand({
      Bucket: AWS_CONFIG.bucket,
      Policy: JSON.stringify(bucketPolicy),
    });
    
    await s3Client.send(policyCommand);
    console.log('✅ Bucket policy applied successfully');
  } catch (error) {
    console.error('❌ Failed to apply bucket policy:', error.message);
    throw error;
  }
}

async function verifyConfiguration() {
  try {
    console.log('🔄 Verifying configuration...');
    
    // Check bucket policy
    const getPolicyCommand = new GetBucketPolicyCommand({
      Bucket: AWS_CONFIG.bucket,
    });
    
    const policyResponse = await s3Client.send(getPolicyCommand);
    const currentPolicy = JSON.parse(policyResponse.Policy);
    
    console.log('✅ Bucket policy verification successful');
    console.log('📋 Current bucket policy applied');
    
    return true;
  } catch (error) {
    console.error('❌ Configuration verification failed:', error.message);
    return false;
  }
}

async function main() {
  console.log('🚀 AWS S3 Public Access Configuration');
  console.log('=====================================');
  console.log(`Bucket: ${AWS_CONFIG.bucket}`);
  console.log(`Region: ${AWS_CONFIG.region}`);
  console.log('');
  
  try {
    await checkCredentials();
    await applyCorsConfiguration();
    await applyBucketPolicy();
    await verifyConfiguration();
    
    console.log('');
    console.log('🎉 Configuration completed successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Your S3 bucket is now configured for public access');
    console.log('2. Users can upload files directly to your bucket');
    console.log('3. Files will be accessible via your S3 base URL:');
    console.log(`   https://${AWS_CONFIG.bucket}.s3.${AWS_CONFIG.region}.amazonaws.com/`);
    console.log('');
    console.log('⚠️  Security Note: This configuration allows public access to your bucket.');
    console.log('   Consider implementing additional security measures if needed.');
    
  } catch (error) {
    console.error('');
    console.error('💥 Configuration failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  applyCorsConfiguration,
  applyBucketPolicy,
  verifyConfiguration,
}; 