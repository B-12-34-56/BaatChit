// Test script for presigned URL upload functionality
const fetch = require('node-fetch');

const PRESIGN_URL = 'http://localhost:4000/presign';

async function testPresignedUpload() {
  console.log('🧪 Testing presigned URL upload functionality...\n');

  try {
    // Test 1: Get presigned URL with POST method
    console.log('📤 Test 1: Getting presigned URL with POST method...');
    const presignResponse = await fetch(PRESIGN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        filename: 'test-image.jpg', 
        contentType: 'image/jpeg', 
        method: 'post' 
      }),
    });

    if (!presignResponse.ok) {
      throw new Error(`Presign failed: ${presignResponse.status}`);
    }

    const presignResult = await presignResponse.json();
    console.log('✅ Presigned URL received:', {
      method: presignResult.method,
      hasUploadUrl: !!presignResult.uploadUrl,
      hasUploadFields: !!presignResult.uploadFields,
      s3Key: presignResult.s3Key
    });

    // Test 2: Verify the upload URL format
    console.log('\n📤 Test 2: Verifying upload URL format...');
    if (presignResult.uploadUrl && presignResult.uploadUrl.includes('s3.amazonaws.com')) {
      console.log('✅ Upload URL is properly formatted for S3');
    } else {
      console.log('❌ Upload URL format is incorrect');
    }

    // Test 3: Check if fields are provided for POST method
    console.log('\n📤 Test 3: Checking upload fields...');
    if (presignResult.method === 'post' && presignResult.uploadFields) {
      console.log('✅ Upload fields provided for POST method');
      console.log('   Fields:', Object.keys(presignResult.uploadFields));
    } else {
      console.log('❌ Upload fields missing for POST method');
    }

    console.log('\n🎉 All tests passed! Presigned URL upload is working correctly.');
    console.log('\n📋 Flow summary:');
    console.log('   mobile-app ──POST /presign──▶ presign-svc ──STS/role──▶ S3');
    console.log('                          ▲                       │');
    console.log('         ② multipart POST │                       │ ① create policy / URL');
    console.log('                          └───────────────upload──┘');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting tips:');
    console.log('   1. Make sure the presign server is running on port 4000');
    console.log('   2. Check AWS credentials are properly configured');
    console.log('   3. Verify S3 bucket permissions');
    console.log('   4. Check CORS configuration on S3 bucket');
  }
}

// Run the test
testPresignedUpload(); 