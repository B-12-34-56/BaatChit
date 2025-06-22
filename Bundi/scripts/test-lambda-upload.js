const AWS = require('aws-sdk');
const { S3Client } = require('@aws-sdk/client-s3');

// Configure AWS with the same credentials
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN,
});

const lambda = new AWS.Lambda();
const s3Client = new S3Client({
  region: 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken: process.env.AWS_SESSION_TOKEN,
  }
});

// Create a small test image (1x1 pixel PNG)
const createTestImage = () => {
  // This is a minimal 1x1 pixel PNG image in base64
  return 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
};

async function testLambdaUpload() {
  try {
    console.log('🔍 Testing Lambda upload function...');
    
    const testImage = createTestImage();
    const testHash = 'test-hash-123';
    const testUserId = 'test-user-456';
    
    // Create the test event (simulating API Gateway)
    const testEvent = {
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        image: testImage,
        filename: 'test-image.png',
        imageHash: testHash,
        contentType: 'image/png',
        userId: testUserId
      })
    };
    
    console.log('📤 Test event created:', {
      hasImage: !!testEvent.body.includes('image'),
      hasFilename: !!testEvent.body.includes('filename'),
      hasImageHash: !!testEvent.body.includes('imageHash'),
      hasContentType: !!testEvent.body.includes('contentType'),
      hasUserId: !!testEvent.body.includes('userId'),
      bodyLength: testEvent.body.length
    });
    
    // Invoke the Lambda function
    console.log('🚀 Invoking Lambda function...');
    const result = await lambda.invoke({
      FunctionName: 'UploadToS3',
      Payload: JSON.stringify(testEvent)
    }).promise();
    
    console.log('✅ Lambda invocation successful');
    console.log('📄 Response status code:', result.StatusCode);
    
    const payload = JSON.parse(result.Payload);
    console.log('📄 Response payload:', JSON.stringify(payload, null, 2));
    
    if (payload.statusCode === 200) {
      const body = JSON.parse(payload.body);
      console.log('🎉 Upload successful!');
      console.log('🔗 Image URL:', body.imageUrl);
      console.log('📊 Upload details:', {
        success: body.success,
        blocked: body.blocked,
        totalCount: body.totalCount,
        uploadCount: body.uploadCount,
        message: body.message
      });
    } else {
      console.log('❌ Upload failed');
      console.log('🔍 Error details:', payload);
    }
    
  } catch (error) {
    console.error('❌ Lambda test failed:', error);
    console.error('🔍 Error details:', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode
    });
  }
}

// Run the test
testLambdaUpload(); 