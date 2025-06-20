# Check Duplicate Lambda Function

A pure AWS Lambda function for detecting duplicate images using perceptual hashing. This function runs entirely on AWS without any Firebase dependencies.

## 🚀 Features

- **Perceptual Hashing**: Generates visual fingerprints of images that work across different devices and formats
- **Duplicate Detection**: Prevents the same image from being uploaded multiple times
- **Upload Limits**: Configurable maximum upload count per image (default: 3)
- **AWS Native**: Uses DynamoDB for storage and S3 for image processing
- **Serverless**: Runs on AWS Lambda with automatic scaling
- **Dual Triggers**: Supports both API Gateway (pre-upload) and S3 (post-upload) triggers

## 📋 Prerequisites

- AWS CLI configured with appropriate permissions
- DynamoDB table: `ImagePerceptualHashes`
- S3 bucket for image storage
- IAM role with Lambda execution permissions

## 🏗️ Architecture

```
Client App → API Gateway → Lambda Function → DynamoDB
                                    ↓
                                S3 (if needed)
```

## 📦 Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   ```bash
   export IMAGES_TABLE="ImagePerceptualHashes"
   export MAX_UPLOADS="3"
   export S3_BUCKET="your-s3-bucket-name"
   ```

## 🚀 Deployment

### Option 1: Using the deployment script
```bash
chmod +x deploy.sh
./deploy.sh
```

### Option 2: Manual deployment
```bash
# Install dependencies
npm install --production

# Create deployment package
npm run zip

# Deploy to AWS Lambda
aws lambda create-function \
  --function-name check-duplicate-lambda \
  --runtime nodejs18.x \
  --handler index.handler \
  --timeout 30 \
  --memory-size 512 \
  --zip-file fileb://lambda-deployment.zip \
  --region us-east-1 \
  --role arn:aws:iam::YOUR_ACCOUNT:role/lambda-execution-role
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `IMAGES_TABLE` | DynamoDB table name | `ImagePerceptualHashes` |
| `MAX_UPLOADS` | Maximum uploads per image | `3` |
| `S3_BUCKET` | S3 bucket for image storage | Required |

### DynamoDB Table Schema

```json
{
  "perceptualHash": "string (partition key)",
  "uploadCount": "number",
  "firstUpload": "string (ISO date)",
  "lastUpload": "string (ISO date)",
  "uploads": "array of upload records"
}
```

## 📡 API Usage

### Pre-upload Check (API Gateway)

**Request:**
```json
{
  "imageData": "base64-encoded-image",
  "userId": "user123",
  "fileName": "photo.jpg"
}
```

**Response (Allowed):**
```json
{
  "allowed": true,
  "blocked": false,
  "uploadUrl": "presigned-s3-url",
  "perceptualHash": "abc123...",
  "uploadCount": 1,
  "message": "New image uploaded successfully."
}
```

**Response (Blocked):**
```json
{
  "allowed": false,
  "blocked": true,
  "perceptualHash": "abc123...",
  "uploadCount": 3,
  "message": "This image has already been uploaded 3 times. No more uploads allowed."
}
```

### Post-upload Processing (S3 Trigger)

The function can also be triggered by S3 uploads for post-processing:

```json
{
  "Records": [
    {
      "s3": {
        "bucket": { "name": "my-bucket" },
        "object": { "key": "images/photo.jpg" }
      }
    }
  ]
}
```

## 🔍 Perceptual Hashing Algorithm

1. **Normalize**: Resize image to 32x32 pixels and convert to grayscale
2. **Calculate Average**: Find the average brightness of all pixels
3. **Generate Binary Hash**: Create binary string based on pixel brightness vs average
4. **Convert to Hex**: Convert binary hash to hexadecimal for compact storage

This approach ensures that:
- Similar images produce similar hashes
- Minor variations (compression, format changes) are tolerated
- The hash is consistent across different devices

## 🛠️ Development

### Local Testing

```bash
# Test the perceptual hashing
node -e "
const { generatePerceptualHash } = require('./index.js');
// Add test code here
"
```

### Logging

The function logs important events:
- Perceptual hash generation
- DynamoDB operations
- Upload decisions
- Error conditions

## 🔒 Security

- Uses AWS IAM roles for authentication
- No hardcoded credentials
- CORS headers for API Gateway integration
- Input validation for all parameters

## 📊 Monitoring

Monitor the function using:
- AWS CloudWatch Logs
- AWS CloudWatch Metrics
- DynamoDB metrics for table performance

## 🐛 Troubleshooting

### Common Issues

1. **Sharp dependency issues**: Ensure using Lambda-compatible Sharp version
2. **Memory timeout**: Increase memory allocation for large images
3. **DynamoDB permissions**: Verify IAM role has DynamoDB access
4. **S3 permissions**: Ensure Lambda can read/write to S3 bucket

### Debug Mode

Enable detailed logging by setting the log level:
```bash
export LOG_LEVEL="DEBUG"
```

## 📈 Performance

- **Cold Start**: ~2-3 seconds (includes Sharp initialization)
- **Warm Start**: ~200-500ms
- **Memory Usage**: 128-512MB depending on image size
- **Timeout**: 30 seconds (configurable)

## 🔄 Updates

To update the function:

```bash
npm install --production
npm run zip
aws lambda update-function-code \
  --function-name check-duplicate-lambda \
  --zip-file fileb://lambda-deployment.zip
```

## 📄 License

MIT License - see LICENSE file for details. 