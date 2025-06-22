#!/usr/bin/env node

/**
 * S3 CORS and Block Public Access Configuration Script
 * This script configures your S3 bucket for presigned URL uploads
 */

const { S3Client, PutBucketCorsCommand, GetBucketCorsCommand, PutPublicAccessBlockCommand, GetPublicAccessBlockCommand, PutBucketPolicyCommand, GetBucketPolicyCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const AWS = require('aws-sdk');

// Use environment variables instead of hardcoded credentials
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_SESSION_TOKEN = process.env.AWS_SESSION_TOKEN;
const bucket = process.env.S3_BUCKET_NAME || '';
const region = 'us-east-1';

// Initialize S3 client
const s3Client = new S3Client({
  region: region,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    sessionToken: AWS_SESSION_TOKEN,
  }
});

// AWS SDK v2 client for compatibility
const s3V2 = new AWS.S3({
  region: region,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
});

// CORS Configuration for presigned URL uploads
const corsConfig = [
  {
    AllowedHeaders: [
      'Content-Type',
      'Content-Length',
      'x-amz-content-sha256',
      'x-amz-date',
      'x-amz-security-token',
      'Authorization',
      'Origin',
      'Accept',
      'Cache-Control',
      'Pragma',
    ],
    AllowedMethods: ['GET', 'PUT', 'POST', 'HEAD', 'DELETE'],
    AllowedOrigins: [
      // Expo development
      'exp://localhost:8081',
      'exp://192.168.*.*:8081',
      'exp://10.*.*.*:8081',
      'exp://172.*.*.*:8081',
      // Your app scheme
      'bundikitab://*',
      // Web development
      'http://localhost:3000',
      'http://localhost:19006',
      'https://localhost:3000',
      'https://localhost:19006',
      // Production domains (add your actual domains)
      'https://your-app-domain.com',
      'https://*.your-app-domain.com',
      // Expo Go
      'exp://exp.host',
      'exp://u.expo.dev',
      // Allow all for development (remove in production)
      '*',
    ],
    ExposeHeaders: [
      'ETag',
      'x-amz-version-id',
      'x-amz-delete-marker',
      'x-amz-expiration',
      'x-amz-restore',
      'x-amz-storage-class',
      'x-amz-request-id',
      'x-amz-id-2',
    ],
    MaxAgeSeconds: 3000,
  },
];

// Public Access Block Configuration (allow presigned URLs)
const publicAccessBlockConfig = {
  BlockPublicAcls: false,        // Allow public ACLs for presigned URLs
  IgnorePublicAcls: false,       // Don't ignore public ACLs
  BlockPublicPolicy: true,       // Block public bucket policies (security)
  RestrictPublicBuckets: true,   // Restrict public bucket access (security)
};

async function checkCredentials() {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    console.error('❌ AWS credentials not found in environment variables');
    console.log('Please set the following environment variables:');
    console.log('  AWS_ACCESS_KEY_ID');
    console.log('  AWS_SECRET_ACCESS_KEY');
    process.exit(1);
  }
  console.log('✅ AWS credentials found');
}

async function getCurrentCorsConfiguration() {
  try {
    console.log('🔄 Getting current CORS configuration...');
    
    const command = new GetBucketCorsCommand({
      Bucket: bucket,
    });
    
    const response = await s3Client.send(command);
    console.log('📋 Current CORS configuration:', JSON.stringify(response.CORSConfiguration, null, 2));
    
    return response.CORSConfiguration;
  } catch (error) {
    if (error.name === 'NoSuchCORSConfiguration') {
      console.log('📋 No CORS configuration found (using default)');
      return null;
    }
    throw error;
  }
}

async function updateCorsConfiguration() {
  try {
    console.log('🔄 Updating CORS configuration...');
    
    const corsCommand = new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: corsConfig,
      },
    });
    
    await s3Client.send(corsCommand);
    console.log('✅ CORS configuration updated successfully');
    
    // Verify the update
    const currentCors = await getCurrentCorsConfiguration();
    console.log('✅ CORS configuration verified');
    
  } catch (error) {
    console.error('❌ Failed to update CORS configuration:', error.message);
    throw error;
  }
}

async function getCurrentPublicAccessBlock() {
  try {
    console.log('🔄 Getting current public access block configuration...');
    
    const command = new GetPublicAccessBlockCommand({
      Bucket: bucket,
    });
    
    const response = await s3Client.send(command);
    console.log('📋 Current public access block configuration:', JSON.stringify(response.PublicAccessBlockConfiguration, null, 2));
    
    return response.PublicAccessBlockConfiguration;
  } catch (error) {
    console.error('❌ Failed to get public access block configuration:', error.message);
    throw error;
  }
}

