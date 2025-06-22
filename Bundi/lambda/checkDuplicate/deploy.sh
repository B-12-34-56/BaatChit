#!/bin/bash

# Deploy script for checkDuplicate Lambda function
set -e

echo "🚀 Deploying checkDuplicate Lambda function..."

# Set variables
FUNCTION_NAME="check-duplicate"
REGION="us-east-1"
ROLE_ARN="arn:aws:iam::339874238091:role/lambda-execution-role"
HANDLER="index.handler"
RUNTIME="nodejs18.x"
TIMEOUT=30
MEMORY_SIZE=512
S3_BUCKET="2314823894myawsbucket"

# Create deployment package
echo "📦 Creating deployment package..."
rm -f function.zip
zip -r function.zip . -x "*.git*" "node_modules/.cache/*" "test.js" "deploy.sh" "README.md"

echo "📤 Uploading to AWS Lambda..."

# Update function code
aws lambda update-function-code \
  --function-name $FUNCTION_NAME \
  --zip-file fileb://function.zip \
  --region $REGION

echo "⚙️ Updating function configuration..."

# Update function configuration
aws lambda update-function-configuration \
  --function-name $FUNCTION_NAME \
  --runtime $RUNTIME \
  --handler $HANDLER \
  --timeout $TIMEOUT \
  --memory-size $MEMORY_SIZE \
  --region $REGION \
  --environment Variables='{
    "IMAGES_TABLE":"ImageSignatures",
    "MAX_UPLOADS":"3",
    "SIMILARITY_THRESHOLD":"25",
    "AWS_REGION":"us-east-1",
    "S3_BUCKET":"'$S3_BUCKET'"
  }'

echo "✅ Deployment complete!"
echo "🔗 Function ARN: arn:aws:lambda:$REGION:339874238091:function:$FUNCTION_NAME"

# Test the function
echo "🧪 Testing the deployed function..."
aws lambda invoke \
  --function-name $FUNCTION_NAME \
  --payload '{"httpMethod":"POST","headers":{"content-type":"application/json"},"body":"{\"imageData\":\"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==\",\"userId\":\"test-user\",\"fileName\":\"test.png\",\"fileHash\":\"test-hash\"}"}' \
  --region $REGION \
  response.json

echo "📄 Function response:"
cat response.json | jq '.'

echo "🎉 Deployment and test completed successfully!" 