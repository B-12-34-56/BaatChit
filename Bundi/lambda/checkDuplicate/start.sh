#!/bin/bash

# Start the duplicate check service
echo "🚀 Starting Duplicate Check Service..."

# Set environment variables
export AWS_REGION="${AWS_REGION:-us-east-1}"
export AWS_ACCESS_KEY_ID="${AWS_ACCESS_KEY_ID:-}"
export AWS_SECRET_ACCESS_KEY="${AWS_SECRET_ACCESS_KEY:-}"
export AWS_SESSION_TOKEN="${AWS_SESSION_TOKEN:-}"
export HASH_TABLE="${HASH_TABLE:-ImageSignatures}"
export S3_BUCKET="${AWS_S3_BUCKET:-}"

echo "📋 Configuration:"
echo "  Region: $AWS_REGION"
echo "  Hash Table: $HASH_TABLE"
echo "  S3 Bucket: $S3_BUCKET"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Start the service
echo "🌐 Starting service on http://localhost:3001"
node index.js 