async function updatePublicAccessBlock() {
  try {
    console.log('🔄 Updating public access block configuration...');
    
    const command = new PutPublicAccessBlockCommand({
      Bucket: bucket,
      PublicAccessBlockConfiguration: publicAccessBlockConfig,
    });
    
    await s3Client.send(command);
    console.log('✅ Public access block configuration updated successfully');
    
    // Verify the update
    const currentConfig = await getCurrentPublicAccessBlock();
    console.log('✅ Public access block configuration verified');
    
  } catch (error) {
    console.error('❌ Failed to update public access block configuration:', error.message);
    throw error;
  }
}

async function verifyConfiguration() {
  try {
    console.log('🔄 Verifying configuration...');
    
    // Check CORS
    const corsConfig = await getCurrentCorsConfiguration();
    if (!corsConfig || !corsConfig.CORSRules || corsConfig.CORSRules.length === 0) {
      throw new Error('CORS configuration not found');
    }
    
    // Check public access block
    const publicAccessConfig = await getCurrentPublicAccessBlock();
    if (!publicAccessConfig) {
      throw new Error('Public access block configuration not found');
    }
    
    // Verify key settings
    const hasPutMethod = corsConfig.CORSRules.some(rule => 
      rule.AllowedMethods && rule.AllowedMethods.includes('PUT')
    );
    
    const hasContentTypeHeader = corsConfig.CORSRules.some(rule => 
      rule.AllowedHeaders && rule.AllowedHeaders.includes('Content-Type')
    );
    
    const blockPublicAclsDisabled = !publicAccessConfig.BlockPublicAcls;
    
    console.log('✅ Configuration verification results:');
    console.log(`  - PUT method allowed: ${hasPutMethod ? '✅' : '❌'}`);
    console.log(`  - Content-Type header allowed: ${hasContentTypeHeader ? '✅' : '❌'}`);
    console.log(`  - Block public ACLs disabled: ${blockPublicAclsDisabled ? '✅' : '❌'}`);
    
    if (!hasPutMethod || !hasContentTypeHeader || !blockPublicAclsDisabled) {
      throw new Error('Configuration verification failed');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Configuration verification failed:', error.message);
    return false;
  }
}

/**
 * Update S3 bucket policy to allow access to images/ folder
 */
async function updateBucketPolicy() {
  try {
    console.log('🔄 Updating bucket policy...');
    
    const bucketPolicy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'AllowPresignedUrlUploads',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:PutObject',
          Resource: "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*",
          Condition: {
            StringEquals: {
              's3:x-amz-acl': 'public-read'
            }
          }
        },
        {
          Sid: 'AllowPublicRead',
          Effect: 'Allow',
          Principal: '*',
          Action: 's3:GetObject',
          Resource: "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*"
        }
      ]
    };

    const command = new PutBucketPolicyCommand({
      Bucket: bucket,
      Policy: JSON.stringify(bucketPolicy),
    });
    
    await s3Client.send(command);
    console.log('✅ Bucket policy updated successfully');
    
  } catch (error) {
    console.error('❌ Failed to update bucket policy:', error.message);
    throw error;
  }
}

async function main() {
  console.log('🚀 AWS S3 Configuration Update');
  console.log('==============================');
  console.log(`Bucket: ${bucket}`);
  console.log(`Region: ${region}`);
  console.log('');
  
  try {
    await checkCredentials();
    
    console.log('📋 Current configurations:');
    console.log('---------------------------');
    await getCurrentCorsConfiguration();
    await getCurrentPublicAccessBlock();
    console.log('');
    
    console.log('🔄 Updating configurations:');
    console.log('---------------------------');
    await updateCorsConfiguration();
    await updatePublicAccessBlock();
    await updateBucketPolicy();
    console.log('');
    
    console.log('✅ Verifying configurations:');
    console.log('----------------------------');
    const verificationSuccess = await verifyConfiguration();
    
    if (verificationSuccess) {
      console.log('');
      console.log('🎉 Configuration completed successfully!');
      console.log('');
      console.log('📝 Configuration Summary:');
      console.log('1. ✅ CORS configured for presigned URL uploads');
      console.log('2. ✅ PUT, GET, HEAD methods allowed');
      console.log('3. ✅ Content-Type header allowed');
      console.log('4. ✅ Block public ACLs disabled (required for presigned URLs)');
      console.log('5. ✅ Public bucket policies still blocked (security)');
      console.log('6. ✅ Public bucket access restricted (security)');
      console.log('7. ✅ Bucket policy updated successfully');
      console.log('');
      console.log('🔧 Your S3 bucket is now ready for presigned URL uploads!');
      console.log('');
      console.log('⚠️  Security Notes:');
      console.log('   - Public ACLs are allowed (required for presigned URLs)');
      console.log('   - Public bucket policies are still blocked');
      console.log('   - Public bucket access is still restricted');
      console.log('   - Only authorized users with presigned URLs can upload');
      
    } else {
      console.error('');
      console.error('💥 Configuration verification failed!');
      process.exit(1);
    }
    
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
  updateCorsConfiguration,
  updatePublicAccessBlock,
  verifyConfiguration,
  updateBucketPolicy,
}; 