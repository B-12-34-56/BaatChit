# Presigned URL Upload Implementation Guide

This guide documents the complete presigned URL upload functionality implemented in Bundi, following AWS best practices.

## Overview

The presigned URL upload system allows secure direct uploads to S3 without exposing AWS credentials to the client. The flow is:

```
mobile-app ──POST /presign──▶ presign-svc ──STS/role──▶ S3
                          ▲                       │
         ② multipart POST │                       │ ① create policy / URL
                          └───────────────upload──┘
```

## Key Components

### 1. getPresignedUrl.js
**Location**: `src/apiHelpers/getPresignedUrl.js`

**Function**: `getPresignedUrl(filename, contentType = 'image/jpeg', method = 'post')`

**Usage**:
```javascript
import { getPresignedUrl } from '../apiHelpers/getPresignedUrl';

// Get presigned URL for upload
const { method, uploadUrl, uploadFields, s3Key } = await getPresignedUrl(
  'my-image.jpg', 
  'image/jpeg', 
  'post'
);
```

**Returns**:
- `method`: Upload method ('post' or 'put')
- `uploadUrl`: Presigned URL for S3 upload
- `uploadFields`: Form fields for POST method
- `s3Key`: Generated S3 key for the file

### 2. Presign Server
**Location**: `presign-server.js`

**Endpoints**:
- `POST /presign` - Recommended method
- `GET /presign` - Backward compatibility

**Configuration**:
```bash
# Environment variables needed
AWS_BUCKET=your-s3-bucket-name
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_SUBFOLDER=images/
```

### 3. Upload Service
**Location**: `src/services/uploadService.js`

**Function**: `uploadImage({ fileUri, filename, fileHash, contentType, userId })`

**Usage**:
```javascript
import { uploadImage } from '../services/uploadService';

const result = await uploadImage({
  fileUri: 'file://path/to/image.jpg',
  filename: 'my-image.jpg',
  fileHash: 'abc123...',
  contentType: 'image/jpeg',
  userId: 'user123'
});
```

## Upload Methods

### POST Method (Recommended)
Uses multipart form data for uploads. More reliable and supports larger files.

```javascript
// 1. Get presigned URL
const { uploadUrl, uploadFields, s3Key } = await getPresignedUrl(filename, contentType, 'post');

// 2. Upload using FormData
const form = new FormData();
Object.entries(uploadFields).forEach(([k, v]) => form.append(k, v));
const fileBlob = await (await fetch(localUri)).blob();
form.append('file', fileBlob); // MUST be last

const res = await fetch(uploadUrl, { method: 'POST', body: form });
if (!res.ok) throw new Error(`S3 POST failed: ${res.status}`);
```

### PUT Method (Alternative)
Direct blob upload. Simpler but may have limitations with large files.

```javascript
// 1. Get presigned URL
const { uploadUrl, s3Key } = await getPresignedUrl(filename, contentType, 'put');

// 2. Upload blob directly
const blob = await (await fetch(localUri)).blob();
const res = await fetch(uploadUrl, { 
  method: 'PUT', 
  body: blob,
  headers: { 'Content-Type': contentType }
});
```

## CORS Configuration

**Location**: `cors.json`

```json
[
    {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["POST", "PUT"],
        "AllowedOrigins": ["*"],
        "MaxAgeSeconds": 3000
    }
]
```

Apply to your S3 bucket using AWS CLI:
```bash
aws s3api put-bucket-cors --bucket your-bucket-name --cors-configuration file://cors.json
```

## IAM Policy Requirements

The presign server needs the following IAM policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "UploadToS3",
      "Effect": "Allow",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::YOUR_S3_BUCKET_NAME/images/*"
    }
  ]
}
```

## Testing

Run the test script to verify functionality:

```bash
cd Bundi
node test-presigned-upload.js
```

## Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure CORS is properly configured on S3 bucket
   - Check that AllowedOrigins includes your domain

2. **403 Forbidden**
   - Verify IAM permissions for S3 PutObject
   - Check AWS credentials are valid

3. **Upload Fails**
   - Ensure presigned URL hasn't expired (15 minutes)
   - Check file size limits
   - Verify content type matches

4. **Network Errors**
   - Check presign server is running on correct port
   - Verify network connectivity to AWS

### Debug Steps

1. Check presign server logs:
   ```bash
   node presign-server.js
   ```

2. Test presign endpoint directly:
   ```bash
   curl -X POST http://localhost:4000/presign \
     -H "Content-Type: application/json" \
     -d '{"filename":"test.jpg","contentType":"image/jpeg","method":"post"}'
   ```

3. Verify S3 bucket permissions and CORS configuration

## Security Considerations

1. **Presigned URLs expire** after 15 minutes
2. **File validation** happens on the presign server
3. **Blocked keywords** prevent malicious filenames
4. **No AWS credentials** are exposed to the client
5. **Content-Type validation** ensures proper file types

## Performance Tips

1. **Use POST method** for larger files (>5MB)
2. **Implement retry logic** for failed uploads
3. **Cache presigned URLs** for multiple uploads
4. **Monitor upload progress** for better UX
5. **Compress images** before upload when possible

## Integration with Existing Code

The implementation is designed to work with existing upload flows:

```javascript
// Existing upload code continues to work
const result = await uploadImage({
  fileUri: imageUri,
  filename: 'profile.jpg',
  fileHash: await generateHash(imageUri),
  contentType: 'image/jpeg',
  userId: currentUser.id
});

// Result includes success status and image URL
if (result.success) {
  console.log('Upload successful:', result.imageUrl);
}
```

## File Structure

```
Bundi/
├── src/
│   ├── apiHelpers/
│   │   └── getPresignedUrl.js          # Main presigned URL helper
│   └── services/
│       └── uploadService.js            # Upload service with presigned URLs
├── presign-server.js                   # Presign server implementation
├── cors.json                          # S3 CORS configuration
├── test-presigned-upload.js           # Test script
└── PRESIGNED-UPLOAD-GUIDE.md          # This guide
```

## Next Steps

1. **Deploy presign server** to production environment
2. **Update environment variables** with production AWS credentials
3. **Configure CORS** for production domains
4. **Set up monitoring** for upload success rates
5. **Implement file cleanup** for failed uploads 