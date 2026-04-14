# ECS Fargate — ALB Health Check Issue

**Date**: 2026-04-15
**Status**: RESOLVED — Root cause identified and fix applied.

## Resolution

**Root cause:** The ECS `CfnService` definitions were missing `loadBalancers` configuration. Without this, ECS does not automatically register task IPs with the ALB target groups. Every time tasks restarted (e.g., after a CDK redeploy), new IPs were assigned but never registered with the target groups, so the ALB had no healthy targets to forward to.

**Fix applied in `infrastructure/lib/spotterspace-stack.ts`:**
1. Added `loadBalancers` property to both API and Web `CfnService` definitions, linking each service to its respective target group. ECS now automatically registers/deregisters task IPs.
2. Added explicit `addDependency()` calls so ECS services are created only after the ALB listeners and target groups exist in CloudFormation, preventing deployment race conditions.

**To deploy the fix:**
```bash
cd infrastructure && npm run build && npx cdk deploy SpotterSpace-dev-Stack --require-approval never
```

---

## What's Working

- ECS tasks (`spotterspace-dev-web`, `spotterspace-dev-api`) start successfully and containers are **healthy** (`✓ Ready in ~150ms`)
- ECS → Secrets Manager, S3, and RDS all work (tasks start with correct IAM roles and secrets)
- ALB responds to HTTPS requests from the internet (TLS handshake succeeds)
- Route53 CNAMEs (`www.spotterspace.com`, `api.spotterspace.com`) correctly resolve to ALB
- HTTPS listener (443) with ACM certificate (`*.spotterspace.com`) is active on ALB
- HTTP listener (80) and HTTPS listener both have host-based rules routing `api.*` to `apiTG` and everything else to `webTG`

---

## What's Broken

**ALB health checks timeout when reaching ECS task IPs.**

- `GET /api/health` → ALB returns 504 (gateway timeout)
- `GET /health` → ALB returns 504 (gateway timeout)
- Both ECS target groups show targets as `unhealthy` with reason `Target.Timeout`

The ALB cannot reach the ECS task IPs (e.g. `10.0.1.7`, `10.0.2.118`) even though:
- Tasks are running in private subnets (`subnet-082c94f*`, `subnet-096b774d*`)
- ALB is in public subnets + private subnet `subnet-096b774d*`
- Same VPC (`vpc-09a6870488b73260e`)
- Same security group (`sg-08e5864c53710a095`) with self-referencing rule
- VPC route table has `0.0.0.0/0` → NAT Gateway → Internet for private subnets
- S3 Gateway endpoint (`vpce-0949a6870cff22264`) and Secrets Manager interface endpoint (`vpce-05caf013ed865f8de`) exist

---

## Previous Successful State

Before the CDK redeploy (around 2026-04-14 evening), both endpoints returned HTTP 200:
```
curl http://spotterspace-alb-1192051505.us-east-1.elb.amazonaws.com/api/health  →  {"status":"ok"}
curl http://spotterspace-alb-1192051505.us-east-1.elb.amazonaws.com/            →  200
```

At that time, targets were manually registered with the correct IP-to-task mapping.

---

## Root Cause Hypothesis

Something changed in the VPC/networking configuration after the CDK redeploy caused tasks to restart in a state where ALB cannot reach them. Possible causes:

1. **Target registration race condition** — ECS service started tasks, ALB health checks fired before targets were properly registered
2. **Security group edge case** — the CDK-added self-referencing rule (`ecsSg.addIngressRule(ecsSg, ...)`) may have disrupted existing ALB→ECS traffic flow
3. **Route table or VPC endpoint issue** — the NAT Gateway or interface endpoints may have changed state
4. **ALB cross-zone load balancing** — ALB may be attempting to reach targets in AZs where the ENI is not reachable

---

## Investigation Steps

### 1. Verify ECS task networking

```bash
# List running tasks
aws ecs list-tasks --cluster spotterspace-cluster --region us-east-1 --desired-status RUNNING

# Get task ENI details
aws ecs describe-tasks \
  --cluster spotterspace-cluster \
  --tasks <task_arn> \
  --region us-east-1 \
  --query 'tasks[0].attachments[0].details'
```

Verify each task has:
- `subnetId` in private subnet range
- `networkInterfaceId` with security group `sg-08e5864c53710a095`
- Container is `HEALTHY`

### 2. Check current target health

```bash
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-web-tg/53bffb7b973906cb \
  --region us-east-1

aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-api-tg/105538bfd82988b2 \
  --region us-east-1
```

Look for: target IP matches current ECS task ENI IP, state is `healthy`

### 3. Verify security group has not changed

```bash
aws ec2 describe-security-groups --group-ids sg-08e5864c53710a095 --region us-east-1
```

Required inbound rules:
- `0.0.0.0/0` TCP 80 (HTTP)
- `0.0.0.0/0` TCP 443 (HTTPS)
- Self-reference (`sg-08e5864c53710a095`) all traffic — **for ALB → ECS traffic**

Required outbound rules:
- `0.0.0.0/0` all traffic

### 4. Check ALB ENIs and cross-zone config

```bash
# ALB AZs and ENIs
aws elbv2 describe-load-balancers --names spotterspace-alb --region us-east-1

# Cross-zone balancing — ALB should route to any AZ
# ALB ENIs:
# - us-east-1a: subnet-022c0065 (public)
# - us-east-1b: subnet-096b774e (private, where ECS tasks also run)
```

### 5. Test from within VPC

From an EC2 instance in the same VPC or same subnet:

```bash
curl -v --max-time 5 http://<task_ip>:3000/api/health
curl -v --max-time 5 http://<task_ip>:4000/health
```

If this times out, the issue is definitely the security group or network path.

### 6. Check container logs

