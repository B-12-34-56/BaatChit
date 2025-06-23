require('dotenv').config();

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
const AWS_SESSION_TOKEN = "IQoJb3JpZ2luX2VjECMaCXVzLWVhc3QtMSJHMEUCIDtTJh/AqOYVlBzZkh8gz9vvtRQkaaphU01OutBFIU0NAiEAo2lQqbqroIAWDf77mn997NACpCCm2KPoO2L4fsmzK3oq4wIIHBAAGgw3Mzk4NzQyMzgwOTEiDPD4t4I3LpU+Ki1gsirAAvyvP6TnjxdjTivZU1yTlWxUTPQcdZe2nP0OvQPU6IBcMw8n17XLKLRqMrSrV05hR/rz8Syhay/RPB69+xLZWkaTMtZT0IzNsirPmXtNyksHnx7opLkGmK/zz7FJKLaigL36jJR4uD8Hrmbqgrl5A2MYtmGJkWJk4HMbrtb6sc73FJTfopU5QNkIoun/NowQNijh9eWI1bPDOXKiX6K/pugDsHu+RiSZxmuC9EcxoIKi7gq6iQ2p8Q5hWYnlQVEfZki7Qcb0vCXhkENlM7Iap6TYEx8vFGgPEiG0SL7Oh7dGsQfpip4qOqwtzBt2EOiw42Nhu92z4K8r2topQn56yBzzS8At/J1yZENu0jjzX3CWhgAfncwbgZvvV/oL6CBDC6CV2AGZD+zFwv+KiEYiFdArP6SKLfwu8ZKpQAgTrdU+MMGG5sIGOq0CqYs+suV2TlOcY4j4XVZBSIytreqoMwKP/XKSEAM89V+7u1TXGjCLlK3o5/grNiCedUkxgSYUYomwgrw3zzxJC8DgxWXpowL/zyu+7My8uJEaFSnNONTNJsbzqpIpNaGAfBAk1rLD0UTuaH9ePPrMEe9QYg2X3wUpHIQHCWnHQ2YBHZC7Z9J7T1ozfo95owtFMjHGB7JJj9ID0TZXjkrfUgjh7hYLP4ViD3eLf2iQiCbo3V3noR7nMuTYB0sTote3qh212CEdZDC/St6Dh9nsVsaLetF42hjghZPEqN9+OnuzBRJgN5CO//j4ucOuBEOOeyK6leR0a+OC9Cd4cM90cOGQoDEDp+ZdumYQFgOt4P5MNi0Dsq+jWEK9OuRMp1E5xylGVsu8rLgOPXqXtA==";
const S3_SUBFOLDER = 'images/';

console.log('🔧 AWS Configuration:', {
  bucket: AWS_BUCKET,
  region: AWS_REGION,
  hasAccessKey: !!AWS_ACCESS_KEY_ID,
  hasSecretKey: !!AWS_SECRET_ACCESS_KEY
});

const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  }
});

// CORS middleware - more permissive for React Native
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple presign endpoint
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

// Health check endpoint
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

app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Simple presign server running on http://0.0.0.0:${port}`);
  console.log(`🌐 Accessible at http://192.168.10.106:${port}`);
  console.log('📋 Available endpoints:');
  console.log('  POST /presign - Get presigned URL');
  console.log('  GET  /health - Health check');
}); 