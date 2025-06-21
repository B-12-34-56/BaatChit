// Test script for checkDuplicate Lambda function
const { handler } = require('./index');

// Mock event for testing
const testEvent = {
  httpMethod: 'POST',
  headers: {
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    imageData: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // 1x1 pixel PNG
    userId: 'test-user-123',
    fileName: 'test-image.png',
    fileHash: 'test-hash-123'
  })
};

async function testLambda() {
  console.log('🧪 Testing checkDuplicate Lambda function...');
  
  try {
    const result = await handler(testEvent);
    
    console.log('✅ Lambda response:', {
      statusCode: result.statusCode,
      body: JSON.parse(result.body)
    });
    
    // Verify all required fields are present
    const body = JSON.parse(result.body);
    const requiredFields = ['success', 'blocked', 'totalCount', 'uploadCount', 'imageUrl', 'perceptualHash', 'similarImages', 'message'];
    
    console.log('\n🔍 Checking required fields:');
    requiredFields.forEach(field => {
      const value = body[field];
      const status = value !== undefined && value !== null ? '✅' : '❌';
      console.log(`${status} ${field}: ${value}`);
    });
    
    // Check for undefined values
    const undefinedFields = requiredFields.filter(field => body[field] === undefined);
    if (undefinedFields.length > 0) {
      console.log('\n❌ Found undefined fields:', undefinedFields);
    } else {
      console.log('\n✅ All required fields are properly defined!');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testLambda(); 