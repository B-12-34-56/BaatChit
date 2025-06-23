// AWS Lambda Handler for Image Duplicate Detection
const { DynamoDBClient, QueryCommand, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb');
const crypto = require('crypto');

// AWS Configuration - Use environment variables
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  dynamodb: {
    tableName: process.env.DYNAMODB_TABLE || 'YOUR_DYNAMODB_TABLE',
    region: process.env.AWS_REGION || 'us-east-1',
  },
  s3: {
    bucketName: process.env.S3_BUCKET || 'YOUR_S3_BUCKET_NAME',
    baseURL: process.env.S3_BASE_URL || 'YOUR_S3_BASE_URL',
  },
  fields: {
    hashFieldName: 'ContentHash',
    timestampFieldName: 'Timestamp',
    ttlFieldName: 'TTL',
  },
  app: {
    defaultTTLInDays: 30,
  },
}; 