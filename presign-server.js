const express = require('express');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const app = express();
const port = process.env.PORT || 4000;

// AWS Configuration - Use environment variables
const AWS_BUCKET = process.env.AWS_BUCKET || "YOUR_S3_BUCKET_NAME";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "YOUR_AWS_ACCESS_KEY_ID";
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "YOUR_AWS_SECRET_ACCESS_KEY";

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }
});

app.use(express.json());

app.post('/presign', async (req, res) => {
  const { filename, contentType = 'image/jpeg' } = req.body;
  
  if (!filename) {
    return res.status(400).json({ error: 'filename required' });
  }

  const key = `images/${Date.now()}_${filename}`;

  try {
    const command = new PutObjectCommand({
      Bucket: AWS_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    
    const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 });
    
    res.json({ 
      presignedUrl,
      key: key,
      bucket: AWS_BUCKET
    });
  } catch (err) {
    console.error('Presign error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    config: {
      region: AWS_REGION,
      bucket: AWS_BUCKET
    }
  });
});

app.listen(port, () => {
  console.log(`🚀 Presign server running on http://localhost:${port}`);
  console.log(`📋 Health check: http://localhost:${port}/health`);
  console.log(`📤 Presign endpoint: http://localhost:${port}/presign`);
}); 