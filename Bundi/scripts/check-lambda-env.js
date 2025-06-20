const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1'
});

const lambda = new AWS.Lambda();

async function checkLambdaEnvironment() {
  try {
    console.log('🔍 Checking Lambda Environment Variables...\n');
    
    // List Lambda functions
    const functions = await lambda.listFunctions().promise();
    console.log('📋 Found Lambda functions:');
    functions.Functions.forEach(func => {
      console.log(`  - ${func.FunctionName} (Runtime: ${func.Runtime})`);
    });
    
    // Check specific functions that might be related to image upload
    const functionNames = [
      'upload-image-handler',
      'uploadImageHandler',
      'image-upload-handler',
      'test-echo-handler'
    ];
    
    for (const functionName of functionNames) {
      try {
        console.log(`\n🔍 Checking function: ${functionName}`);
        
        const functionConfig = await lambda.getFunctionConfiguration({
          FunctionName: functionName
        }).promise();
        
        console.log(`  Function Name: ${functionConfig.FunctionName}`);
        console.log(`  Runtime: ${functionConfig.Runtime}`);
        console.log(`  Handler: ${functionConfig.Handler}`);
        console.log(`  Last Modified: ${functionConfig.LastModified}`);
        console.log(`  Code Size: ${functionConfig.CodeSize} bytes`);
        
        // Check environment variables
        if (functionConfig.Environment && functionConfig.Environment.Variables) {
          console.log('  Environment Variables:');
          const expectedEnvVars = {
            'AWS_REGION': 'us-east-1',
            'AWS_BUCKET': process.env.AWS_S3_BUCKET,
            'S3_IMAGES_PATH': 'images/',
            'DYNAMODB_TABLE': 'ImageSignatures',
            'DYNAMODB_REGION': 'us-east-1'
          };
          
          for (const [key, expectedValue] of Object.entries(expectedEnvVars)) {
            const actualValue = functionConfig.Environment.Variables[key];
            const status = actualValue === expectedValue ? '✅' : '❌';
            console.log(`    ${status} ${key}: ${actualValue || 'NOT SET'} ${actualValue !== expectedValue ? `(expected: ${expectedValue})` : ''}`);
          }
          
          // Show all other environment variables
          for (const [key, value] of Object.entries(functionConfig.Environment.Variables)) {
            if (!expectedEnvVars.hasOwnProperty(key)) {
              console.log(`    ℹ️  ${key}: ${value}`);
            }
          }
        } else {
          console.log('  ❌ No environment variables set');
        }
        
        // Check function URL if available
        try {
          const functionUrl = await lambda.getFunctionUrlConfig({
            FunctionName: functionName
          }).promise();
          console.log(`  Function URL: ${functionUrl.FunctionUrl}`);
        } catch (urlError) {
          console.log('  ℹ️  No function URL configured');
        }
        
      } catch (funcError) {
        if (funcError.code === 'ResourceNotFoundException') {
          console.log(`  ℹ️  Function ${functionName} not found`);
        } else {
          console.log(`  ❌ Error checking function: ${funcError.message}`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking Lambda environment:', error);
  }
}

// Run the check
if (require.main === module) {
  checkLambdaEnvironment()
    .then(() => {
      console.log('\n✅ Lambda environment check completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Lambda environment check failed:', error.message);
      process.exit(1);
    });
}

module.exports = { checkLambdaEnvironment }; 