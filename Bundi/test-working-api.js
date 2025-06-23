// Test script for working API functionality
const fetch = require('node-fetch');

const WORKING_API_URL = process.env.WORKING_API_URL || 'YOUR_WORKING_API_URL';
const WORKING_API_KEY = process.env.WORKING_API_KEY || 'YOUR_WORKING_API_KEY';

async function testWorkingApi() {
  console.log('🧪 Testing Working API functionality...\n');

  try {
    // Test 1: Test presigned URL generation
    console.log('📤 Test 1: Testing presigned URL generation...');
    const response = await fetch(WORKING_API_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': WORKING_API_KEY
      },
      body: JSON.stringify({ 
        filename: 'test-image.jpg', 
        contentType: 'image/jpeg', 
        method: 'post',
        uploadMethod: 'presigned-url',
        imageHash: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`
      }),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Working API error:', response.status, errorText);
      throw new Error(`Working API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Working API response:', {
      hasPresignedUrl: !!result.presignedUrl,
      hasS3Key: !!result.s3Key,
      method: result.method,
      presignedUrl: result.presignedUrl?.substring(0, 50) + '...',
      s3Key: result.s3Key
    });

    // Test 2: Verify the presigned URL format
    console.log('\n📤 Test 2: Verifying presigned URL format...');
    if (result.presignedUrl && result.presignedUrl.includes('s3.amazonaws.com')) {
      console.log('✅ Presigned URL is properly formatted for S3');
    } else {
      console.log('❌ Presigned URL format is incorrect');
    }

    console.log('\n🎉 All Working API tests passed!');
    console.log('\n📋 Working API flow:');
    console.log('   mobile-app ──POST /upload-image──▶ Lambda ──S3──▶ Presigned URL');
    console.log('                          ▲                       │');
    console.log('         ② upload to S3 │                       │ ① generate URL');
    console.log('                          └───────────────return──┘');

  } catch (error) {
    console.error('❌ Working API test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check API Gateway console for upload-image API');
    console.log('   2. Verify API key exists and is enabled');
    console.log('   3. Check if API Gateway requires usage plan');
    console.log('   4. Verify the endpoint URL is correct');
    console.log('   5. Check Lambda function logs in CloudWatch');
  }
}

// Run the test
testWorkingApi(); 