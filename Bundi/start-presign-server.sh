#!/bin/bash

# Start the presign server for Bundi uploads
echo "🚀 Starting Presign Server for Bundi..."

# Set environment variables for the presign server
export AWS_BUCKET=process.env.AWS_S3_BUCKET
export AWS_REGION=process.env.AWS_REGION
export AWS_ACCESS_KEY_ID=process.env.AWS_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=process.env.AWS_SECRET_ACCESS_KEY
export AWS_SESSION_TOKEN=process.env.AWS_SESSION_TOKEN
export S3_SUBFOLDER=process.env.S3_SUBFOLDER

echo "📋 Configuration:"
echo "  Bucket: $AWS_BUCKET"
echo "  Region: $AWS_REGION"
echo "  Subfolder: $S3_SUBFOLDER"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🌐 Starting server on http://localhost:4000"
node presign-server.js 