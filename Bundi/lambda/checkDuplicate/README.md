# Duplicate Check Backend Service

A Node.js backend service for detecting duplicate images using perceptual hashing.

## Features

- **Perceptual Hashing**: Uses dHash algorithm to detect visually similar images
- **Cross-Device Detection**: Same image on different devices will be detected as duplicate
- **Global State**: Uses DynamoDB to track uploads across all users
- **Pre-signed URLs**: Secure direct upload to S3
- **Upload Limits**: Maximum 3 uploads per unique image

## Setup

### 1. Install Dependencies
```bash
cd lambda/checkDuplicate
npm install
```

### 2. Set Environment Variables
Create a `.env` file or set environment variables:
```bash
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export HASH_TABLE=ImageSignatures
export S3_BUCKET=process.env.AWS_S3_BUCKET
export PORT=3001
```

### 3. Create DynamoDB Table
```bash
aws dynamodb create-table \
  --table-name ImagePerceptualHashes \
  --attribute-definitions AttributeName=perceptualHash,AttributeType=S \
  --key-schema AttributeName=perceptualHash,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

## Running the Service

### Option 1: Using the startup script
```bash
./start.sh
```

### Option 2: Manual start
```bash
npm start
```

### Option 3: Development mode (with auto-restart)
```bash
npm run dev
```

## API Endpoints

### POST /check-duplicate
Check if an image is a duplicate and get upload permission.

**Request Body:**
```json
{
  "imageData": "base64_encoded_image",
  "fileHash": "original_file_hash",
  "userId": "user_id"
}
```

**Response (Allowed):**
```json
{
  "allowed": true,
  "uploadUrl": "pre_signed_s3_url",
  "perceptualHash": "computed_hash",
  "uploadCount": 1,
  "isDuplicate": false,
  "message": "Upload allowed"
}
```

**Response (Blocked):**
```json
{
  "allowed": false,
  "perceptualHash": "computed_hash",
  "uploadCount": 3,
  "isDuplicate": true,
  "message": "Upload blocked: This image has already been uploaded 3 times"
}
```

### GET /health
Health check endpoint.

### POST /test-hash
Test endpoint for computing perceptual hashes.

## How It Works

1. **Image Normalization**: Resizes to 256x256 and converts to grayscale
2. **Perceptual Hashing**: Computes dHash (difference hash) for visual fingerprinting
3. **DynamoDB Check**: Looks up hash in database and increments count
4. **Conditional Update**: Only allows upload if count < 3
5. **Pre-signed URL**: Returns secure S3 upload URL if allowed

## Integration with React Native

The React Native app calls this service at `http://localhost:3001/check-duplicate` during image upload.

## Troubleshooting

### Service won't start
- Check if port 3001 is available
- Verify AWS credentials are set
- Ensure DynamoDB table exists

### Images not detected as duplicates
- Check if perceptual hashing is working (use `/test-hash` endpoint)
- Verify DynamoDB table has correct schema
- Check AWS permissions

### Upload fails
- Verify S3 bucket exists and is accessible
- Check pre-signed URL expiration (5 minutes)
- Ensure CORS is configured on S3 bucket

## Testing

Test the service with curl:
```bash
# Health check
curl http://localhost:3001/health

# Test hash computation
curl -X POST http://localhost:3001/test-hash \
  -H "Content-Type: application/json" \
  -d '{"imageData":"base64_image_data"}'
``` 