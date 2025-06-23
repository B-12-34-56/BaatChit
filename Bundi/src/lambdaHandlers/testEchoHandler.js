// AWS Lambda Handler for Testing Echo Functionality
// This is a simple test handler that echoes back the input

exports.handler = async (event, context) => {
  console.log('🔧 Test Echo Handler - Event:', JSON.stringify(event, null, 2));
  console.log('🔧 Test Echo Handler - Context:', JSON.stringify(context, null, 2));

  try {
    // Parse the request body
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = event.body || {};
    }

    // Echo back the input with some additional info
    const response = {
      success: true,
      message: 'Test echo handler working correctly',
      timestamp: new Date().toISOString(),
      input: {
        body: body,
        headers: event.headers,
        queryStringParameters: event.queryStringParameters,
        pathParameters: event.pathParameters,
        httpMethod: event.httpMethod,
        path: event.path,
        requestContext: {
          requestId: event.requestContext?.requestId,
          stage: event.requestContext?.stage,
          httpMethod: event.requestContext?.httpMethod,
        }
      },
      handler: {
        name: 'test-echo-handler',
        version: '1.0.0',
        region: process.env.AWS_REGION || 'YOUR_AWS_REGION',
        memoryLimit: context.memoryLimitInMB,
        remainingTime: context.getRemainingTimeInMillis(),
      }
    };

    console.log('✅ Test Echo Handler - Response:', JSON.stringify(response, null, 2));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify(response)
    };

  } catch (error) {
    console.error('❌ Test Echo Handler - Error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      })
    };
  }
}; 