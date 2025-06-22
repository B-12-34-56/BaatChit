# AWS Credentials Configuration

## ✅ **What's Been Configured:**

Your AWS configuration has been updated with:
- **S3 Bucket**: `YOUR_S3_BUCKET_NAME`
- **Region**: `us-east-1`
- **API Endpoints**: All API Gateway URLs and keys
- **DynamoDB**: Table name and region
- **Cognito**: User pool and identity pool IDs

## 🔑 **What's Still Needed:**

You need to provide the actual AWS credentials. The upload will fail until you set:

### Option 1: Environment Variables (Recommended)
Set these environment variables in your app:

```bash
export AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
export AWS_SESSION_TOKEN="YOUR_AWS_SESSION_TOKEN"

# S3 Configuration
export AWS_S3_BUCKET="YOUR_S3_BUCKET_NAME"
export AWS_S3_BASE_URL="https://YOUR_S3_BUCKET_NAME.s3.us-east-1.amazonaws.com/images/"

# API Gateway URLs and Keys
export AWS_UPLOAD_API_URL="https://YOUR_API_GATEWAY_URL/Deployment/upload-image"
export AWS_UPLOAD_API_KEY="YOUR_UPLOAD_API_KEY"
export AWS_GETTAG_API_URL="https://YOUR_API_GATEWAY_URL/Stage1/get-tag"
export AWS_GETTAG_API_KEY="YOUR_GETTAG_API_KEY"
export AWS_BLOCKIMAGE_API_URL="https://YOUR_API_GATEWAY_URL/Stage1/block-image"
export AWS_BLOCKIMAGE_API_KEY="YOUR_BLOCKIMAGE_API_KEY"

# Cognito Configuration
export AWS_COGNITO_USER_POOL_ID="YOUR_COGNITO_USER_POOL_ID"
export AWS_COGNITO_USER_POOL_CLIENT_ID="YOUR_COGNITO_USER_POOL_CLIENT_ID"
export AWS_COGNITO_IDENTITY_POOL_ID="YOUR_COGNITO_IDENTITY_POOL_ID"

# DynamoDB Configuration
export DYNAMODB_TABLE="ImageSignatures"
export AWS_DYNAMODB_ENDPOINT="https://YOUR_API_GATEWAY_URL/Stage1"
export AWS_GETTAG_API_GATEWAY="https://YOUR_API_GATEWAY_URL/GetTag1"

## 🔍 **How to Get AWS Credentials:**

1. **Go to AWS Console** → IAM → Users
2. **Create a new user** or use existing one
3. **Attach policies** for S3 access:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "s3:PutObject",
           "s3:GetObject",
           "s3:ListBucket"
         ],
         "Resource": [
           "arn:aws:s3:::YOUR_S3_BUCKET_NAME",
           "arn:aws:s3:::YOUR_S3_BUCKET_NAME/*"
         ]
       }
     ]
   }
   ```
4. **Create access keys** for the user
5. **Copy the Access Key ID and Secret Access Key**

## 🧪 **Test the Configuration:**

Once you add the credentials, try uploading an image. You should see logs like:
```
🔧 [validateAwsConfig] AWS Configuration Status: { issues: 'All good!' }
🔄 [uploadImageToS3] Starting S3 upload...
✅ [uploadImageToS3] Upload successful
```

## ⚠️ **Security Note:**

- Never commit credentials to version control
- Use environment variables or AWS IAM roles
- Rotate credentials regularly
- Use least privilege principle for IAM policies 