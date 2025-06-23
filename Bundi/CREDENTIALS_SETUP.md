# Credentials Setup Guide

This guide helps you set up all the necessary credentials and environment variables for the Bundi app.

## 🔐 Security Notice

All sensitive credentials have been removed from the codebase and replaced with placeholder values. You must set up your own environment variables before running the application.

## 📋 Required Environment Variables

### 1. AWS Configuration
```bash
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
EXPO_PUBLIC_AWS_SESSION_TOKEN=YOUR_AWS_SESSION_TOKEN  # Optional for temporary credentials
```

### 2. S3 Storage
```bash
EXPO_PUBLIC_S3_BUCKET=YOUR_S3_BUCKET_NAME
EXPO_PUBLIC_S3_BASE_URL=YOUR_S3_BASE_URL
```

### 3. DynamoDB
```bash
EXPO_PUBLIC_DYNAMODB_TABLE=YOUR_DYNAMODB_TABLE
EXPO_PUBLIC_DYNAMODB_ENDPOINT=YOUR_DYNAMODB_ENDPOINT  # Optional
```

### 4. Cognito Authentication
```bash
EXPO_PUBLIC_COGNITO_USER_POOL_ID=YOUR_COGNITO_USER_POOL_ID
EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=YOUR_COGNITO_USER_POOL_CLIENT_ID
EXPO_PUBLIC_COGNITO_IDENTITY_POOL_ID=YOUR_COGNITO_IDENTITY_POOL_ID
```

### 5. API Gateway Endpoints
```bash
EXPO_PUBLIC_API_BASE_URL=YOUR_API_BASE_URL
EXPO_PUBLIC_UPLOAD_API_URL=YOUR_UPLOAD_API_URL
EXPO_PUBLIC_UPLOAD_API_KEY=YOUR_UPLOAD_API_KEY
EXPO_PUBLIC_GET_TAG_API_URL=YOUR_GET_TAG_API_URL
EXPO_PUBLIC_GET_TAG_API_KEY=YOUR_GET_TAG_API_KEY
EXPO_PUBLIC_BLOCK_IMAGE_API_URL=YOUR_BLOCK_IMAGE_API_URL
EXPO_PUBLIC_BLOCK_IMAGE_API_KEY=YOUR_BLOCK_IMAGE_API_KEY
EXPO_PUBLIC_CHECK_DUPLICATE_API_URL=YOUR_CHECK_DUPLICATE_API_URL
EXPO_PUBLIC_CHECK_DUPLICATE_API_KEY=YOUR_CHECK_DUPLICATE_API_KEY
```

### 6. Presign API
```bash
EXPO_PUBLIC_PRESIGN_ENDPOINT=YOUR_PRESIGN_ENDPOINT
EXPO_PUBLIC_PRESIGN_API_KEY=YOUR_PRESIGN_API_KEY
EXPO_PUBLIC_BUNDI_PRESIGN_URL=YOUR_BUNDI_PRESIGN_URL
EXPO_PUBLIC_BUNDI_API_KEY=YOUR_BUNDI_API_KEY
```

### 7. Working API (Fallback)
```bash
EXPO_PUBLIC_WORKING_API_URL=YOUR_WORKING_API_URL
EXPO_PUBLIC_WORKING_API_KEY=YOUR_WORKING_API_KEY
```

## 🚀 Setup Instructions

### Step 1: Create Environment File
Copy the template and create your `.env` file:

```bash
cp env.example .env
```

### Step 2: Fill in Your Values
Edit the `.env` file and replace all `YOUR_*` placeholders with your actual values.

### Step 3: AWS Resources Setup
Make sure you have the following AWS resources configured:

1. **S3 Bucket**: For storing images
2. **DynamoDB Table**: For storing image metadata
3. **Cognito User Pool**: For authentication
4. **Lambda Functions**: For API endpoints
5. **API Gateway**: For exposing Lambda functions

### Step 4: Test Configuration
Run the test scripts to verify your configuration:

```bash
# Test working API
node test-working-api.js

# Test upload API
node test-upload-api.js

# Test bundi presign API
node test-cloud-api.js
```

## 🔧 Server-Side Environment Variables

For the presign server and Lambda functions, you'll also need these server-side variables:

```bash
AWS_REGION=us-east-1
AWS_BUCKET=YOUR_S3_BUCKET_NAME
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
DYNAMODB_TABLE=YOUR_DYNAMODB_TABLE
UPLOAD_API_URL=YOUR_UPLOAD_API_URL
UPLOAD_API_KEY=YOUR_UPLOAD_API_KEY
BLOCK_API_URL=YOUR_BLOCK_API_URL
BLOCK_API_KEY=YOUR_BLOCK_API_KEY
CHECK_DUPLICATE_API_URL=YOUR_CHECK_DUPLICATE_API_URL
CHECK_DUPLICATE_API_KEY=YOUR_CHECK_DUPLICATE_API_KEY
BUNDI_PRESIGN_URL=YOUR_BUNDI_PRESIGN_URL
BUNDI_API_KEY=YOUR_BUNDI_API_KEY
WORKING_API_URL=YOUR_WORKING_API_URL
WORKING_API_KEY=YOUR_WORKING_API_KEY
```

## 🛡️ Security Best Practices

1. **Never commit credentials to version control**
2. **Use environment variables for all sensitive data**
3. **Rotate API keys regularly**
4. **Use IAM roles with minimal required permissions**
5. **Enable CloudTrail for audit logging**
6. **Use VPC endpoints for private communication**

## 📝 Example Values

Here are examples of what the values should look like (DO NOT use these actual values):

```bash
# AWS S3
EXPO_PUBLIC_S3_BUCKET=my-app-images-bucket
EXPO_PUBLIC_S3_BASE_URL=https://my-app-images-bucket.s3.us-east-1.amazonaws.com/images/

# API Gateway
EXPO_PUBLIC_UPLOAD_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com/Deployment/upload-image
EXPO_PUBLIC_UPLOAD_API_KEY=abc123def456ghi789

# Cognito
EXPO_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_ABC123DEF
EXPO_PUBLIC_COGNITO_USER_POOL_CLIENT_ID=1234567890123456789012
EXPO_PUBLIC_COGNITO_IDENTITY_POOL_ID=us-east-1:abc123def-4567-8901-2345-678901234567
```

## 🆘 Troubleshooting

If you encounter issues:

1. **Check environment variables**: Ensure all required variables are set
2. **Verify AWS credentials**: Test with AWS CLI
3. **Check API Gateway**: Ensure endpoints are deployed and accessible
4. **Review Lambda logs**: Check CloudWatch for error messages
5. **Test endpoints**: Use the provided test scripts

## 📞 Support

If you need help setting up your environment variables, refer to:
- AWS Documentation
- Expo Environment Variables Guide
- API Gateway Configuration Guide 