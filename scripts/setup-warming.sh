#!/bin/bash
# ─── Keep-Warm Scheduler ───────────────────────────────────────────────────
# Creates a CloudWatch Events rule + Lambda that pings your services
# every 5 minutes to prevent cold starts.
#
# Usage: ./setup-warming.sh
# Requires: AWS CLI configured with appropriate credentials

set -e

DOMAIN="${DOMAIN_NAME:-spotterspace.com}"
WEB_URL="https://www.${DOMAIN}"
API_URL="https://api.${DOMAIN}/health"
FUNCTION_NAME="spotterhub-keep-warm"
SCHEDULE_EXPRESSION="rate(5 minutes)"

echo "Setting up keep-warm cron for ${DOMAIN}..."

# ─── Lambda IAM Role ─────────────────────────────────────────────────────────
ROLE_NAME="spotterhub-keep-warm-lambda-role"
ROLE_ARN=$(aws iam create-role \
  --role-name "${ROLE_NAME}" \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "lambda.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --query 'Role.Arn' \
  --output text 2>/dev/null || echo "Role may already exist")

echo "Role: ${ROLE_ARN}"

# ─── Lambda Function ─────────────────────────────────────────────────────────
# Tiny function that pings URLs and logs response
LAMBDA_ZIP="/tmp/keep-warm.zip"
cat > /tmp/keep-warm.py << 'EOF'
import urllib3
import json

http = urllib3.PoolManager()

def lambda_handler(event, context):
    urls = [
        "https://www.spotterspace.com",
        "https://api.spotterspace.com/health"
    ]
    results = []
    for url in urls:
        try:
            r = http.request('GET', url, timeout=5)
            results.append({"url": url, "status": r.status})
        except Exception as e:
            results.append({"url": url, "error": str(e)})
    print(json.dumps({"pinged": results}))
    return {"statusCode": 200, "body": json.dumps(results)}
EOF

cd /tmp
echo "def lambda_handler(event, context):
    import urllib3, json
    http = urllib3.PoolManager()
    urls = [\"https://www.spotterspace.com\", \"https://api.spotterspace.com/health\"]
    results = []
    for url in urls:
        try:
            r = http.request('GET', url, timeout=5)
            results.append({'url': url, 'status': r.status})
        except Exception as e:
            results.append({'url': url, 'error': str(e)})
    print(json.dumps({'pinged': results}))
    return {'statusCode': 200, 'body': json.dumps(results)}" > keep-warm.py

zip -q "${LAMBDA_ZIP}" keep-warm.py

# Attach basic execution policy to role
aws iam put-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-name "keep-warm-logs" \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["logs:CreateLogGroup", "logs:CreateLogStream", "logs:PutLogEvents"],
      "Resource": "arn:aws:logs:*:*:*"
    }]
  }' 2>/dev/null || true

aws lambda create-function \
  --function-name "${FUNCTION_NAME}" \
  --runtime "python3.11" \
  --role "${ROLE_ARN}" \
  --handler "keep-warm.lambda_handler" \
  --zip-body "fileb://${LAMBDA_ZIP}" \
  --timeout 10 \
  --memory-size 128 \
  2>/dev/null || aws lambda update-function-code \
    --function-name "${FUNCTION_NAME}" \
    --zip-body "fileb://${LAMBDA_ZIP}" > /dev/null

echo "Lambda function created/updated: ${FUNCTION_NAME}"

# ─── CloudWatch Event Rule ───────────────────────────────────────────────────
RULE_NAME="spotterhub-keep-warm-rule"

aws events put-rule \
  --name "${RULE_NAME}" \
  --schedule-expression "cron(0/5 * * * ? *)" \
  --state ENABLED \
  2>/dev/null || aws events put-rule \
    --name "${RULE_NAME}" \
    --schedule-expression "cron(0/5 * * * ? *)" \
    --state ENABLED > /dev/null

echo "CloudWatch Event rule created: ${RULE_NAME}"

# ─── Permission ─────────────────────────────────────────────────────────────
aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id "cloudwatch-events-permission" \
  --action "lambda:InvokeFunction" \
  --principal "events.amazonaws.com" \
  --source-arn "$(aws events describe-rule --name "${RULE_NAME}" --query 'Arn' --output text)" \
  2>/dev/null || true

# ─── Target ─────────────────────────────────────────────────────────────────
aws events put-targets \
  --rule "${RULE_NAME}" \
  --targets '[{"Id": "keep-warm-target", "Arn": "'"$(aws lambda get-function --function-name "${FUNCTION_NAME}" --query 'Configuration.FunctionArn' --output text)"'"}]' \
  2>/dev/null || aws events put-targets \
    --rule "${RULE_NAME}" \
    --targets '[{"Id": "keep-warm-target", "Arn": "'"$(aws lambda get-function --function-name "${FUNCTION_NAME}" --query 'Configuration.FunctionArn' --output text)"'"}]' > /dev/null

echo "✅ Keep-warm setup complete!"
echo ""
echo "Pings https://www.${DOMAIN} and https://api.${DOMAIN}/health every 5 minutes."
echo "Expected cost: ~$0.50/month"