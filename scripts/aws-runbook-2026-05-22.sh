#!/bin/bash
#
# scripts/aws-runbook-2026-05-22.sh
#
# Runbook for the two AWS-credential-gated items remaining from the
# 2026-05-22 code review:
#
#   1. S1.1 — Provision ADMIN_API_TOKEN in Secrets Manager and wire it
#      into the ECS task definition. JWT_SECRET rotation follows.
#   2. Sprint 0 — Lambda Node.js 20.x runtime end-of-life. Identify
#      affected functions and bump them to nodejs22.x.
#
# This script is READ-ONLY by default. It enumerates resources, prints
# the exact change commands needed, and exits. To actually apply changes,
# uncomment the apply blocks marked with `# APPLY:` after reviewing the
# generated plan.
#
# Usage:
#   AWS_PROFILE=<your-profile> bash scripts/aws-runbook-2026-05-22.sh
#
# Prerequisites:
#   - AWS CLI v2 configured with credentials that have read access to
#     Secrets Manager, ECS, and Lambda in the SpotterHub account.
#   - For step 1, write access to Secrets Manager and ECS is required
#     when applying. For step 2, write access to Lambda is required.

set -euo pipefail

ACCOUNT_ID="654654553862"
CLUSTER="spotterspace-cluster"
PRIMARY_REGION="${AWS_REGION:-eu-west-1}"
LAMBDA_REGIONS=("us-east-1" "eu-west-1")

# ─── Sanity check ────────────────────────────────────────────────────────────

current_account=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [[ "$current_account" != "$ACCOUNT_ID" ]]; then
  echo "ERROR: AWS profile is for account $current_account, expected $ACCOUNT_ID."
  echo "Set AWS_PROFILE to the SpotterHub profile and try again."
  exit 1
fi
echo "Authenticated as $(aws sts get-caller-identity --query Arn --output text) in account $ACCOUNT_ID."
echo

# ─── Step 1: ADMIN_API_TOKEN provisioning (S1.1) ─────────────────────────────

echo "════════════════════════════════════════════════════════════════════════"
echo "  Step 1: ADMIN_API_TOKEN — Secrets Manager + ECS task definition"
echo "════════════════════════════════════════════════════════════════════════"
echo

