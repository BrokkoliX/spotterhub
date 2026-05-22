- [Command allowance preferences](feedback_command_allowances.md) — npm install approved without prompting

## Infrastructure State (as of 2026-05-22)

Both ECS services are healthy: `spotterspace-dev-api` (task def :234, desired=1, running=1) and `spotterspace-dev-web` (task def :181, desired=1, running=1). CloudFormation stack `SpotterSpace-dev-Stack` is UPDATE_COMPLETE. `api.spotterspace.com` and `www.spotterspace.com` both return HTTP 200.

The failed migration row for `20260406123505_init` has been permanently resolved via `prisma migrate resolve --rolled-back`. The api entrypoint (`docker-entrypoint.sh`) simply runs `prisma migrate deploy` on startup — no recovery logic.

Dev Fargate task sizing: api 512 CPU / 1024 MB, web 256 CPU / 512 MB. Estimated Fargate cost: ~$50/month (down from ~$202/month).

## CDK Deploy Command

```bash
cd infrastructure
DOMAIN_NAME=spotterspace.com HOSTED_ZONE_ID=Z00113712EMKXVCPQFWZW STAGE=dev
  API_IMAGE_TAG=<git-sha> WEB_IMAGE_TAG=<git-sha>
  npx cdk deploy --require-approval never
```

Always pass explicit git SHAs. The CDK reads `API_IMAGE_TAG` / `WEB_IMAGE_TAG` env vars, defaulting to `latest`.

## Known Pending Issues

- ECS circuit breaker disabled on both services (add `circuitBreaker: { enable: true, rollback: true }` to CDK).
- Duplicate Secrets Manager VPC endpoints (`vpce-05caf...` and `vpce-00a5...`) — ~$7/month waste.
- Orphaned `t3.small` EC2 instance not in CDK — ~$10/month.
- AppRunner legacy CloudWatch log groups still present.
- `keep-warm` Lambda — verify still needed.
- `express-rate-limit` IPv6 keyGenerator warning in api logs (non-fatal, pre-existing).
- S3 CORS configuration warning on api startup (non-fatal, pre-existing).

## Key Corrections Made 2026-05-22

- S3 bucket name: `spotterhub-photos` (CDK was pointing to non-existent `spotterspace-photos`).
- Env var: `S3_BUCKET` (CDK was passing unused `PHOTOS_BUCKET_NAME`).
- CDK now also passes `WEB_BASE_URL` and `FROM_EMAIL` to both task definitions.
- Healthcheck intervals: 30s (was 10s) on both services.
