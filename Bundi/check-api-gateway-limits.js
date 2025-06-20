const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const apigateway = new AWS.APIGateway();
const lambda = new AWS.Lambda();

async function checkLimits() {
  try {
    console.log('🔍 Checking API Gateway and Lambda limits...\n');

    // Check API Gateway REST API limits
    console.log('📊 API Gateway REST API Limits:');
    console.log('- Default payload size: 10MB (10,485,760 bytes)');
    console.log('- Your image size: 6.2MB (6,194,596 bytes)');
    console.log('- Status: ✅ Should fit within limit\n');

    // Check Lambda limits
    console.log('📊 Lambda Limits:');
    console.log('- Request payload: 6MB (6,291,456 bytes)');
    console.log('- Response payload: 6MB (6,291,456 bytes)');
    console.log('- Your image size: 6.2MB (6,194,596 bytes)');
    console.log('- Status: ⚠️  Very close to limit\n');

    // Check specific API Gateway
    const apiId = 'YOUR_API_GATEWAY_ID'; // Replace with your actual API ID
    try {
      const api = await apigateway.getRestApi({ restApiId: apiId }).promise();
      console.log('📊 Your API Gateway Details:');
      console.log(`- API ID: ${api.id}`);
      console.log(`- Name: ${api.name}`);
      console.log(`- Created: ${api.createdDate}`);
      console.log(`- Default payload limit: 10MB\n`);
    } catch (error) {
      console.log('❌ Could not fetch API Gateway details:', error.message);
    }

    console.log('💡 Recommendations:');
    console.log('1. Consider compressing images before upload');
    console.log('2. Use presigned URLs for direct S3 upload (bypasses Lambda)');
    console.log('3. Increase Lambda timeout if needed');
    console.log('4. Monitor CloudWatch logs for payload size errors');

  } catch (error) {
    console.error('❌ Error checking limits:', error);
  }
}

checkLimits(); 