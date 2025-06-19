#!/bin/bash

# Start the presign server for Bundi uploads
echo "🚀 Starting Presign Server for Bundi..."

# Set environment variables for the presign server
export AWS_BUCKET="2314823894myawsbucket"
export AWS_REGION="us-east-1"
export AWS_ACCESS_KEY_ID="ASIA2YQ7Q52F5Z77ZWA4"
export AWS_SECRET_ACCESS_KEY="BlVMTyiVfWNlhpMN9S7IvJwG/DQ+9FF+s5ZEVut7"
export AWS_SESSION_TOKEN=""
export S3_SUBFOLDER="images/"

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