#!/usr/bin/env bash
set -euo pipefail

#################  EDIT THESE  #################
API_UPLOAD_ID="np39lyhj20"      # uploadImage API
API_BLOCK_ID="ecf3rgso5g"       # BlockImage API
UPLOAD_STAGE="Deployment"
BLOCK_STAGE="Stage1"
BUCKET="$AWS_S3_BUCKET"
ROLE="BaatChitLambdaExecutionRole"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
###############################################

if [ -z "$BUCKET" ]; then
    echo "❌ Error: AWS_S3_BUCKET environment variable not set"
    echo "Please set AWS_S3_BUCKET environment variable"
    exit 1
fi

echo "📋 Using bucket: $BUCKET"
echo "🌍 Region: $REGION"

# 1. Binary media types for BlockImage API
aws apigateway update-rest-api \
  --rest-api-id "$API_BLOCK_ID" \
  --patch-operations \
    op=add,path=/binaryMediaTypes/-,value=image/jpeg \
    op=add,path=/binaryMediaTypes/-,value=image/png \
    op=add,path=/binaryMediaTypes/-,value=multipart/form-data \
    op=add,path=/binaryMediaTypes/-,value=*/*

# 2. Deploy API so changes take effect
aws apigateway create-deployment \
  --rest-api-id "$API_BLOCK_ID" \
  --stage-name "$BLOCK_STAGE" \
  --description "Enable binary media + CORS"

# 3. Attach basic Lambda policy and S3+DDB inline policy
aws iam attach-role-policy \
  --role-name "$ROLE" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

cat > /tmp/batchit_s3_ddb.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "Logs", "Effect": "Allow",
      "Action": [ "logs:*" ],
      "Resource": "arn:aws:logs:us-east-1:*:*" },
    { "Sid": "S3", "Effect": "Allow",
      "Action": [ "s3:GetObject", "s3:PutObject", "s3:ListBucket" ],
      "Resource": [
        "arn:aws:s3:::$BUCKET",
        "arn:aws:s3:::$BUCKET/*"
      ] },
    { "Sid": "DDB", "Effect": "Allow",
      "Action": [ "dynamodb:GetItem","dynamodb:PutItem","dynamodb:UpdateItem","dynamodb:Query" ],
      "Resource": "arn:aws:dynamodb:us-east-1:*:table/ImageSignatures"
    }
  ]
}
EOF

aws iam put-role-policy --role-name "$ROLE" \
  --policy-name BaatChitS3DDB \
  --policy-document file:///tmp/batchit_s3_ddb.json

# 4. Bucket policy + CORS
cat > /tmp/bucket_policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "AWS": "arn:aws:iam::$ACCOUNT_ID:role/$ROLE" },
    "Action": ["s3:GetObject","s3:PutObject"],
    "Resource": "arn:aws:s3:::$BUCKET/*"
  }]
}
EOF
aws s3api put-bucket-policy --bucket "$BUCKET" --policy file:///tmp/bucket_policy.json

cat > /tmp/bucket_cors.json <<'EOF'
[{
  "AllowedHeaders":["*"],
  "AllowedMethods":["GET","PUT","POST","HEAD"],
  "AllowedOrigins":["*"],
  "ExposeHeaders":["ETag","x-amz-server-side-encryption","x-amz-request-id"],
  "MaxAgeSeconds":3600
}]
EOF
aws s3api put-bucket-cors --bucket "$BUCKET" --cors-configuration file:///tmp/bucket_cors.json

# 5. Re-zip and redeploy each Lambda (adjust names if needed)
for FN in checkDuplicate block-image upload-image; do
  ZIP="/tmp/${FN}.zip"
  pushd backend/lambda-functions/$FN > /dev/null
  npm ci --omit=dev
  zip -qr "$ZIP" index.js node_modules package.json
  popd > /dev/null
  aws lambda update-function-code --function-name "$FN" --zip-file fileb://"$ZIP"
done

echo "✅  All fixes applied. Run a test image upload now."
