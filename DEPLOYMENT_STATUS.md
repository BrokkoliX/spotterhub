# SpotterHub — Deployment & Operations Guide

> **Last updated:** 2026-04-15
> **Domain:** spotterspace.com (registered 2026-04-11 via Amazon Registrar)
> **AWS Region:** us-east-1
> **AWS Account:** 654654553862

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How to Deploy](#how-to-deploy)
3. [CI/CD Pipeline](#cicd-pipeline)
4. [Task Definition Management](#task-definition-management)
5. [Database Access](#database-access)
6. [Superuser & Auth](#superuser--auth)
7. [Secrets Manager](#secrets-manager)
8. [Docker Builds](#docker-builds)
9. [DNS & HTTPS](#dns--https)
10. [Network & Security Groups](#network--security-groups)
11. [Monitoring & Health Checks](#monitoring--health-checks)
12. [Troubleshooting](#troubleshooting)
13. [TODO: Known Issues](#todo-known-issues)
14. [File Reference](#file-reference)

---

## Architecture Overview

```
                 ┌─ spotterspace.com ─┐
                 │   CloudFront       │
                 │   301 → www        │
                 └────────────────────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
www.spotterspace.com   api.spotterspace.com   spotterspace.com
    CNAME                  CNAME                  A (alias)
    │                      │                      │
    ▼                      ▼                      ▼
┌──────────────────────────────────────┐  ┌──────────────┐
│         ALB (spotterspace-alb)       │  │ CloudFront   │
│  :443 HTTPS  ─── host-based rules   │  │ Apex Redirect│
│  :80  HTTP   ─── host-based rules   │  └──────────────┘
│  api.* → apiTG   │  www.* → webTG   │
└──────┬───────────────────┬───────────┘
       │                   │
       ▼                   ▼
┌──────────────┐   ┌──────────────┐
│ ECS Fargate  │   │ ECS Fargate  │
│ API (Apollo) │   │ Web (Next.js)│
│ Port 4000    │   │ Port 3000    │
│ Private Subs │   │ Private Subs │
└──────┬───────┘   └──────────────┘
       │ (private subnets + NAT)
       ▼
┌──────────────┐     ┌──────────────┐
│ RDS Postgres │     │ S3 Bucket    │
│ spotterhub-db│     │ spotterspace-│
│ Port 5432    │     │ photos       │
└──────────────┘     └──────────────┘
```

### Live Endpoints

| Endpoint | URL | Status |
|----------|-----|--------|
| Web App | https://www.spotterspace.com | ✅ |
| API GraphQL | https://api.spotterspace.com/graphql | ✅ |
| API Health | https://api.spotterspace.com/health | ✅ |
| Apex Redirect | https://spotterspace.com → www | ✅ |

### Key AWS Resources

| Resource | Name / ID |
|----------|-----------|
| ECS Cluster | `spotterspace-cluster` |
| API ECS Service | `spotterspace-dev-api` |
| Web ECS Service | `spotterspace-dev-web` |
| API ECR Repo | `654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-api` |
| Web ECR Repo | `654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-web` |
| API Task Definition | `spotterspace-dev-api` (rev 11, image: `:latest`) |
| Web Task Definition | `spotterspace-dev-web` (rev 10, image: `:latest`) |
| RDS | `spotterhub-db` (PostgreSQL 16.3, db.t3.medium, private subnets) |
| S3 | `spotterspace-photos` |
| ALB | `spotterspace-alb` |
| Secrets Manager | `spotterhub/DATABASE_URL`, `spotterhub/JWT_SECRET` |
| Route 53 Zone | `Z00113712EMKXVCPQFWZW` |
| VPC | `vpc-09a6870488b73260e` (10.0.0.0/20) |

---

## How to Deploy

### Quick Reference (most common flow)

1. **Push code to `main`** → GitHub Actions automatically builds Docker images and pushes to ECR (~5 min)
2. **Trigger ECS redeployment** from **AWS CloudShell** (GitHub Actions can't do this yet — see [Known Issues](#todo-known-issues)):

```bash
# API
aws ecs update-service --cluster spotterspace-cluster 
  --service spotterspace-dev-api --force-new-deployment 
  --region us-east-1 --no-cli-pager

# Web
aws ecs update-service --cluster spotterspace-cluster 
  --service spotterspace-dev-web --force-new-deployment 
  --region us-east-1 --no-cli-pager
```

3. **Wait 2-3 minutes** for ECS to roll out the new tasks
4. **Verify** by visiting https://api.spotterspace.com/health and https://www.spotterspace.com

### Deploy Only API or Only Web

Only run the `update-service` command for the service you want to update. GitHub Actions builds both images on every push, so both `:latest` tags are always up to date in ECR.

### Verify Deployment

```bash
# Check deployment status
aws ecs describe-services --cluster spotterspace-cluster 
  --services spotterspace-dev-api spotterspace-dev-web 
  --region us-east-1 --no-cli-pager 
  --query 'services[*].{Name:serviceName,Running:runningCount,Desired:desiredCount,Status:deployments[0].rolloutState}'

# Check API
curl -s https://api.spotterspace.com/health

# Check Web
curl -s -o /dev/null -w "%{http_code}" https://www.spotterspace.com
```

---

## CI/CD Pipeline

### Workflow: `.github/workflows/deploy.yml`

**Trigger:** Push to `main` (paths: `apps/**`, `packages/**`, `infrastructure/**`, `.github/workflows/deploy.yml`) or manual `workflow_dispatch`.

**Two parallel jobs:**

1. **deploy-api:** Checkout → AWS auth → ECR login → Docker build & push (`spotterspace-dev-api:latest`) → Force ECS redeployment
2. **deploy-web:** Checkout → AWS auth → ECR login → Docker build & push (`spotterspace-dev-web:latest`) → Force ECS redeployment

**⚠️ The "Force ECS redeployment" step currently fails** due to missing IAM permissions on the GitHub Actions user. Docker images are pushed successfully. See [Known Issues](#todo-known-issues).

### Workflow: `.github/workflows/ci.yml`

**Trigger:** Pull requests and pushes to `main`.

```
Lint → Typecheck → Test (PR only) → Build
```

### GitHub Secrets & Variables

**Secrets:**

| Secret | Description |
|--------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user access key for deployments |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS token for map features |

**Variables:**

| Variable | Value | Description |
|----------|-------|-------------|
| `AWS_ACCOUNT_ID` | `654654553862` | AWS account number |
| `VPC_ID` | `vpc-09a6870488b73260e` | VPC ID |
| `DOMAIN_NAME` | `spotterspace.com` | Root domain |
| `HOSTED_ZONE_ID` | `Z00113712EMKXVCPQFWZW` | Route 53 hosted zone |
| `S3_BUCKET_NAME` | `spotterspace-photos` | S3 bucket for photos |

---

## Task Definition Management

ECS task definitions may pin Docker images to specific tags (e.g., `:v5`, `:v6`). If `force-new-deployment` doesn't pick up the latest image, you need to register a new task definition revision pointing to `:latest`.

### Check Current Image Tag

```bash
aws ecs describe-task-definition --task-definition spotterspace-dev-api 
  --query 'taskDefinition.containerDefinitions[0].image' 
  --output text --no-cli-pager
```

If it shows `:latest`, a simple `force-new-deployment` will pull the newest image. If it shows a pinned tag (e.g., `:v5`), follow the steps below.

### Update API Task Definition

```bash
# 1. Export current task definition
aws ecs describe-task-definition 
  --task-definition spotterspace-dev-api 
  --query 'taskDefinition' --no-cli-pager > /tmp/td.json

# 2. Create clean version with :latest tag (requires jq)
jq '{family,containerDefinitions,taskRoleArn,executionRoleArn,networkMode,requiresCompatibilities,cpu,memory}' 
  /tmp/td.json | sed 's|spotterspace-dev-api:[^"]*|spotterspace-dev-api:latest|g' > /tmp/clean-td.json

# 3. Register new revision
aws ecs register-task-definition 
  --cli-input-json file:///tmp/clean-td.json 
  --region us-east-1 --query 'taskDefinition.taskDefinitionArn' 
  --output text --no-cli-pager
# → outputs: arn:aws:ecs:...:task-definition/spotterspace-dev-api:NEW_REV

# 4. Update service with new revision
aws ecs update-service --cluster spotterspace-cluster 
  --service spotterspace-dev-api 
  --task-definition spotterspace-dev-api:NEW_REV 
  --force-new-deployment --region us-east-1 --no-cli-pager
```

### Update Web Task Definition

Same process, but **omit `taskRoleArn`** (the web task has no task role):

```bash
# 1. Export
aws ecs describe-task-definition 
  --task-definition spotterspace-dev-web 
  --query 'taskDefinition' --no-cli-pager > /tmp/web-td.json

# 2. Clean — note: no taskRoleArn
jq '{family,containerDefinitions,executionRoleArn,networkMode,requiresCompatibilities,cpu,memory}' 
  /tmp/web-td.json | sed 's|spotterspace-dev-web:[^"]*|spotterspace-dev-web:latest|g' > /tmp/clean-web-td.json

# 3. Register
aws ecs register-task-definition 
  --cli-input-json file:///tmp/clean-web-td.json 
  --region us-east-1 --query 'taskDefinition.taskDefinitionArn' 
  --output text --no-cli-pager

# 4. Deploy
aws ecs update-service --cluster spotterspace-cluster 
  --service spotterspace-dev-web 
  --task-definition spotterspace-dev-web:NEW_REV 
  --force-new-deployment --region us-east-1 --no-cli-pager
```

---

## Database Access

- RDS is in **private subnets** — it is **NOT accessible** from CloudShell, the internet, or your local machine
- Only ECS tasks (running in the same VPC private subnets) can reach it
- The API container runs **Prisma migrations automatically on startup** (idempotent)
- To run ad-hoc SQL, you would need to:
  - Enable **ECS Exec** on the API service and run commands inside the container
  - Set up a **bastion host** or **VPN** in the VPC

### Connection String

Stored in Secrets Manager as `spotterhub/DATABASE_URL`:

```bash
aws secretsmanager get-secret-value 
  --secret-id spotterhub/DATABASE_URL 
  --query SecretString --output text
```

Output format: `{"DATABASE_URL":"postgresql://user:pass@spotterhub-db.xxx.us-east-1.rds.amazonaws.com:5432/spotterhub"}`

---

## Superuser & Auth

### Dev Auth Mode

The API uses a dev-mode authentication system (not AWS Cognito):
- **signUp** mutation creates a user with a SHA-256 hashed password stored as `cognitoSub` (prefix `dev1-`)
- **signIn** mutation verifies the password by recomputing the hash

### Production Superuser

| Field | Value |
|-------|-------|
| Email | `robi_sz@yahoo.com` |
| Password | `Jerusalem!25` |
| Role | `superuser` |

### One-Time Seed Endpoint

The API exposes a `POST /seed` endpoint that upserts the superuser. It requires the JWT_SECRET as an auth header:

```bash
# 1. Get the JWT_SECRET value
JWT_SECRET=$(aws secretsmanager get-secret-value 
  --secret-id spotterhub/JWT_SECRET 
  --query SecretString --output text 
  | python3 -c "import sys,json; print(json.load(sys.stdin)['JWT_SECRET'])")

# 2. Call /seed
curl -X POST https://api.spotterspace.com/seed 
  -H "x-jwt-secret: $JWT_SECRET"
```

---

## Secrets Manager

| Secret ID | Contents |
|-----------|----------|
| `spotterhub/DATABASE_URL` | `{"DATABASE_URL":"postgresql://..."}` |
| `spotterhub/JWT_SECRET` | `{"JWT_SECRET":"..."}` |

**⚠️ Important:** The prefix is `spotterhub/`, NOT `spotterspace/`.

The API loads these at startup via `@aws-sdk/client-secrets-manager`. They are fetched directly by the app code using the ECS task role — not injected via ECS task definition secrets.

### Retrieve Secrets (from CloudShell)

```bash
aws secretsmanager get-secret-value --secret-id spotterhub/DATABASE_URL --query SecretString --output text
aws secretsmanager get-secret-value --secret-id spotterhub/JWT_SECRET --query SecretString --output text
```

---

## Docker Builds

### API (`apps/api/Dockerfile`)

- **Multi-stage:** Node 20 Alpine (build) → Node 20 Alpine (runtime)
- **Build:** Copies monorepo → `npm install --workspaces --ignore-scripts` → `prisma generate` → `turbo build --filter=@spotterspace/api` → `npm prune --production`
- **Runtime:** Non-root user (`nodeapp:1001`)
- **Entrypoint:** `docker-entrypoint.sh` → `node dist/index.js`
- **Port:** 4000
- **Health check:** `wget -qO- http://localhost:4000/health`
- **Startup sequence:** Load secrets from Secrets Manager → Run Prisma migrations → Start Apollo Server

### Web (`apps/web/Dockerfile`)

- **Multi-stage:** Node 20 Alpine (build) → Node 20 (runtime)
- **Build args:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN` (baked into bundle at build time)
- **Port:** 3000
- **⚠️ Critical path:** Next.js standalone output nests at `apps/web/apps/web/server.js` in monorepos:

```dockerfile
COPY --from=builder /app/apps/web/.next/standalone /app/apps/web
COPY --from=builder /app/apps/web/.next/static /app/apps/web/apps/web/.next/static
CMD ["node", "apps/web/apps/web/server.js"]
```

### Key Configuration

- Next.js rewrites `/api/graphql` → `NEXT_PUBLIC_API_URL` (proxy to API server, avoids CORS)
- The rewrite is defined in `apps/web/next.config.ts`

---

## DNS & HTTPS

| Record | Type | Target |
|--------|------|--------|
| `www.spotterspace.com` | CNAME | ALB DNS name |
| `api.spotterspace.com` | CNAME | ALB DNS name |
| `spotterspace.com` | A (alias) | CloudFront (apex redirect to www) |

**SSL:** ACM certificate covers `spotterspace.com` + `*.spotterspace.com`, DNS-validated via Route 53.

**Nameservers:** `ns-461.awsdns-57.com`, `ns-522.awsdns-01.net`, `ns-1093.awsdns-08.org`, `ns-2031.awsdns-61.co.uk`

---

## Network & Security Groups

| Resource | ID | Purpose |
|----------|----|---------|
| VPC | `vpc-09a6870488b73260e` | 10.0.0.0/20, us-east-1 |
| Private Subnets | `subnet-082c94f0897298f6e`, `subnet-096b774ed307c85ed` | ECS tasks + RDS |
| ALB + ECS SG | `sg-08e5864c53710a095` | Self-referencing, shared by ALB and ECS tasks |
| RDS SG | `sg-0925439b428efdf13` | Allows port 5432 from ECS SG |
| SM VPC Endpoint SG | `sg-0ddf2cd67fa1b09f0` | Allows port 443 from ECS SG |

---

## Monitoring & Health Checks

### ALB Target Groups

| Service | Target Group | Health Check | Interval |
|---------|-------------|--------------|----------|
| API | `spotterspace-dev-api-tg` (`.../105538bfd82988b2`) | `GET /health` | 10s |
| Web | `spotterspace-dev-web-tg` (`.../53bffb7b973906cb`) | `GET /api/health` | 10s |

### CloudWatch Logs

```bash
aws logs tail /ecs/spotterspace-dev/api --since 30m --region us-east-1
aws logs tail /ecs/spotterspace-dev/web --since 30m --region us-east-1
```

### Check Target Health

```bash
aws elbv2 describe-target-health 
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-api-tg/105538bfd82988b2 
  --region us-east-1

aws elbv2 describe-target-health 
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-web-tg/53bffb7b973906cb 
  --region us-east-1
```

### ECS Task Status

```bash
aws ecs list-tasks --cluster spotterspace-cluster --region us-east-1 --desired-status RUNNING --no-cli-pager

aws ecs describe-tasks --cluster spotterspace-cluster --tasks TASK_ARN --region us-east-1 --no-cli-pager
```

---

## Troubleshooting

### ECS Redeployment Doesn't Pick Up New Image

**Cause:** Task definition is pinned to a specific tag (e.g., `:v5`) instead of `:latest`.

**Fix:** Register a new task definition revision pointing to `:latest`. See [Task Definition Management](#task-definition-management).

### CSS/JS 404s on Production Web App

**Cause:** Next.js standalone output nested path mismatch in Dockerfile.

**Fix:** Ensure static files are copied to the correct nested path in `apps/web/Dockerfile`.

### API Can't Connect to RDS

1. Verify ECS tasks are in private subnets with NAT gateway
2. Check RDS SG (`sg-0925439b428efdf13`) allows inbound 5432 from ECS SG (`sg-08e5864c53710a095`)
3. Check Secrets Manager contains the correct `DATABASE_URL` with the RDS endpoint
4. Verify Secrets Manager VPC Endpoint SG (`sg-0ddf2cd67fa1b09f0`) allows inbound 443 from ECS SG

### CloudShell Can't Connect to RDS

**This is expected.** CloudShell runs outside the VPC. RDS is only accessible from within the VPC (ECS tasks). See [Database Access](#database-access).

### DNS_PROBE_FINISHED_NXDOMAIN

**Fix:** Flush local DNS cache:

```bash
# macOS
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

### Secrets Manager: "Secret Not Found"

**Check:** The prefix is `spotterhub/`, NOT `spotterspace/`:

```bash
aws secretsmanager list-secrets --query "SecretList[].Name" --output table
```

---

## TODO: Known Issues

1. **GitHub Actions IAM permissions:** The `AWS_ACCESS_KEY_ID` used by GitHub Actions lacks `ecs:UpdateService` and `ecs:DescribeServices` permissions. Add these to the IAM user/policy so the deploy workflow can trigger ECS redeployments automatically (eliminating the manual CloudShell step).

2. **CI lint failure:** ESLint fails on `apps/web/src/app/api/health/route.ts` because the pre-commit hook runs ESLint from the root, which doesn't find the web app's flat config. Needs investigation.

3. **CDK stack is stale:** The CDK infrastructure code (`infrastructure/`) still has old references. The deploy workflow no longer uses CDK. If infrastructure changes are needed, the CDK stack should be updated to reflect the current ECS Fargate architecture.

---

## File Reference

| File | Description |
|------|-------------|
| `.github/workflows/deploy.yml` | Deploy workflow (Docker build + push to ECR + ECS redeploy) |
| `.github/workflows/ci.yml` | CI workflow (lint, typecheck, test, build) |
| `apps/api/Dockerfile` | API Docker build (multi-stage, Node 20 Alpine) |
| `apps/api/docker-entrypoint.sh` | API container startup script |
| `apps/api/src/index.ts` | API entry point (secret loading, migrations, /seed endpoint) |
| `apps/web/Dockerfile` | Web Docker build (Next.js standalone) |
| `apps/web/next.config.ts` | Next.js config (standalone output, /api/graphql rewrite, S3 patterns) |
| `infrastructure/lib/spotterspace-stack.ts` | CDK stack definition (stale — see known issues) |
| `docker/docker-compose.yml` | Local dev services (Postgres, Redis, LocalStack) |
| `packages/db/prisma/schema.prisma` | Prisma schema (database models) |
| `packages/db/prisma/seed.ts` | Database seed (test users, airports, sample data) |
| `scripts/upsert-superuser.sql` | SQL script to upsert superuser (for direct DB access) |
| `DEPLOYMENT_STATUS.md` | This file |
