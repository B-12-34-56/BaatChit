const AWS = require('aws-sdk');
const { LambdaClient, GetFunctionConfigurationCommand } = require('@aws-sdk/client-lambda');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const lambda = new AWS.Lambda();

// Configuration - Use environment variables
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_BUCKET = process.env.AWS_BUCKET || 'YOUR_S3_BUCKET_NAME';
const DYNAMODB_TABLE = 'ImageSignatures';

const lambdaClient = new LambdaClient({ region: AWS_REGION });

async function checkLambdaEnvironment(functionName) {
  try {
    console.log(`🔍 Checking environment for Lambda function: ${functionName}`);
    
    const command = new GetFunctionConfigurationCommand({
      FunctionName: functionName
    });
    
    const response = await lambdaClient.send(command);
    
    console.log(`✅ Function found: ${response.FunctionName}`);
    console.log(`📋 Runtime: ${response.Runtime}`);
    console.log(`⏱️  Timeout: ${response.Timeout}s`);
    console.log(`💾 Memory: ${response.MemorySize}MB`);
    console.log(`🔗 Handler: ${response.Handler}`);
    
    if (response.Environment && response.Environment.Variables) {
      console.log('\n🔧 Environment Variables:');
      Object.entries(response.Environment.Variables).forEach(([key, value]) => {
        // Mask sensitive values
        const maskedValue = key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token')
          ? `${value.substring(0, 8)}...`
          : value;
        console.log(`   ${key}: ${maskedValue}`);
      });
    } else {
      console.log('\n⚠️  No environment variables found');
    }
    
    return response;
    
  } catch (error) {
    console.error(`❌ Error checking function ${functionName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🚀 Lambda Environment Checker\n');
  
  // List of functions to check
  const functions = [
    'upload-image',
    'check-duplicate',
    'block-image',
    'get-tag',
    'bundipresign'
  ];
  
  // Expected environment variables
  const expectedEnvVars = {
    'AWS_REGION': AWS_REGION,
    'AWS_BUCKET': AWS_BUCKET,
    'DYNAMODB_TABLE': 'YOUR_DYNAMODB_TABLE',
    'UPLOAD_API_URL': 'YOUR_UPLOAD_API_URL',
    'UPLOAD_API_KEY': 'YOUR_UPLOAD_API_KEY',
    'BLOCK_API_URL': 'YOUR_BLOCK_API_URL',
    'BLOCK_API_KEY': 'YOUR_BLOCK_API_KEY',
    'CHECK_DUPLICATE_API_URL': 'YOUR_CHECK_DUPLICATE_API_URL',
    'CHECK_DUPLICATE_API_KEY': 'YOUR_CHECK_DUPLICATE_API_KEY'
  };
  
  console.log('📋 Expected Environment Variables:');
  Object.entries(expectedEnvVars).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  
  console.log('\n' + '='.repeat(50) + '\n');
  
  for (const functionName of functions) {
    await checkLambdaEnvironment(functionName);
    console.log('\n' + '-'.repeat(30) + '\n');
  }
  
  console.log('✅ Environment check complete!');
}

main().catch(console.error);

module.exports = { checkLambdaEnvironment }; 