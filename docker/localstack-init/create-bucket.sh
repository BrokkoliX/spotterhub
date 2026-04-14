#!/bin/bash
# Auto-create the S3 bucket on LocalStack startup.
# This runs as a "ready" hook — after LocalStack services are available.

echo "🪣 Creating spotterspace-photos bucket..."
awslocal s3 mb s3://spotterspace-photos --region us-east-1 2>/dev/null || true
echo "✅ Bucket ready."
