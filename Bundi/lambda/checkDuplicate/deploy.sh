#!/bin/bash

# Deploy Lambda function for checking duplicate images
set -e

# Configuration
FUNCTION_NAME="check-duplicate"
RUNTIME="nodejs18.x"
HANDLER="index.handler"
TIMEOUT=30
MEMORY_SIZE=256
REGION="us-east-1"

# Environment variables - use environment variables or placeholders
S3_BUCKET="${S3_BUCKET:-YOUR_S3_BUCKET_NAME}"
DYNAMODB_TABLE="${DYNAMODB_TABLE:-YOUR_DYNAMODB_TABLE}"
UPLOAD_API_URL="${UPLOAD_API_URL:-YOUR_UPLOAD_API_URL}"
UPLOAD_API_KEY="${UPLOAD_API_KEY:-YOUR_UPLOAD_API_KEY}"
BLOCK_API_URL="${BLOCK_API_URL:-YOUR_BLOCK_API_URL}"
BLOCK_API_KEY="${BLOCK_API_KEY:-YOUR_BLOCK_API_KEY}"

echo "🚀 Deploying $FUNCTION_NAME Lambda function..."

# Create deployment package
echo "📦 Creating deployment package..."
rm -rf deployment-package
mkdir deployment-package
cp index.js deployment-package/
cp package.json deployment-package/

cd deployment-package
npm install --production
zip -r ../$FUNCTION_NAME.zip .
cd ..

# Deploy to AWS Lambda
echo "☁️ Deploying to AWS Lambda..."
aws lambda create-function \
  --function-name $FUNCTION_NAME \
  --runtime $RUNTIME \
  --role arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):role/lambda-execution-role \
  --handler $HANDLER \
  --zip-file fileb://$FUNCTION_NAME.zip \
  --timeout $TIMEOUT \
  --memory-size $MEMORY_SIZE \
  --environment Variables="{S3_BUCKET=$S3_BUCKET,DYNAMODB_TABLE=$DYNAMODB_TABLE,UPLOAD_API_URL=$UPLOAD_API_URL,UPLOAD_API_KEY=$UPLOAD_API_KEY,BLOCK_API_URL=$BLOCK_API_URL,BLOCK_API_KEY=$BLOCK_API_KEY}" \
  --region $REGION \
  || aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://$FUNCTION_NAME.zip \
  --region $REGION

echo "✅ Lambda function deployed successfully!"
echo "📋 Function details:"
echo "   Name: $FUNCTION_NAME"
echo "   Runtime: $RUNTIME"
echo "   Handler: $HANDLER"
echo "   Timeout: ${TIMEOUT}s"
echo "   Memory: ${MEMORY_SIZE}MB"
echo "   Region: $REGION"

# Clean up
rm -rf deployment-package $FUNCTION_NAME.zip

echo "🎉 Deployment complete!" 