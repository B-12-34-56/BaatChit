const AWS = require('aws-sdk');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configure AWS - Use environment variables or AWS credentials file
AWS.config.update({
  region: 'us-east-1'
});

const lambda = new AWS.Lambda();

async function deployLambda() {
  try {
    console.log('🚀 Starting Lambda deployment...');
    
    // Use the existing temp-lambda-package directory
    const tempDir = path.join(__dirname, '../temp-lambda-package');
    
    // Check if the directory and index.js exist
    if (!fs.existsSync(tempDir)) {
      throw new Error('temp-lambda-package directory does not exist');
    }
    
    const indexJsPath = path.join(tempDir, 'index.js');
    if (!fs.existsSync(indexJsPath)) {
      throw new Error('index.js file does not exist in temp-lambda-package');
    }
    
    // Read the existing Lambda function code
    const lambdaCode = fs.readFileSync(indexJsPath, 'utf8');
    
    console.log('📄 Lambda code loaded, size:', lambdaCode.length, 'characters');
    
    // Create package.json for dependencies with minimal packages
    const packageJson = {
      "name": "upload-image-handler",
      "version": "1.0.0",
      "dependencies": {
        "@aws-sdk/client-s3": "^3.0.0",
        "@aws-sdk/client-dynamodb": "^3.0.0",
        "@aws-sdk/s3-request-presigner": "^3.0.0"
      }
    };
    fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(packageJson, null, 2));
    
    // Install dependencies
    console.log('📦 Installing dependencies...');
    execSync('npm install --omit=dev', { cwd: tempDir, stdio: 'inherit' });
    
    // Create ZIP file
    const JSZip = require('jszip');
    const zip = new JSZip();
    
    // Function to add directory to zip recursively
    const addDirectoryToZip = (dirPath, zipPath = '') => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const relativePath = path.join(zipPath, item);
        
        if (fs.statSync(fullPath).isDirectory()) {
          addDirectoryToZip(fullPath, relativePath);
        } else {
          const content = fs.readFileSync(fullPath);
          zip.file(relativePath, content);
        }
      }
    };
    
    // Add all files from temp directory to zip
    addDirectoryToZip(tempDir);
    
    // Generate the ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    
    console.log('📦 ZIP file created, size:', zipBuffer.length, 'bytes');
    
    // Update the Lambda function
    const updateParams = {
      FunctionName: 'UploadToS3',
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
    
    if (error.code === 'UnrecognizedClientException') {
      console.log('💡 AWS credentials are invalid or expired.');
      console.log('💡 Please refresh your AWS credentials and try again.');
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