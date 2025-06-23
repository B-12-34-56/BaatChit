// AWS Lambda Handler for Blocking Images
const { DynamoDBClient, PutItemCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');

// AWS Configuration - Use environment variables
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE || 'YOUR_DYNAMODB_TABLE',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  fields: {
    hashFieldName: 'ContentHash',
    timestampFieldName: 'Timestamp',
    blockedFieldName: 'Blocked',
    blockedReasonFieldName: 'BlockedReason',
  },
}; 