```bash
# Find log stream for current task
aws logs describe-log-streams --log-group-name "/ecs/spotterspace-dev/web" --region us-east-1

# Read recent logs — look for "Ready" message confirming server started
aws logs get-log-events \
  --log-group-name "/ecs/spotterspace-dev/web" \
  --log-stream-name "web/web/<task_id>" \
  --limit 10 --region us-east-1
```

### 7. Force new deployment to get fresh ENIs

```bash
# Deregister ALL existing targets first
aws elbv2 deregister-targets \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-web-tg/53bffb7b973906cb \
  --targets Id=<ip1>,Port=3000 Id=<ip2>,Port=3000 \
  --region us-east-1

aws elbv2 deregister-targets \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-api-tg/105538bfd82988b2 \
  --targets Id=<ip1>,Port=4000 Id=<ip2>,Port=4000 \
  --region us-east-1

# Force new deployment
aws ecs update-service \
  --cluster spotterspace-cluster \
  --service spotterspace-dev-web \
  --force-new-deployment \
  --region us-east-1

aws ecs update-service \
  --cluster spotterspace-cluster \
  --service spotterspace-dev-api \
  --force-new-deployment \
  --region us-east-1

# Wait ~30s for tasks to start, then get new IPs
aws ecs list-tasks --cluster spotterspace-cluster --service-name spotterspace-dev-web --desired-status RUNNING --region us-east-1

# Re-register new targets immediately
aws elbv2 register-targets \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:654654553862:targetgroup/spotterspace-dev-web-tg/53bffb7b973906cb \
  --targets Id=<new_ip>,Port=3000 \
  --region us-east-1
```

---

## Suspect: CDK SG Rule Ordering

The CDK stack adds a self-referencing rule to `sg-08e5864c53710a095`:

```typescript
// In SpotterSpaceStack (spotterspace-stack.ts):
ecsSg.addIngressRule(ecsSg, ec2.Port.allTraffic(), 'Allow ALB to ECS traffic');
```

This creates a rule allowing traffic FROM `sg-08e5864c53710a095` TO `sg-08e5864c53710a095`. However, the **ALB** itself also uses this security group. The rule allows the ALB to send traffic to ECS targets, but the directionality may be incorrect or conflicting with the implicit "last rule wins" behavior of SG ingress rules.

**Test**: Remove the self-referencing rule manually and see if health checks recover:

```bash
# Find the self-referencing rule ID
aws ec2 describe-security-groups --group-ids sg-08e5864c53710a095 --region us-east-1 \
  --query 'SecurityGroups[0].IpPermissions'

# Revoke self-referencing rule
aws ec2 revoke-security-group-ingress \
  --group-id sg-08e5864c53710a095 \
  --ip-permissions '[{"IpProtocol": "-1", "UserIdGroupPairs": [{"GroupId": "sg-08e5864c53710a095"}]}]' \
  --region us-east-1

# Then force new ECS deployment to get fresh ENIs
```

---

## Suspect: NAT Gateway Issue

The private subnets route `0.0.0.0/0` through the NAT Gateway (`nat-02f376c5d696b61ff`) in the public subnet. This means:

- Outbound: ECS → NAT → Internet (works, tasks can reach AWS APIs)
- Inbound: ALB → ECS should NOT go through NAT (same VPC, same AZ)

But if the routing table has a default route that forces all traffic through NAT even for VPC-internal communication, that would break ALB → ECS.

**Check route tables**:
```bash
aws ec2 describe-route-tables --route-table-ids rtb-0989410e3b8f596fc --region us-east-1
```

Expected for private subnets:
- `10.0.0.0/20` → `local` (local VPC routing)
- `0.0.0.0/0` → `nat-02f376c5d696b61ff` (for outbound only)
- Interface VPC endpoints → specific VPce routes

---

## Quick Wins to Try

1. **Use the public subnet for ECS tasks** — change `ecsSubnetIds` in `bin/spotterhub.ts` to use `subnet-022c0065046782a64` (the public NAT subnet) temporarily
2. **Enable `assignPublicIp: true`** on ECS services (not ideal for production, but confirms if it's a routing issue)
3. **Check VPC endpoints** — the Secrets Manager endpoint SG may be blocking ALB traffic if rules changed
4. **Try TCP health check instead of HTTP** — not supported by ALB for HTTP targets, but would confirm connectivity

---

## Key Files

- `infrastructure/lib/spotterspace-stack.ts` — CDK stack (security groups, HTTPS listener, ECS services, Route53)
- `infrastructure/bin/spotterspace.ts` — CDK entry point (reads `DOMAIN_NAME`, `HOSTED_ZONE_ID`, `VPC_ID` from env)
- `infrastructure/cdk.out/` — synthesized CloudFormation output

## Key AWS Resources

| Resource | ID/Name |
|----------|----------|
| VPC | `vpc-09a6870488b73260e` |
| ECS Cluster | `spotterspace-cluster` |
| ALB | `spotterspace-alb` (dns: `spotterspace-alb-1192051505.us-east-1.elb.amazonaws.com`) |
| ALB Security Group | `sg-08e5864c53710a095` |
| Web Target Group | `spotterspace-dev-web-tg` (port 3000, `/api/health`) |
| API Target Group | `spotterspace-dev-api-tg` (port 4000, `/health`) |
| Web ECS Service | `spotterspace-dev-web` |
| API ECS Service | `spotterspace-dev-api` |
| Private Subnets | `subnet-082c94f0897298f6e`, `subnet-096b774ed307c85ed` |
| Public Subnet (NAT) | `subnet-022c0065046782a64` |
| Secrets Manager Endpoint SG | `sg-0ddf2cd67fa1b09f0` |
| RDS SG | `sg-0925439b428efdf13` |
