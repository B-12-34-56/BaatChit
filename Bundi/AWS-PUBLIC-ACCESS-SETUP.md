# AWS S3 Public Access Setup Guide

This guide will help you configure your AWS S3 bucket (`YOUR_S3_BUCKET_NAME`) for public access uploads.

## 🚨 Important Security Notice

⚠️ **This configuration allows public access to your S3 bucket. Anyone can upload and read files from your bucket.**
- Only use this for applications where public access is required
- Consider implementing additional security measures like file validation, size limits, and content filtering
- Monitor your bucket usage and costs regularly

## 📋 Prerequisites

1. **AWS CLI installed** and configured with appropriate permissions
2. **Node.js** installed (for running the configuration script)
3. **AWS credentials** with S3 permissions for your bucket

## 🔧 Step 1: Set Environment Variables

Set your AWS credentials as environment variables:

```bash
export AWS_ACCESS_KEY_ID="YOUR_AWS_ACCESS_KEY_ID"
export AWS_SECRET_ACCESS_KEY="YOUR_AWS_SECRET_ACCESS_KEY"
export AWS_SESSION_TOKEN="YOUR_AWS_SESSION_TOKEN"  # Optional, for temporary credentials
export AWS_REGION="us-east-1"

# S3 Configuration
export AWS_S3_BUCKET="YOUR_S3_BUCKET_NAME"
export AWS_S3_BASE_URL="https://YOUR_S3_BUCKET_NAME.s3.us-east-1.amazonaws.com/images/"
```

## 🔧 Step 2: Install Dependencies

Install the required AWS SDK:

```bash
cd Bundi
npm install @aws-sdk/client-s3
```

## 🔧 Step 3: Run the Configuration Script

Execute the public access configuration script:

```bash
node scripts/setup-public-access.js
```

This script will:
- ✅ Apply CORS configuration allowing public access
- ✅ Set bucket policy for public read/write access
- ✅ Verify the configuration was applied correctly

## 🔧 Step 4: Manual AWS Console Configuration (Alternative)

If you prefer to configure manually through the AWS Console:

### CORS Configuration
1. Go to S3 Console → Your Bucket → Permissions → CORS
2. Replace the existing configuration with:

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }
]
```

### Bucket Policy
1. Go to S3 Console → Your Bucket → Permissions → Bucket Policy
2. Apply the policy from `bucket-policy.json`:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*"
        },
        {
            "Sid": "AllowPresignedUploads",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::YOUR_ACCOUNT_ID:user/YOUR_IAM_USER"
            },
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*"
        },
        {
            "Sid": "AllowLambdaUploads",
            "Effect": "Allow",
            "Principal": {
                "Service": "lambda.amazonaws.com"
            },
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl"
            ],
            "Resource": "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*",
            "Condition": {
                "StringEquals": {
                    "aws:SourceAccount": "YOUR_ACCOUNT_ID"
                }
            }
        }
    ]
}
```

### Block Public Access Settings
1. Go to S3 Console → Your Bucket → Permissions → Block Public Access
2. **Uncheck** all the following options:
   - ✅ Block all public access
   - ✅ Block public access to buckets and objects granted through new access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through any access control lists (ACLs)
   - ✅ Block public access to buckets and objects granted through new public bucket or access point policies
   - ✅ Block public access to buckets and objects granted through any public bucket or access point policies
   - ✅ Block public and cross-account access to buckets and objects through any public bucket or access point policies

## 🔧 Step 5: Update Your App Configuration

Your app is already configured with the correct AWS settings:

```javascript
// From your configuration
s3BucketName = "YOUR_S3_BUCKET_NAME"
s3Region = "us-east-1"
s3ImagesPath = "images/"
s3BaseURL = "https://YOUR_S3_BUCKET_NAME.s3.us-east-1.amazonaws.com/images/"
```

## 🧪 Step 6: Test the Configuration

### Test Upload via API
Your app uses these API endpoints for uploads:
- **Upload**: `[YOUR_UPLOAD_API_URL]`
- **Get Tag**: `[YOUR_GET_TAG_API_URL]`
- **Block Image**: `[YOUR_BLOCK_IMAGE_API_URL]`

### Test Direct S3 Upload
You can test direct uploads using the presigned URL approach in your app.

## 📊 Monitoring and Security

### Enable CloudTrail Logging
1. Go to CloudTrail Console
2. Create a trail for your S3 bucket
3. Monitor for unusual access patterns

### Set Up CloudWatch Alarms
1. Monitor bucket size and request counts
2. Set up alerts for unusual activity

### Implement Content Validation
Consider adding Lambda functions to:
- Validate file types and sizes
- Scan for malicious content
- Implement rate limiting

## 🔒 Additional Security Recommendations

1. **File Type Validation**: Only allow specific file types (images, documents)
2. **File Size Limits**: Set maximum file size limits
3. **Content Scanning**: Use AWS Rekognition or similar for content moderation
4. **Rate Limiting**: Implement API Gateway rate limiting
5. **Access Logging**: Enable S3 access logging
6. **Lifecycle Policies**: Set up automatic deletion of old files

## 🆘 Troubleshooting

### Common Issues

1. **403 Forbidden Error**
   - Check bucket policy is applied correctly
   - Verify CORS configuration
   - Ensure Block Public Access is disabled

2. **CORS Error in Browser**
   - Verify CORS configuration allows your domain
   - Check that AllowedOrigins includes your domain or "*"

3. **Upload Fails**
   - Check IAM permissions for the user/role
   - Verify bucket name and region are correct
   - Check file size limits

### Verification Commands

```bash
# Check bucket policy
aws s3api get-bucket-policy --bucket YOUR_S3_BUCKET_NAME

# Check CORS configuration
aws s3api get-bucket-cors --bucket YOUR_S3_BUCKET_NAME

# Check public access block settings
aws s3api get-public-access-block --bucket YOUR_S3_BUCKET_NAME
```

## 📞 Support

If you encounter issues:
1. Check AWS CloudWatch logs
2. Review S3 access logs
3. Verify all configuration steps were completed
4. Test with a simple file upload first

---

**Configuration completed!** Your S3 bucket is now configured for public access uploads. 🎉 