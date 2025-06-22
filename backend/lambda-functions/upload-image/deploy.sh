#!/bin/bash

# Upload Image Lambda Deployment Script
# This script prepares and deploys the upload-image Lambda function

set -e

echo "🚀 Starting upload-image Lambda deployment..."

# Check if we're in the right directory
if [ ! -f "index.js" ] || [ ! -f "package.json" ]; then
    echo "❌ Error: index.js and package.json must be in the current directory"
    exit 1
fi

# Clean up any existing files
echo "🧹 Cleaning up previous build files..."
rm -rf node_modules upload-image.zip

# Install production dependencies
echo "📦 Installing production dependencies..."
npm ci --omit=dev

# Create deployment package
echo "📦 Creating deployment package..."
zip -r upload-image.zip . -x '*.git*' 'node_modules/.cache/*' 'deploy.sh' 'README.md'

# Show package info
echo "📊 Package created:"
ls -lh upload-image.zip

echo ""
echo "✅ Deployment package ready!"
echo ""
echo "📋 Next steps:"
echo "1. Go to AWS Console → Lambda"
echo "2. Find the Lambda function behind: https://np39lyhj20.execute-api.us-east-1.amazonaws.com/Deployment/upload-image"
echo "3. Upload the upload-image.zip file"
echo "4. Make sure the handler is set to: index.handler"
echo "5. Set environment variables if needed:"
echo "   - AWS_S3_BUCKET"
echo "   - DYNAMODB_TABLE"
echo "   - AWS_REGION"
echo ""
echo "🔧 Or use AWS CLI:"
echo "aws lambda update-function-code --function-name YOUR_FUNCTION_NAME --zip-file fileb://upload-image.zip"
echo ""
echo "🎯 After deployment, test with your app - the Lambda should now return proper imageUrl responses!" 