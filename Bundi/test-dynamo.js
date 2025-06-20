// Test script for DynamoDB functionality
// Run with: node test-dynamo.js

const { awsConfig, apiHelpers } = require('./src/utils/aws');

async function testDynamoDB() {
  try {
    console.log('🧪 Testing DynamoDB connection...');
    console.log('📋 Config:', {
      tableName: awsConfig.dynamoDB.tableName,
      region: awsConfig.dynamoDB.region
    });
    
    const testHash = 'test_hash_' + Date.now();
    console.log('🔑 Test hash:', testHash);
    
    // Test get (should return 0)
    console.log('📊 Testing GET...');
    const count1 = await apiHelpers.getImageUploadCount(testHash);
    console.log('✅ Initial count:', count1);
    
    // Test increment
    console.log('➕ Testing INCREMENT...');
    const newCount = await apiHelpers.incrementImageUploadCount(
      testHash, 
      'test_user_id',
      'Test User',
      'test.jpg'
    );
    console.log('✅ New count returned:', newCount);
    
    // Test get again (should return 1)
    console.log('📊 Testing GET again...');
    const count2 = await apiHelpers.getImageUploadCount(testHash);
    console.log('✅ Final count:', count2);
    
    if (count2 !== 1) {
      console.error('❌ DynamoDB increment not working! Expected 1, got:', count2);
    } else {
      console.log('🎉 DynamoDB test PASSED!');
    }
    
  } catch (error) {
    console.error('❌ DynamoDB test failed:', error);
  }
}

// Run the test
testDynamoDB(); 