# Generate a 64-character cryptographically random token. Print for review;
# do NOT pipe directly into Secrets Manager from here.
token=$(openssl rand -base64 48 | tr -d '
+/=' | cut -c1-64)
echo "Proposed ADMIN_API_TOKEN value (review and store securely BEFORE applying):"
echo
echo "    $token"
echo
echo "The exact length and entropy match the JWT_SECRET strength rule"
echo "(>=32 chars). Store this in your password manager NOW — Secrets Manager"
echo "lets you read it back, but a leak would require rotation."
echo

# Check whether the secret already exists.
if aws secretsmanager describe-secret 
     --secret-id "spotterhub/ADMIN_API_TOKEN" 
     --region "$PRIMARY_REGION" >/dev/null 2>&1; then
  echo "Secret spotterhub/ADMIN_API_TOKEN ALREADY EXISTS in $PRIMARY_REGION."
  echo "If you intend to rotate, run:"
  echo
  echo "    aws secretsmanager put-secret-value "
  echo "      --secret-id spotterhub/ADMIN_API_TOKEN "
  echo "      --secret-string '<new-token>' "
  echo "      --region $PRIMARY_REGION"
else
  echo "Secret spotterhub/ADMIN_API_TOKEN does NOT exist yet."
  echo
  echo "To create it (after you've stored the proposed token above):"
  echo
  echo "    aws secretsmanager create-secret "
  echo "      --name spotterhub/ADMIN_API_TOKEN "
  echo "      --description 'Bearer token for /seed and /admin/* HTTP endpoints' "
  echo "      --secret-string '<paste-token-here>' "
  echo "      --region $PRIMARY_REGION"
fi
echo

# Find the active ECS task definition for the api service.
echo "Looking up active api task definition..."
api_task_def_arn=$(aws ecs describe-services 
  --cluster "$CLUSTER" 
  --services api 
  --region "$PRIMARY_REGION" 
  --query 'services[0].taskDefinition' 
  --output text 2>/dev/null || echo "NONE")

if [[ "$api_task_def_arn" == "NONE" || -z "$api_task_def_arn" ]]; then
  echo "WARN: Could not resolve api service in cluster $CLUSTER. Skipping task-def step."
else
  echo "Active api task definition: $api_task_def_arn"
  echo
  echo "Fetching current task definition for inspection..."
  aws ecs describe-task-definition 
    --task-definition "$api_task_def_arn" 
    --region "$PRIMARY_REGION" 
    --query 'taskDefinition.containerDefinitions[0].secrets' 
    --output table
  echo
  echo "Add an ADMIN_API_TOKEN entry to the secrets[] array in the task"
  echo "definition. The CDK stack at infrastructure/lib/spotterspace-stack.ts"
  echo "is the canonical source — update it there and redeploy:"
  echo
  echo "    cd infrastructure"
  echo "    DOMAIN_NAME=spotterspace.com HOSTED_ZONE_ID=Z00113712EMKXVCPQFWZW "
  echo "      STAGE=dev API_IMAGE_TAG=<git-sha> WEB_IMAGE_TAG=<git-sha> "
  echo "      npx cdk deploy --require-approval never"
fi
echo

# JWT_SECRET rotation reminder.
echo "After ADMIN_API_TOKEN is in production, rotate JWT_SECRET to invalidate"
echo "any historically-leaked admin tokens that previously used the JWT_SECRET"
echo "value as a bearer:"
echo
new_jwt=$(openssl rand -base64 48 | tr -d '
+/=' | cut -c1-64)
echo "    aws secretsmanager put-secret-value "
echo "      --secret-id spotterhub/JWT_SECRET "
echo "      --secret-string '$new_jwt' "
echo "      --region $PRIMARY_REGION"
echo
echo "After rotation, force a new ECS deployment so containers pick up the"
echo "new value. All existing user JWTs become invalid; users will need to"
echo "sign in again. This is intentional."
echo

# ─── Step 2: Lambda Node.js 20.x runtime EOL (Sprint 0) ──────────────────────

echo "════════════════════════════════════════════════════════════════════════"
echo "  Step 2: Lambda Node.js 20.x → 22.x runtime upgrade (Sprint 0)"
echo "════════════════════════════════════════════════════════════════════════"
echo

# Enumerate Node.js 20.x functions in every region of interest.
total_affected=0
for region in "${LAMBDA_REGIONS[@]}"; do
  echo "─── Region: $region ───"
  affected=$(aws lambda list-functions 
    --region "$region" 
    --output text 
    --query "Functions[?Runtime=='nodejs20.x'].[FunctionName,LastModified]" 2>/dev/null || true)
  if [[ -z "$affected" ]]; then
    echo "  No Node.js 20.x functions found."
  else
    echo "$affected" | awk '{print "  • " $1 "  (last modified: " $2 ")"}'
    count=$(echo "$affected" | grep -c . || true)
    total_affected=$((total_affected + count))
  fi
  echo
done

echo "Total affected functions: $total_affected"
echo

if [[ "$total_affected" -gt 0 ]]; then
  echo "For each affected function, bump the runtime to nodejs22.x:"
  echo
  echo "    aws lambda update-function-configuration "
  echo "      --function-name <name> "
  echo "      --runtime nodejs22.x "
  echo "      --region <region>"
  echo
  echo "Node 22.x is the current Lambda LTS (support through April 2027) and"
  echo "matches the project's local Node 24 toolchain closely enough that no"
  echo "code changes should be required."
  echo
  echo "After updating each function, smoke-test by invoking it once:"
  echo
  echo "    aws lambda invoke "
  echo "      --function-name <name> "
  echo "      --region <region> "
  echo "      /tmp/lambda-output.json && cat /tmp/lambda-output.json"
  echo
  echo "Known Lambdas in the SpotterHub estate:"
  echo "  • spotterhub-keep-warm — pings the web and api health endpoints"
  echo "    every 5 minutes. Trivial; bump runtime, smoke-test once, done."
  echo "  • apps/api/src/lambda.ts — handler entrypoint compiled from the"
  echo "    monorepo. Verify whether it is actually deployed (the production"
  echo "    API runs on ECS Fargate, so this Lambda may be dormant). If it"
  echo "    is deployed, the runtime bump should be paired with a fresh"
  echo "    deploy of the latest code."
  echo
  echo "After all functions are migrated:"
  echo
  echo "    for region in ${LAMBDA_REGIONS[*]}; do"
  echo "      aws lambda list-functions --region \$region "
  echo "        --query "Functions[?Runtime=='nodejs20.x'].FunctionArn" "
  echo "        --output text"
  echo "    done"
  echo
  echo "Expected output: empty in every region."
fi

echo
echo "════════════════════════════════════════════════════════════════════════"
echo "  Done. No changes were made — review the proposed commands above."
echo "════════════════════════════════════════════════════════════════════════"
