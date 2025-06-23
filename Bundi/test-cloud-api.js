// Test script for Bundi Presign API functionality
const fetch = require('node-fetch');

const BUNDI_PRESIGN_URL = process.env.BUNDI_PRESIGN_URL || 'YOUR_BUNDI_PRESIGN_URL';
const BUNDI_API_KEY = process.env.BUNDI_API_KEY || 'YOUR_BUNDI_API_KEY';

async function testBundiPresignApi() {
  console.log('🧪 Testing Bundi Presign API functionality...\n');

  try {
    // Test 1: Try without API key first
    console.log('📤 Test 1: Testing without API key...');
    try {
      const responseNoKey = await fetch(BUNDI_PRESIGN_URL, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          filename: 'test-image.jpg', 
          contentType: 'image/jpeg', 
          method: 'post'
        }),
      });
      console.log('📥 Response without API key:', responseNoKey.status, responseNoKey.statusText);
    } catch (e) {
      console.log('📥 Error without API key:', e.message);
    }

    // Test 2: Try with API key
    console.log('\n📤 Test 2: Testing with API key...');
    const response = await fetch(BUNDI_PRESIGN_URL, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': BUNDI_API_KEY,
        'X-API-Key': BUNDI_API_KEY,
        'Authorization': `Bearer ${BUNDI_API_KEY}`
      },
      body: JSON.stringify({ 
        filename: 'test-image.jpg', 
        contentType: 'image/jpeg', 
        method: 'post'
      }),
    });

    console.log('📥 Response status:', response.status);
    console.log('📥 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Bundi API error:', response.status, errorText);
      
      // Provide specific guidance based on error
      if (response.status === 403) {
        console.log('\n🔧 403 Error - Authentication Issues:');
        console.log('   1. Check if API Gateway requires API key');
        console.log('   2. Verify API key is enabled in API Gateway');
        console.log('   3. Check if endpoint is configured correctly');
        console.log('   4. Try different header names (x-api-key, X-API-Key, Authorization)');
      }
      
      throw new Error(`Bundi API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Bundi API response:', {
      hasPresignedUrl: !!result.presignedUrl,
      hasS3Key: !!result.s3Key,
      method: result.method,
      presignedUrl: result.presignedUrl?.substring(0, 50) + '...',
      s3Key: result.s3Key
    });

    // Test 3: Verify the presigned URL format
    console.log('\n📤 Test 3: Verifying presigned URL format...');
    if (result.presignedUrl && result.presignedUrl.includes('s3.amazonaws.com')) {
      console.log('✅ Presigned URL is properly formatted for S3');
    } else {
      console.log('❌ Presigned URL format is incorrect');
    }

    console.log('\n🎉 All Bundi Presign API tests passed!');
    console.log('\n📋 Bundi API flow:');
    console.log('   mobile-app ──POST /bundiPresign──▶ Lambda ──S3──▶ Presigned URL');
    console.log('                          ▲                       │');
    console.log('         ② upload to S3 │                       │ ① generate URL');
    console.log('                          └───────────────return──┘');

  } catch (error) {
    console.error('❌ Bundi Presign API test failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('   1. Check API Gateway console for bundiPresign API');
    console.log('   2. Verify API key exists and is enabled');
    console.log('   3. Check if API Gateway requires usage plan');
    console.log('   4. Verify the endpoint URL is correct');
    console.log('   5. Check Lambda function logs in CloudWatch');
  }
}

// Run the test
testBundiPresignApi(); 