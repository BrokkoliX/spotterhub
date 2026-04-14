# SpotterHub — Deployment & Operations Guide

> **Last updated:** 2026-04-14
> **Domain:** spotterspace.com (registered 2026-04-11 via Amazon Registrar)
> **AWS Region:** us-east-1
> **AWS Account:** 654654553862

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [CI/CD Pipeline](#cicd-pipeline)
3. [Prerequisites & First-Time Setup](#prerequisites--first-time-setup)
4. [GitHub Secrets & Variables](#github-secrets--variables)
5. [CDK Infrastructure (IaC)](#cdk-infrastructure-iac)
6. [Docker Builds](#docker-builds)
7. [DNS & HTTPS](#dns--https)
8. [Manual Deployment](#manual-deployment)
9. [Monitoring & Health Checks](#monitoring--health-checks)
10. [Troubleshooting](#troubleshooting)

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
┌──────────────┐   ┌──────────────┐       ┌──────────────┐
│ App Runner   │   │ App Runner   │       │ CloudFront   │
│ Web (Next.js)│   │ API (Apollo) │       │ Apex Redirect│
│ Port 3000    │   │ Port 4000    │       └──────────────┘
└──────────────┘   └──────┬───────┘
                          │ VPC Connector
                          │ (private subnets + NAT)
                          ▼
                   ┌──────────────┐     ┌──────────────┐
                   │ RDS Postgres │     │ S3 Bucket    │
                   │ spotterspace-db│     │ spotterspace-│
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

---

## CI/CD Pipeline

**Everything is managed by GitHub Actions.** Pushing to `main` triggers an automated deploy.

### Workflow: `.github/workflows/deploy.yml`

**Trigger:** Push to `main` (paths: `apps/**`, `packages/**`, `infrastructure/**`) or manual `workflow_dispatch`.

```
┌─────────────────┐
│  deploy-infra   │  CDK bootstrap + deploy (creates/updates all AWS resources)
│  (CDK Stack)    │  Outputs: ECR URIs, App Runner service ARNs
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│deploy-  │ │deploy-  │  Build Docker images → Push to ECR → Trigger App Runner redeploy
│api      │ │web      │  (run in parallel after infra)
└─────────┘ └─────────┘
```

**Steps per job:**

1. **deploy-infra:**
   - Checkout → Setup Node 20 → Install CDK + infra deps → Build TypeScript
   - `aws-actions/configure-aws-credentials` for auth
   - `cdk bootstrap` (idempotent, runs on every deploy)
   - `cdk deploy SpotterSpace-dev-Stack --require-approval never --outputs-file cdks-outputs.json`
   - Extract CloudFormation outputs (ECR URIs, App Runner ARNs) → pass to downstream jobs

2. **deploy-api** (needs deploy-infra):
   - Checkout → AWS auth → ECR login → Docker Buildx
   - Build `apps/api/Dockerfile` → push to ECR (`spotterspace-dev-api:latest`)
   - `aws apprunner start-deployment` → triggers rolling deploy

3. **deploy-web** (needs deploy-infra):
   - Checkout → AWS auth → ECR login → Docker Buildx
   - Build `apps/web/Dockerfile` with build args (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN`)
   - Push to ECR (`spotterspace-dev-web:latest`)
   - `aws apprunner start-deployment` → triggers rolling deploy

### Workflow: `.github/workflows/ci.yml`

**Trigger:** Pull requests and pushes to `main`.

```
Lint → Typecheck → Test (PR only) → Build
```

Runs against a PostgreSQL 16 + PostGIS service container. Tests only run on PRs (not on main pushes, since deploy.yml handles main).

### How to Deploy

**Automatic (recommended):** Push/merge to `main`. The deploy workflow handles everything.

```bash
git push origin main
# or merge a PR into main
```

**Manual dispatch:** Go to GitHub Actions → "Deploy to AWS" → "Run workflow" → Select stage (`dev`/`prod`).

---

## Prerequisites & First-Time Setup

These steps are **one-time setup** and do not need to be repeated on subsequent deploys.

### 1. AWS Resources (created manually, imported by CDK)

| Resource | Details | How to Create |
|----------|---------|---------------|
| VPC | `vpc-09a6870488b73260e` (10.0.0.0/20) with public + private subnets + NAT gateway | AWS Console or CDK |
| RDS PostgreSQL | `spotterspace-db` (PostgreSQL 16.3, db.t3.medium, private subnets) | AWS Console |
| RDS Security Group | `sg-0925439b428efdf13` (allows 5432 from VPC connector) | AWS Console |
| Secrets Manager VPC Endpoint | Security group `sg-0ddf2cd67fa1b09f0` | AWS Console |
| ECR Repository (api) | `spotterspace-dev-api` | `aws ecr create-repository --repository-name spotterspace-dev-api` |
| ECR Repository (web) | `spotterspace-dev-web` | `aws ecr create-repository --repository-name spotterspace-dev-web` |
| Secrets Manager: DATABASE_URL | `spotterspace/DATABASE_URL` (full ARN includes `-fFpNor` suffix) | AWS Console |
| Secrets Manager: JWT_SECRET | `spotterspace/JWT_SECRET` (full ARN includes `-V8C46k` suffix) | AWS Console |
| S3 Bucket | `spotterspace-photos` (for photo uploads) | AWS Console |
| Route 53 Hosted Zone | `Z00113712EMKXVCPQFWZW` for `spotterspace.com` | Created with domain registration |

### 2. Domain Registration

- Domain `spotterspace.com` registered via Amazon Registrar (2026-04-11, expires 2027-04-11)
- Nameservers automatically point to Route 53 hosted zone `Z00113712EMKXVCPQFWZW`
- **Important:** After initial registration, DNS propagation can take up to 48 hours. During this window, `DNS_PROBE_FINISHED_NXDOMAIN` errors are expected. Fix: flush local DNS cache (`sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` on macOS) and/or reboot your router.

### 3. CDK Bootstrap (one-time per account/region)

```bash
cd infrastructure
npm install
npm run build
cdk bootstrap aws://654654553862/us-east-1 
  --cloudformation-execution-policies arn:aws:iam::aws:policy/AdministratorAccess
```

> The deploy workflow also runs `cdk bootstrap` idempotently on every deploy, so this is optional locally.

### 4. Initial ECR Image Push

App Runner requires at least one image in ECR before the first CDK deploy creates the services. Push an initial image manually:

```bash
# Authenticate to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 654654553862.dkr.ecr.us-east-1.amazonaws.com

# Build and push API
docker build --platform linux/amd64 -f apps/api/Dockerfile 
  -t 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-api:latest .
docker push 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-api:latest

# Build and push Web
docker build --platform linux/amd64 -f apps/web/Dockerfile 
  --build-arg NEXT_PUBLIC_API_URL=https://api.spotterspace.com/graphql 
  -t 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-web:latest .
docker push 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-web:latest
```

---

## GitHub Secrets & Variables

Configure these in the GitHub repository settings under **Settings → Secrets and variables → Actions**.

### Secrets (sensitive values)

| Secret | Description | Example |
|--------|-------------|---------|
| `AWS_ACCESS_KEY_ID` | IAM user access key for deployments | `AKIA...` |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key | `wJal...` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox GL JS token for map features | `pk.eyJ1...` |

### Variables (non-sensitive configuration)

| Variable | Value | Description |
|----------|-------|-------------|
| `AWS_ACCOUNT_ID` | `654654553862` | AWS account number |
| `VPC_ID` | `vpc-09a6870488b73260e` | VPC containing the RDS instance |
| `DOMAIN_NAME` | `spotterspace.com` | Root domain (enables CloudFront + ACM + Route 53) |
| `HOSTED_ZONE_ID` | `Z00113712EMKXVCPQFWZW` | Route 53 hosted zone for the domain |
| `S3_BUCKET_NAME` | `spotterspace-photos` | S3 bucket for photo storage |

> **Note:** If `DOMAIN_NAME` or `HOSTED_ZONE_ID` are empty/unset, the CDK stack will skip CloudFront, ACM certificate, and Route 53 record creation — services will only be accessible via their `*.awsapprunner.com` URLs.

---

## CDK Infrastructure (IaC)

All infrastructure is defined in `infrastructure/lib/spotterspace-stack.ts` and deployed as `SpotterSpace-dev-Stack`.

### CDK-Managed Resources

| Resource | Type | Details |
|----------|------|---------|
| VPC Connector | App Runner | `spotterspace-dev-vpc-connector` in private subnets |
| API Service | App Runner | `spotterspace-dev-api`, port 4000, VPC egress |
| Web Service | App Runner | `spotterspace-dev-web`, port 3000, public egress |
| Security Group | EC2 | For VPC Connector (egress to RDS port 5432 + Secrets Manager port 443) |
| Access Role | IAM | `spotterspace-dev-apprunner-access` — ECR pull permissions |
| Instance Role | IAM | `spotterspace-dev-api-instance` — Secrets Manager read + S3 read/write |
| ACM Certificate | ACM | `*.spotterspace.com` + `spotterspace.com` (DNS-validated via Route 53) |
| Apex Distribution | CloudFront | 301 redirect `spotterspace.com` → `www.spotterspace.com` |
| CloudFront Function | CloudFront | `spotterspace-dev-apex-redirect` (viewer-request JS function) |
| DNS: A Record | Route 53 | `spotterspace.com` → CloudFront alias |
| DNS: CNAME (www) | Route 53 | `www.spotterspace.com` → Web App Runner URL |
| DNS: CNAME (api) | Route 53 | `api.spotterspace.com` → API App Runner URL |

### Imported Resources (not managed by CDK — do not delete)

| Resource | Details |
|----------|---------|
| VPC | `vpc-09a6870488b73260e` (10.0.0.0/20, us-east-1) |
| RDS | `spotterspace-db` (PostgreSQL 16.3, db.t3.medium) |
| ECR (web) | `spotterspace-dev-web` |
| ECR (api) | `spotterspace-dev-api` |
| Secrets Manager | `spotterspace/DATABASE_URL`, `spotterspace/JWT_SECRET` |
| S3 Bucket | `spotterspace-photos` |
| RDS Security Group | `sg-0925439b428efdf13` |
| Secrets Manager VPC Endpoint SG | `sg-0ddf2cd67fa1b09f0` |

### CDK Environment Variables

The CDK app (`infrastructure/bin/spotterspace.ts`) reads these env vars:

| Env Var | Required | Default | Description |
|---------|----------|---------|-------------|
| `STAGE` | No | `dev` | Deployment stage (`dev` or `prod`) |
| `DOMAIN_NAME` | No | — | Root domain (gates CloudFront/ACM/Route 53) |
| `HOSTED_ZONE_ID` | No | — | Route 53 hosted zone ID |
| `VPC_ID` | No | `vpc-09a6870488b73260e` | VPC for App Runner connector |
| `S3_BUCKET_NAME` | No | `spotterspace-photos` | S3 bucket name |
| `CDK_DEFAULT_ACCOUNT` | Yes | — | AWS account ID |
| `CDK_DEFAULT_REGION` | No | `us-east-1` | AWS region |

### CloudFormation Outputs

After deploy, these outputs are available (used by deploy-api and deploy-web jobs):

| Output | Description |
|--------|-------------|
| `ApiServiceUrl` | API App Runner URL (e.g., `japveibkai.us-east-1.awsapprunner.com`) |
| `WebServiceUrl` | Web App Runner URL |
| `ApiServiceArn` | API App Runner service ARN (for `start-deployment`) |
| `WebServiceArn` | Web App Runner service ARN |
| `ApiEcrRepositoryUri` | API ECR repo URI |
| `WebEcrRepositoryUri` | Web ECR repo URI |
| `CertificateArn` | ACM certificate ARN (if domain configured) |
| `DistributionId` | CloudFront distribution ID (if domain configured) |

---

## Docker Builds

### API (`apps/api/Dockerfile`)

- **Multi-stage build:** Node 20 Alpine
- **Build stage:** Copies entire monorepo → `npm install --workspaces --ignore-scripts` → `prisma generate` → `turbo build --filter=@spotterspace/api` → `npm prune --production`
- **Runtime stage:** Node 20 Alpine, non-root user (`nodeapp:1001`)
- **Entrypoint:** `apps/api/docker-entrypoint.sh` → runs `node dist/index.js`
- **Port:** 4000
- **Health check:** `GET /health` (wget)
- **Secret loading:** The API app loads `DATABASE_URL` and `JWT_SECRET` from AWS Secrets Manager at startup using `@aws-sdk/client-secrets-manager` (no AWS CLI needed in container)
- **Prisma migrations:** Handled by the entrypoint — `prisma migrate deploy` runs automatically on startup (idempotent)

### Web (`apps/web/Dockerfile`)

- **Multi-stage build:** Node 20 Alpine (build), Node 20 (runtime)
- **Build args:** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MAPBOX_TOKEN` (baked into the Next.js bundle at build time)
- **Build stage:** Copies workspace files → `npm install` → builds packages (`shared`, `db`, `api`) with `tsc` → `next build` (standalone output)
- **Runtime stage:** Copies standalone output + static assets
- **Port:** 3000

**⚠️ Critical: Next.js standalone nested path**
Next.js standalone output places `server.js` at `standalone/apps/web/server.js` (one level deeper than expected in monorepos). The Dockerfile handles this:
```dockerfile
COPY --from=builder /app/apps/web/.next/standalone /app/apps/web
COPY --from=builder /app/apps/web/.next/static /app/apps/web/apps/web/.next/static
CMD ["node", "apps/web/apps/web/server.js"]
```
If static assets (CSS/JS) return 404 in production, this path mapping is likely wrong.

---

## DNS & HTTPS

### Domain Configuration

| Record | Type | Target |
|--------|------|--------|
| `spotterspace.com` | A (alias) | CloudFront distribution `d1yo7g0mlwprtw.cloudfront.net` |
| `www.spotterspace.com` | CNAME | Web App Runner URL |
| `api.spotterspace.com` | CNAME | API App Runner URL |

### How It Works

1. **Apex domain** (`spotterspace.com`): Route 53 A record → CloudFront → CloudFront Function → 301 redirect to `https://www.spotterspace.com`
2. **www subdomain**: Route 53 CNAME → App Runner (web) — serves Next.js app
3. **api subdomain**: Route 53 CNAME → App Runner (api) — serves Apollo GraphQL

### SSL/TLS

- ACM certificate covers `spotterspace.com` + `*.spotterspace.com`
- Validated via DNS (Route 53 auto-creates validation CNAME records)
- CloudFront uses the certificate for apex domain
- App Runner provides its own managed TLS for `www` and `api` subdomains

### Nameservers

Managed by Route 53 hosted zone `Z00113712EMKXVCPQFWZW`:
- `ns-461.awsdns-57.com`
- `ns-522.awsdns-01.net`
- `ns-1093.awsdns-08.org`
- `ns-2031.awsdns-61.co.uk`

---

## Manual Deployment

Use these commands only when you need to deploy outside of CI/CD (e.g., hotfix, debugging).

### CDK (Infrastructure only)

```bash
cd infrastructure
npm install && npm run build

STAGE=dev 
DOMAIN_NAME=spotterspace.com 
HOSTED_ZONE_ID=Z00113712EMKXVCPQFWZW 
VPC_ID=vpc-09a6870488b73260e 
S3_BUCKET_NAME=spotterspace-photos 
CDK_DEFAULT_ACCOUNT=654654553862 
CDK_DEFAULT_REGION=us-east-1 
npx cdk deploy SpotterSpace-dev-Stack --require-approval never
```

### API Image (manual build + deploy)

```bash
# Authenticate
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 654654553862.dkr.ecr.us-east-1.amazonaws.com

# Build and push (from monorepo root)
docker build --platform linux/amd64 -f apps/api/Dockerfile 
  -t 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-api:latest .
docker push 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-api:latest

# Trigger redeploy (get ARN from CDK outputs or AWS console)
aws apprunner start-deployment --service-arn <ApiServiceArn>
```

### Web Image (manual build + deploy)

```bash
# Build and push (from monorepo root)
docker build --platform linux/amd64 -f apps/web/Dockerfile 
  --build-arg NEXT_PUBLIC_API_URL=https://api.spotterspace.com/graphql 
  --build-arg NEXT_PUBLIC_MAPBOX_TOKEN=<your-token> 
  -t 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-web:latest .
docker push 654654553862.dkr.ecr.us-east-1.amazonaws.com/spotterspace-dev-web:latest

# Trigger redeploy
aws apprunner start-deployment --service-arn <WebServiceArn>
```

---

## Monitoring & Health Checks

### App Runner Health Checks

| Service | Endpoint | Interval | Healthy/Unhealthy Thresholds |
|---------|----------|----------|-------------------------------|
| API | `GET /health` | 10s | 2 healthy / 3 unhealthy |
| Web | `GET /api/health` | 10s | 2 healthy / 3 unhealthy |

### Verifying Endpoints

```bash
# Web
curl -s -o /dev/null -w "%{http_code}" https://www.spotterspace.com

# API health
curl -s https://api.spotterspace.com/health

# API GraphQL
curl -s -X POST https://api.spotterspace.com/graphql 
  -H "Content-Type: application/json" 
  -d '{"query":"{ __typename }"}'

# DNS resolution
dig spotterspace.com A +short
dig www.spotterspace.com CNAME +short
dig api.spotterspace.com CNAME +short
```

### App Runner Logs

```bash
# API logs
aws apprunner list-operations --service-arn <ApiServiceArn>

# Web logs
aws apprunner list-operations --service-arn <WebServiceArn>

# Full logs are available in CloudWatch Logs:
#   /aws/apprunner/spotterspace-dev-api/*/application
#   /aws/apprunner/spotterspace-dev-web/*/application
```

---

## Troubleshooting

### DNS_PROBE_FINISHED_NXDOMAIN

**Cause:** Local DNS cache holds a stale NXDOMAIN response from before the domain was registered.

**Fix:**
1. Flush local DNS: `sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder` (macOS)
2. Flush browser DNS: Chrome → `chrome://net-internals/#dns` → Clear host cache
3. Reboot router (clears router DNS cache)
4. Try alternate DNS: `1.1.1.1` (Cloudflare) or `8.8.8.8` (Google)

### CSS/JS 404s on Production Web App

**Cause:** Next.js standalone output nested path mismatch in Dockerfile.

**Fix:** Ensure the Dockerfile copies static files to the correct nested path:
```dockerfile
COPY --from=builder /app/apps/web/.next/standalone /app/apps/web
COPY --from=builder /app/apps/web/.next/static /app/apps/web/apps/web/.next/static
CMD ["node", "apps/web/apps/web/server.js"]
```

### App Runner Deployment Stuck / Failing

```bash
# Check service status
aws apprunner describe-service --service-arn <ServiceArn> --query 'Service.Status'

# Check recent operations
aws apprunner list-operations --service-arn <ServiceArn> --query 'OperationSummaryList[0]'

# Force redeploy with latest image
aws apprunner start-deployment --service-arn <ServiceArn>
```

### CDK Deploy Fails

- **"Resource already exists":** The CDK stack has drifted. Check AWS Console for manually-created resources conflicting with CDK-managed ones. Import or delete the conflicting resource.
- **VPC lookup fails:** Ensure `VPC_ID` is correct and `CDK_DEFAULT_ACCOUNT`/`CDK_DEFAULT_REGION` are set (CDK needs them for context lookups).
- **ACM certificate stuck in validation:** Check Route 53 for the CNAME validation records. If missing, CDK may need a fresh deploy or the hosted zone ID is wrong.

### API Can't Connect to RDS

- Verify the VPC Connector is in private subnets with NAT gateway
- Check security group `sg-0925439b428efdf13` allows inbound 5432 from the App Runner security group
- Check Secrets Manager contains the correct `DATABASE_URL` with the RDS endpoint
- Verify the Secrets Manager VPC Endpoint security group (`sg-0ddf2cd67fa1b09f0`) allows inbound 443

### Secret Loading Fails

The API loads secrets from AWS Secrets Manager at startup using `@aws-sdk/client-secrets-manager`. The instance role (`spotterspace-dev-api-instance`) must have `secretsmanager:GetSecretValue` permission for both secret ARNs. Check CloudWatch logs for error messages.

---

## File Reference

| File | Description |
|------|-------------|
| `infrastructure/bin/spotterspace.ts` | CDK app entry point (reads env vars) |
| `infrastructure/lib/spotterspace-stack.ts` | Full CDK stack definition |
| `.github/workflows/deploy.yml` | Deploy workflow (CDK + Docker + App Runner) |
| `.github/workflows/ci.yml` | CI workflow (lint, typecheck, test, build) |
| `apps/api/Dockerfile` | API Docker build (multi-stage, Node 20 Alpine) |
| `apps/api/docker-entrypoint.sh` | API container startup script |
| `apps/web/Dockerfile` | Web Docker build (Next.js standalone) |
| `apps/web/next.config.ts` | Next.js config (standalone output, S3 remote patterns) |
| `docker/docker-compose.yml` | Local dev services (Postgres, Redis, LocalStack) |
| `packages/db/prisma/schema.prisma` | Prisma schema (database models) |
