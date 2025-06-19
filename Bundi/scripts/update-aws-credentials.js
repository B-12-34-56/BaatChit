#!/usr/bin/env node

/**
 * Script to update AWS credentials in aws.js
 * 
 * Usage:
 * 1. Get new AWS credentials from AWS Console or CLI
 * 2. Run: node scripts/update-aws-credentials.js
 * 3. Enter the new credentials when prompted
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const awsFilePath = path.join(__dirname, '../src/utils/aws.js');

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function updateCredentials() {
  console.log('🔧 AWS Credentials Update Tool');
  console.log('==============================\n');
  
  try {
    // Read the current aws.js file
    let awsFileContent = fs.readFileSync(awsFilePath, 'utf8');
    
    console.log('Current credentials found:');
    const accessKeyMatch = awsFileContent.match(/aws_access_key_id.*?['"]([^'"]+)['"]/);
    const secretKeyMatch = awsFileContent.match(/aws_secret_access_key.*?['"]([^'"]+)['"]/);
    
    if (accessKeyMatch) {
      console.log(`Access Key ID: ${accessKeyMatch[1].substring(0, 8)}...`);
    }
    if (secretKeyMatch) {
      console.log(`Secret Access Key: ${secretKeyMatch[1].substring(0, 8)}...`);
    }
    
    console.log('\n⚠️  Current credentials appear to be temporary (expired)');
    console.log('Please provide new AWS credentials:\n');
    
    // Get new credentials
    const newAccessKeyId = await question('New AWS Access Key ID: ');
    const newSecretAccessKey = await question('New AWS Secret Access Key: ');
    
    if (!newAccessKeyId || !newSecretAccessKey) {
      console.log('❌ Both Access Key ID and Secret Access Key are required');
      rl.close();
      return;
    }
    
    // Validate access key format
    if (!newAccessKeyId.startsWith('AKIA') && !newAccessKeyId.startsWith('ASIA')) {
      console.log('⚠️  Warning: Access Key ID should start with AKIA (permanent) or ASIA (temporary)');
    }
    
    // Update the credentials in the file
    let updatedContent = awsFileContent;
    
    // Update access key
    updatedContent = updatedContent.replace(
      /(aws_access_key_id.*?['"])[^'"]*(['"])/,
      `$1${newAccessKeyId}$2`
    );
    
    // Update secret key
    updatedContent = updatedContent.replace(
      /(aws_secret_access_key.*?['"])[^'"]*(['"])/,
      `$1${newSecretAccessKey}$2`
    );
    
    // Write the updated file
    fs.writeFileSync(awsFilePath, updatedContent, 'utf8');
    
    console.log('\n✅ AWS credentials updated successfully!');
    console.log(`📁 Updated file: ${awsFilePath}`);
    console.log('\n🔒 Security Note:');
    console.log('- Consider using environment variables instead of hardcoded credentials');
    console.log('- For production, use AWS IAM roles or temporary credentials');
    console.log('- Rotate credentials regularly for security');
    
  } catch (error) {
    console.error('❌ Error updating credentials:', error.message);
  } finally {
    rl.close();
  }
}

// Run the script
updateCredentials().catch(console.error); 