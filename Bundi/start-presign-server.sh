#!/bin/bash

# Start the presign server with proper environment variables
set -e

echo "🚀 Starting Presign Server..."

# Set environment variables - use environment variables or placeholders
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_BUCKET="${AWS_BUCKET:-YOUR_S3_BUCKET_NAME}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-YOUR_AWS_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-YOUR_AWS_SECRET_ACCESS_KEY}"
export PORT="${PORT:-4000}"

echo "🔧 Environment configuration:"
echo "   AWS_REGION: $AWS_REGION"
echo "   AWS_BUCKET: $AWS_BUCKET"
echo "   AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
echo "   PORT: $PORT"

# Check if required environment variables are set
if [ "$AWS_BUCKET" = "YOUR_S3_BUCKET_NAME" ]; then
    echo "⚠️  Warning: AWS_BUCKET not set, using placeholder"
fi

if [ "$AWS_ACCESS_KEY_ID" = "YOUR_AWS_ACCESS_KEY_ID" ]; then
    echo "⚠️  Warning: AWS_ACCESS_KEY_ID not set, using placeholder"
fi

if [ "$AWS_SECRET_ACCESS_KEY" = "YOUR_AWS_SECRET_ACCESS_KEY" ]; then
    echo "⚠️  Warning: AWS_SECRET_ACCESS_KEY not set, using placeholder"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the server
echo "🌐 Starting presign server on port $PORT..."
node presign-server.js 