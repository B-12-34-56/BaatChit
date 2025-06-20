const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');

// Configure AWS - Use credentials from AWS credentials file instead of hardcoded values
AWS.config.update({
  region: 'us-east-1'
  // Remove hardcoded credentials - AWS SDK will automatically use ~/.aws/credentials
});

const lambda = new AWS.Lambda();

async function deployLambda() {
  try {
    console.log('🚀 Starting Lambda deployment...');
    
    // Read the Lambda function code
    const lambdaCode = fs.readFileSync(
      path.join(__dirname, '../src/lambdaHandlers/uploadImageHandler.js'),
      'utf8'
    );
    
    console.log('📄 Lambda code loaded, size:', lambdaCode.length, 'characters');
    
    // Create a ZIP file for the Lambda deployment
    const JSZip = require('jszip');
    const zip = new JSZip();
    
    // Add the main Lambda function
    zip.file('index.js', lambdaCode);
    
    // Add package.json for dependencies
    const packageJson = {
      "name": "upload-image-handler",
      "version": "1.0.0",
      "dependencies": {
        "@aws-sdk/client-s3": "^3.0.0",
        "@aws-sdk/client-dynamodb": "^3.0.0",
        "@aws-sdk/s3-request-presigner": "^3.0.0",
        "aws-sdk": "^2.1000.0"
      }
    };
    zip.file('package.json', JSON.stringify(packageJson, null, 2));
    
    // Generate the ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    console.log('📦 ZIP file created, size:', zipBuffer.length, 'bytes');
    
    // Update the Lambda function
    const updateParams = {
      FunctionName: 'upload-image-handler', // You may need to adjust this name
      ZipFile: zipBuffer
    };
    
    console.log('🔄 Updating Lambda function...');
    const result = await lambda.updateFunctionCode(updateParams).promise();
    
    console.log('✅ Lambda function updated successfully!');
    console.log('📋 Function details:', {
      FunctionName: result.FunctionName,
      LastModified: result.LastModified,
      CodeSize: result.CodeSize,
      Version: result.Version
    });
    
    return result;
    
  } catch (error) {
    console.error('❌ Lambda deployment failed:', error);
    
    if (error.code === 'ResourceNotFoundException') {
      console.log('💡 The Lambda function might not exist yet. You may need to create it first.');
      console.log('💡 Or check the function name in the AWS Lambda console.');
    }
    
    throw error;
  }
}

// Run the deployment
if (require.main === module) {
  deployLambda()
    .then(() => {
      console.log('🎉 Deployment completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployLambda }; 