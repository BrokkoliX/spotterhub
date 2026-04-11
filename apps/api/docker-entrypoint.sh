#!/bin/sh
set -e

echo "Fetching secrets from AWS Secrets Manager..."

# Fetch DATABASE_URL from Secrets Manager
DATABASE_URL=$(aws secretsmanager get-secret-value \
  --secret-id "spotterhub/$STAGE/DATABASE_URL" \
  --query SecretString \
  --output text \
  --region "$AWS_REGION")

export DATABASE_URL

# Fetch JWT_SECRET from Secrets Manager
JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "spotterhub/$STAGE/JWT_SECRET" \
  --query SecretString \
  --output text \
  --region "$AWS_REGION")

export JWT_SECRET

echo "Secrets loaded. Running database migrations..."

# Run Prisma migrations (idempotent — safe to run on every startup)
npx prisma migrate deploy

echo "Starting API server..."
exec node dist/index.js
