#!/bin/bash

# Lambda deployment script for checkDuplicate function

echo "🚀 Deploying checkDuplicate Lambda function..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create deployment package
echo "📦 Creating deployment package..."
zip -r function.zip . -x '*.git*' 'node_modules/.cache/*' 'deploy.sh' 'README.md'

# Deploy to AWS Lambda
echo "☁️ Deploying to AWS Lambda..."
aws lambda update-function-code \
  --function-name checkDuplicate \
  --zip-file fileb://function.zip \
  --region us-east-1

# Update function configuration
echo "⚙️ Updating function configuration..."
aws lambda update-function-configuration \
  --function-name checkDuplicate \
  --environment Variables='{IMAGES_TABLE=ImageSignatures,MAX_UPLOADS=3,SIMILARITY_THRESHOLD=25,S3_BUCKET='$S3_BUCKET',AWS_REGION=us-east-1}' \
  --timeout 30 \
  --memory-size 512 \
  --region us-east-1

# Clean up
echo "🧹 Cleaning up..."
rm function.zip

echo "✅ Deployment complete!"
echo "📋 Function details:"
echo "   - Function name: checkDuplicate"
echo "   - Table: ImageSignatures"
echo "   - Max uploads: 3"
echo "   - Similarity threshold: 25"
echo "   - Timeout: 30 seconds"
echo "   - Memory: 512 MB" 