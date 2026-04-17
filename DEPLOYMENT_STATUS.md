# SpotterHub — Deployment & Operations Guide

> **Last updated:** 2026-04-17
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
13. [File Reference](#file-reference)

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

| Endpoint      | URL                                  | Status |
| ------------- | ------------------------------------ | ------ |
| Web App       | https://www.spotterspace.com         | ✅     |
| API GraphQL   | https://api.spotterspace.com/graphql | ✅     |
| API Health    | https://api.spotterspace.com/health  | ✅     |
| Apex Redirect | https://spotterspace.com → www       | ✅     |

### Key AWS Resources

| Resource            | Name / ID                                                           |
| ------------------- | ------------------------------------------------------------------- |
| ECS Cluster         | `spotterspace-cluster`                                              |
| API ECS Service     | `spotterspace-dev-api`                                              |
| Web ECS Service     | `spotterspace-dev-web`                                              |
| API ECR Repo        | `654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-api` |
| Web ECR Repo        | `654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-web` |
| API Task Definition | `spotterspace-dev-api` (rev N, image: `:latest`)                    |
| Web Task Definition | `spotterspace-dev-web` (rev N, image: `:latest`)                    |
| RDS                 | `spotterhub-db` (PostgreSQL 16.3, db.t3.medium, private subnets)    |
| S3                  | `spotterspace-photos`                                               |
| ALB                 | `spotterspace-alb`                                                  |
| Secrets Manager     | `spotterhub/DATABASE_URL`, `spotterhub/JWT_SECRET`                  |
| Route 53 Zone       | `Z00113712EMKXVCPQFWZW`                                             |
| VPC                 | `vpc-09a6870488b73260e` (10.0.0.0/20)                               |

---

## How to Deploy

### Standard Flow (push to main)

1. **Push code to `main`** → GitHub Actions automatically:
   - Runs CI checks (lint → typecheck → test → build)
   - Builds Docker images for API and Web
   - Pushes to ECR with both `:latest` and `:{sha}` tags
   - Triggers ECS redeployment for both services (~5-7 min total)

2. **Wait 2-3 minutes** for ECS to roll out the new tasks

3. **Verify:**

```bash
# Check API health
curl -s https://api.spotterspace.com/health

# Check ECS deployment status
aws ecs describe-services --cluster spotterspace-cluster \
  --services spotterspace-dev-api spotterspace-dev-web \
  --region us-east-1 --no-cli-pager \
  --query 'services[*].{Name:serviceName,Running:runningCount,Desired:desiredCount,Status:deployments[0].rolloutState}'
```

### Manual Deploy (workflow_dispatch)

Go to **GitHub Actions → Deploy to AWS → Run workflow** and choose `dev` or `prod`.

### Deploy Only API or Only Web

Only run the `update-service` command for the service you want to update:

```bash
# API only
aws ecs update-service --cluster spotterspace-cluster \
  --service spotterspace-dev-api --force-new-deployment \
  --region us-east-1 --no-cli-pager

# Web only
aws ecs update-service --cluster spotterspace-cluster \
  --service spotterspace-dev-web --force-new-deployment \
  --region us-east-1 --no-cli-pager
```

### Verify Deployment

```bash
# Check Web
curl -s -o /dev/null -w "%{http_code}" https://www.spotterspace.com
```

---

## CI/CD Pipeline

### Workflow: `.github/workflows/ci.yml`

**Trigger:** Pull requests and pushes to `main`.

```
Lint → Typecheck → Test → Build
```

Runs on every PR and every push to `main`. The build step generates the URQL client types via codegen.

### Workflow: `.github/workflows/deploy.yml`

**Trigger:** Push to `main` (paths: `apps/api/**`, `apps/web/**`, `packages/**`, `.github/workflows/deploy.yml`) or manual `workflow_dispatch`.

**Two sequential jobs:**

1. **deploy-api:** Checkout → AWS auth → ECR login → Docker build & push (`spotterspace-dev-api:latest`) → Force ECS redeployment
2. **deploy-web:** (needs `deploy-api`) Checkout → AWS auth → ECR login → Docker build & push (`spotterspace-dev-web:latest`) → Force ECS redeployment

Web job waits for API to complete before building, but the two ECS redeployments run in parallel once both images are pushed.

**Migrations:** These run automatically inside the API container via `docker-entrypoint.sh` before the server starts. The entrypoint runs `prisma migrate deploy` on every startup (idempotent, safe to re-run).

### GitHub Secrets & Variables

**Secrets:**

| Secret                     | Description                         |
| -------------------------- | ----------------------------------- |
| `AWS_ACCESS_KEY_ID`        | IAM user access key for deployments |
| `AWS_SECRET_ACCESS_KEY`    | IAM user secret key                 |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS token for map features |

**Variables:**

| Variable         | Value              | Description        |
| ---------------- | ------------------ | ------------------ |
| `AWS_ACCOUNT_ID` | `654654553862`     | AWS account number |
| `DOMAIN_NAME`    | `spotterspace.com` | Root domain        |

---

## Task Definition Management

ECS task definitions may pin Docker images to specific tags (e.g., `:sha-xxx`). If `force-new-deployment` doesn't pick up the latest image, register a new task definition revision pointing to `:latest`.

### Check Current Image Tag

```bash
aws ecs describe-task-definition --task-definition spotterspace-dev-api \
  --query 'taskDefinition.containerDefinitions[0].image' \
  --output text --no-cli-pager
```

If it shows `:latest`, a simple `force-new-deployment` will pull the newest image. If it shows a specific tag, follow the steps below.

### Update API Task Definition

```bash
# 1. Export current task definition
aws ecs describe-task-definition \
  --task-definition spotterspace-dev-api \
  --query 'taskDefinition' --no-cli-pager > /tmp/td.json

# 2. Create clean version with :latest tag (requires jq)
jq '{family,containerDefinitions,taskRoleArn,executionRoleArn,networkMode,requiresCompatibilities,cpu,memory}' \
  /tmp/td.json | sed 's|spotterspace-dev-api:[^"]*|spotterspace-dev-api:latest|g' > /tmp/clean-td.json

# 3. Register new revision
aws ecs register-task-definition \
  --cli-input-json file:///tmp/clean-td.json \
  --region us-east-1 --query 'taskDefinition.taskDefinitionArn' \
  --output text --no-cli-pager
# → outputs: arn:aws:ecs:...:task-definition/spotterspace-dev-api:NEW_REV

# 4. Update service with new revision
aws ecs update-service --cluster spotterspace-cluster \
  --service spotterspace-dev-api \
  --task-definition spotterspace-dev-api:NEW_REV \
  --force-new-deployment --region us-east-1 --no-cli-pager
```

### Update Web Task Definition

Same process, but **omit `taskRoleArn`** (the web task has no task role):

```bash
# 1. Export
aws ecs describe-task-definition \
  --task-definition spotterspace-dev-web \
  --query 'taskDefinition' --no-cli-pager > /tmp/web-td.json

# 2. Clean — note: no taskRoleArn
jq '{family,containerDefinitions,executionRoleArn,networkMode,requiresCompatibilities,cpu,memory}' \
  /tmp/web-td.json | sed 's|spotterspace-dev-web:[^"]*|spotterspace-dev-web:latest|g' > /tmp/clean-web-td.json

# 3. Register
aws ecs register-task-definition \
  --cli-input-json file:///tmp/clean-web-td.json \
  --region us-east-1 --query 'taskDefinition.taskDefinitionArn' \
  --output text --no-cli-pager

# 4. Deploy
aws ecs update-service --cluster spotterspace-cluster \
  --service spotterspace-dev-web \
  --task-definition spotterspace-dev-web:NEW_REV \
  --force-new-deployment --region us-east-1 --no-cli-pager
```

---

## Database Access

- RDS is in **private subnets** — it is **NOT accessible** from CloudShell, the internet, or your local machine
- Only ECS tasks (running in the same VPC private subnets) can reach it
- The API container runs **Prisma migrations automatically on startup** via `docker-entrypoint.sh` (idempotent — runs on every container start)
- The entrypoint also performs a one-time migration history cleanup: if old migration entries exist that are no longer in the migrations directory, it resets the history and marks the squashed init as applied
- To run ad-hoc SQL, enable **ECS Exec** on the API service and run commands inside the container

### Connection String

Stored in Secrets Manager as `spotterhub/DATABASE_URL`:

```bash
aws secretsmanager get-secret-value \
  --secret-id spotterhub/DATABASE_URL \
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

| Field    | Value               |
| -------- | ------------------- |
| Email    | `robi_sz@yahoo.com` |
| Password | `Jerusalem!25`      |
| Role     | `superuser`         |

### One-Time Seed Endpoint

The API exposes a `POST /seed` endpoint that upserts the superuser. It requires the JWT_SECRET as an auth header:

```bash
# 1. Get the JWT_SECRET value
JWT_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id spotterhub/JWT_SECRET \
  --query SecretString --output text \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['JWT_SECRET'])")

