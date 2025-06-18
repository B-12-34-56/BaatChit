// ENV VARS NEEDED:
// AWS_REGION, AWS_BUCKET, S3_IMAGES_PATH, S3_BASE_URL
// COGNITO_USER_POOL_ID, COGNITO_CLIENT_ID, COGNITO_IDENTITY_POOL_ID
import Constants from 'expo-constants';

const getEnv = (key, fallback = '') =>
  process.env[key] || Constants.expoConfig?.extra?.[key] || fallback;

export const getMigrationConfig = () => ({
  region: getEnv('AWS_REGION', 'us-east-1'),
  bucket: getEnv('AWS_BUCKET', ''),
  s3Bucket: getEnv('AWS_BUCKET', ''),
  s3Region: getEnv('AWS_REGION', 'us-east-1'),
  s3ImagesPath: getEnv('S3_IMAGES_PATH', 'images/'),
  s3BaseUrl: getEnv('S3_BASE_URL', ''),
  cognitoUserPoolId: getEnv('COGNITO_USER_POOL_ID', ''),
  cognitoClientId: getEnv('COGNITO_CLIENT_ID', ''),
  cognitoIdentityPoolId: getEnv('COGNITO_IDENTITY_POOL_ID', ''),
});

export const validateMigrationConfig = () => {
  const config = getMigrationConfig();
  const required = ['region', 'bucket', 's3Bucket', 's3Region'];
  
  const missing = required.filter(key => !config[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required migration config: ${missing.join(', ')}`);
  }
  
  return config;
};

export const logMigrationStatus = () => {
  const config = getMigrationConfig();
  console.log('Migration Configuration:', {
    region: config.region,
    bucket: config.bucket,
    s3ImagesPath: config.s3ImagesPath,
    hasCognito: !!(config.cognitoUserPoolId && config.cognitoClientId),
  });
}; 