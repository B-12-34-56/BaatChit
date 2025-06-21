const AWS = require('aws-sdk');
const { S3Client } = require('@aws-sdk/client-s3');

// Configure AWS with the same credentials
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "YOUR_ACCESS_KEY_ID",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "YOUR_SECRET_ACCESS_KEY",
    sessionToken: process.env.AWS_SESSION_TOKEN || "YOUR_SESSION_TOKEN",
  }
});

const bucketName = 'YOUR_S3_BUCKET_NAME';

async function testS3Permissions() {
  try {
    console.log('🔍 Testing S3 bucket permissions...');
    
    // Test 1: List bucket contents
    console.log('📋 Test 1: Listing bucket contents...');
    const listResult = await s3Client.listObjectsV2({
      Bucket: bucketName,
      MaxKeys: 5
    }).promise();
    
    console.log('✅ Bucket listing successful');
    console.log('📁 Objects found:', listResult.Contents?.length || 0);
    
    // Test 2: Check bucket policy
    console.log('📋 Test 2: Checking bucket policy...');
    try {
      const policyResult = await s3Client.getBucketPolicy({
        Bucket: bucketName
      }).promise();
      
      console.log('✅ Bucket policy found');
      console.log('📄 Policy:', JSON.parse(policyResult.Policy));
    } catch (error) {
      console.log('⚠️ No bucket policy found (this might be normal)');
    }
    
    // Test 3: Check bucket ACL
    console.log('📋 Test 3: Checking bucket ACL...');
    const aclResult = await s3Client.getBucketAcl({
      Bucket: bucketName
    }).promise();
    
    console.log('✅ Bucket ACL retrieved');
    console.log('🔐 ACL:', aclResult);
    
    // Test 4: Check public access block settings
    console.log('📋 Test 4: Checking public access block settings...');
    const publicAccessResult = await s3Client.getPublicAccessBlock({
      Bucket: bucketName
    }).promise();
    
    console.log('✅ Public access block settings retrieved');
    console.log('🚫 Public access blocks:', publicAccessResult.PublicAccessBlockConfiguration);
    
    // Test 5: Try to upload a test file
    console.log('📋 Test 5: Testing file upload...');
    const testKey = 'test-permissions.txt';
    const testContent = 'This is a test file to check S3 permissions';
    
    await s3Client.putObject({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain'
    }).promise();
    
    console.log('✅ Test file upload successful');
    
    // Test 6: Try to access the uploaded file
    console.log('📋 Test 6: Testing file access...');
    const testUrl = `https://${bucketName}.s3.us-east-1.amazonaws.com/${testKey}`;
    console.log('🔗 Test URL:', testUrl);
    
    const getResult = await s3Client.getObject({
      Bucket: bucketName,
      Key: testKey
    }).promise();
    
    console.log('✅ Test file access successful');
    console.log('📄 File content:', getResult.Body.toString());
    
    // Test 7: Clean up test file
    console.log('📋 Test 7: Cleaning up test file...');
    await s3Client.deleteObject({
      Bucket: bucketName,
      Key: testKey
    }).promise();
    
    console.log('✅ Test file deleted');
    
    console.log('🎉 All S3 permission tests passed!');
    
  } catch (error) {
    console.error('❌ S3 permission test failed:', error);
    console.error('🔍 Error details:', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    });
  }
}

// Run the test
testS3Permissions(); 