# 2. Call /seed
curl -X POST https://api.spotterspace.com/seed \
  -H "x-jwt-secret: $JWT_SECRET"
```

---

## Secrets Manager

| Secret ID                 | Contents                              |
| ------------------------- | ------------------------------------- |
| `spotterhub/DATABASE_URL` | `{"DATABASE_URL":"postgresql://..."}` |
| `spotterhub/JWT_SECRET`   | `{"JWT_SECRET":"..."}`                |

**Important:** The prefix is `spotterhub/`, NOT `spotterspace/`.

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
- **Entrypoint:** `docker-entrypoint.sh` → `prisma migrate deploy` → `node dist/index.js`
- **Port:** 4000
- **Health check:** `wget -qO- http://localhost:4000/health` (start-period 60s accounts for migration time on cold starts)
- **Startup sequence:** Run migrations → Start Apollo Server

### Web (`apps/web/Dockerfile`)

- **Multi-stage:** Node 20 Alpine (build) → Node 20 (runtime)
- **Build args:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN` (baked into bundle at build time)
- **Port:** 3000
- **Entrypoint:** `node apps/web/apps/web/server.js` (standalone output)
- **Critical path:** Next.js standalone output nests at `apps/web/apps/web/server.js` in monorepos:

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

| Record                 | Type      | Target                            |
| ---------------------- | --------- | --------------------------------- |
| `www.spotterspace.com` | CNAME     | ALB DNS name                      |
| `api.spotterspace.com` | CNAME     | ALB DNS name                      |
| `spotterspace.com`     | A (alias) | CloudFront (apex redirect to www) |

**SSL:** ACM certificate covers `spotterspace.com` + `*.spotterspace.com`, DNS-validated via Route 53.

**Nameservers:** `ns-461.awsdns-57.com`, `ns-522.awsdns-01.net`, `ns-1093.awsdns-08.org`, `ns-2031.awsdns-61.co.uk`

---

## Network & Security Groups

| Resource           | ID                                                     | Purpose                                       |
| ------------------ | ------------------------------------------------------ | --------------------------------------------- |
| VPC                | `vpc-09a6870488b73260e`                                | 10.0.0.0/20, us-east-1                        |
| Private Subnets    | `subnet-082c94f0897298f6e`, `subnet-096b774ed307c85ed` | ECS tasks + RDS                               |
| ALB + ECS SG       | `sg-08e5864c53710a095`                                 | Self-referencing, shared by ALB and ECS tasks |
| RDS SG             | `sg-0925439b428efdf13`                                 | Allows port 5432 from ECS SG                  |
| SM VPC Endpoint SG | `sg-0ddf2cd67fa1b09f0`                                 | Allows port 443 from ECS SG                   |

---

## Monitoring & Health Checks

### ALB Target Groups

| Service | Target Group                                       | Health Check      | Interval |
| ------- | -------------------------------------------------- | ----------------- | -------- |
| API     | `spotterspace-dev-api-tg` (`.../105538bfd82988b2`) | `GET /health`     | 10s      |
| Web     | `spotterspace-dev-web-tg` (`.../53bffb7b973906cb`) | `GET /api/health` | 10s      |

### CloudWatch Logs

```bash
aws logs tail /ecs/spotterspace-dev/api --since 30m --region us-east-1
aws logs tail /ecs/spotterspace-dev/web --since 30m --region us-east-1
```

### Check Target Health

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-api-tg/105538bfd82988b2 \
  --region us-east-1

aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-web-tg/53bffb7b973906cb \
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

**Cause:** Task definition is pinned to a specific tag instead of `:latest`.

**Fix:** Register a new task definition revision pointing to `:latest`. See [Task Definition Management](#task-definition-management).

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

## File Reference

| File                               | Description                                                           |
| ---------------------------------- | --------------------------------------------------------------------- |
| `.github/workflows/deploy.yml`     | Deploy workflow (Docker build + push to ECR + ECS redeploy)           |
| `.github/workflows/ci.yml`         | CI workflow (lint → typecheck → test → build)                         |
| `apps/api/Dockerfile`              | API Docker build (multi-stage, Node 20 Alpine)                        |
| `apps/api/docker-entrypoint.sh`    | API container startup (runs migrations before server)                 |
| `apps/api/src/index.ts`            | API entry point (secret loading, migrations, /seed endpoint)          |
| `apps/web/Dockerfile`              | Web Docker build (Next.js standalone)                                 |
| `apps/web/next.config.ts`          | Next.js config (standalone output, /api/graphql rewrite, S3 patterns) |
| `packages/db/prisma/schema.prisma` | Prisma schema (database models)                                       |
| `packages/db/prisma/seed.ts`       | Database seed (test users, airports, sample data)                     |
| `DEPLOYMENT_STATUS.md`             | This file                                                             |
