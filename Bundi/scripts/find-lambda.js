const AWS = require('aws-sdk');

// Configure AWS
AWS.config.update({
  region: 'us-east-1',
  accessKeyId: 'ASIA2YQ7Q52FQVGK7NR6',
  secretAccessKey: 'Gj6RvYYoS30yZEJ6BVIhle/SeooqG7MKfJRF84AD'
});

const lambda = new AWS.Lambda();
const apigateway = new AWS.APIGateway();

async function findLambdaFunction() {
  try {
    console.log('🔍 Searching for Lambda functions...');
    
    // List all Lambda functions
    const functions = await lambda.listFunctions().promise();
    
    console.log(`📋 Found ${functions.Functions.length} Lambda functions:`);
    
    functions.Functions.forEach((func, index) => {
      console.log(`${index + 1}. ${func.FunctionName} (${func.Runtime})`);
      console.log(`   Description: ${func.Description || 'No description'}`);
      console.log(`   Last Modified: ${func.LastModified}`);
      console.log(`   Code Size: ${func.CodeSize} bytes`);
      console.log('');
    });
    
    // Also try to find the API Gateway integration
    console.log('🔍 Searching for API Gateway integrations...');
    
    try {
      const apis = await apigateway.getRestApis().promise();
      
      console.log(`📋 Found ${apis.items.length} API Gateway APIs:`);
      
      for (const api of apis.items) {
        console.log(`API: ${api.name} (${api.id})`);
        
        try {
          const resources = await apigateway.getResources({ restApiId: api.id }).promise();
          
          for (const resource of resources.items) {
            if (resource.resourceMethods) {
              for (const [method, methodData] of Object.entries(resource.resourceMethods)) {
                if (methodData.integration && methodData.integration.uri) {
                  console.log(`  ${method} ${resource.path} -> ${methodData.integration.uri}`);
                }
              }
            }
          }
        } catch (error) {
          console.log(`  Error getting resources for API ${api.name}: ${error.message}`);
        }
        
        console.log('');
      }
    } catch (error) {
      console.log(`Error getting API Gateway info: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    
    if (error.code === 'UnrecognizedClientException') {
      console.log('💡 The credentials might be invalid or expired.');
      console.log('💡 You may need to get fresh credentials from AWS.');
    }
  }
}

// Run the search
if (require.main === module) {
  findLambdaFunction()
    .then(() => {
      console.log('✅ Search completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Search failed:', error.message);
      process.exit(1);
    });
}

module.exports = { findLambdaFunction }; 