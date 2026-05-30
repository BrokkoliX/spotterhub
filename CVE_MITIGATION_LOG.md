# CVE Mitigation Log

This file tracks security advisories that have been addressed in the SpotterHub codebase. Each entry records the advisory, the affected dependency, the fix applied, and the date the fix landed on `main`.

The convention is to append new entries at the top, keeping the most recent mitigations visible first. Each entry should contain enough detail that a future auditor can reproduce the upgrade decision without re-reading the original advisory.

## 2026-05-30 — Build-environment hygiene and Resend key rotation flag

Two related items were discovered during a `next build` failure investigation. They are recorded together because they were found in the same file (the gitignored project root `.env`) and both relate to environment hygiene rather than a published CVE.

### NODE_ENV=development polluting production builds

The project root `.env` file (and the tracked `.env.example` template) contained a hard-coded `NODE_ENV=development` line. When `next build` runs, it expects to set its own `NODE_ENV=production`; the root-level export pre-empted that and put the build into a hybrid state where the production prerender pipeline ran against the development React build. The user-visible symptom was a misleading `TypeError: Cannot read properties of null (reading 'useContext')` crash on the synthesized `/_global-error` route, with stack frames hidden behind Next.js's "ignore-listed frames" filter. Next.js did print a `⚠ You are using a non-standard "NODE_ENV" value in your environment` warning on every build, but the connection between the warning and the downstream crash was not obvious.

The line was removed from both `.env` (gitignored, edited locally) and `.env.example` (tracked, committed):

```
- # ─── Environment ────────────────────────────────────────────────────────
- NODE_ENV=development
```

Each tool now selects its own NODE_ENV based on the command being run: `next dev` → `development`, `next build` → `production`, `vitest` → `test`, plain `node dist/index.js` → defaults to `production`. Verification: `cd apps/web && rm -rf .next && npx next build` now passes cleanly with no warnings, generating all 47 routes in roughly 66 ms of static-generation work.

The investigation also surfaced two real production bugs that the misleading `_global-error` symptom had been masking. Two client-side pages (`apps/web/src/app/contact/page.tsx` and `apps/web/src/app/communities/new/page.tsx`) called `router.push()` or `router.replace()` synchronously during render as part of an unauthenticated-user redirect guard. That pattern crashes any production prerender pass with `ReferenceError: location is not defined` because `router.push` ultimately reads `window.location`. Both pages were refactored to perform the redirect inside `useEffect`, matching the pattern already established in `following/page.tsx`, `discover/page.tsx`, `verify-email/page.tsx`, `settings/site/page.tsx`, and `settings/profile/page.tsx`. The diagnostic technique that surfaced these errors was the Next.js 16 `--debug-prerender` flag, which disables the `prerenderEarlyExit` experiment and the source-frame ignore list, exposing the real source locations behind the prerender failures.

### Resend API key flagged for rotation

A live `RESEND_API_KEY` value was observed in the gitignored project root `.env` file during the same investigation. The file is not committed (`.env` is in `.gitignore`), so the key is not in the repository history. However, the value did appear in tool-call output during the agent session that produced this entry, which crosses the security boundary of "secrets must not appear in logs". The recommendation is to rotate the key in the Resend dashboard, update the local `.env`, and update the production secret store (whichever ECS task definition or AWS Secrets Manager entry holds the live value). Until the rotation lands, the existing key remains operationally valid; this is a precautionary rotation, not a confirmed compromise.

## 2026-05-22 — Apollo Server 4 → 5 upgrade (GHSA-9q82-xgwf-vj6h)

Bumped `@apollo/server` from `4.13.0` to `5.5.1` to close **GHSA-9q82-xgwf-vj6h** (Apollo Server XS-Search read-only CSRF bypass). This was the only advisory in the previous post-`audit-fix` set rated as a real production-traffic risk; everything else was dev/test-time.

The Apollo Server 5 upgrade is a major version bump that removes the bundled `@apollo/server/express4` middleware. The migration replaces that import with `@as-integrations/express4@^1.1.2`, a thin adapter package maintained by the Apollo team. The adapter is API-compatible with the previous middleware and supports both Apollo Server 4 and 5 as peer dependencies, which let us split the upgrade into two reversible steps (first swap the import, verify, then bump the major version).

Single import change in `apps/api/src/index.ts`:

```ts
// Before
import { expressMiddleware } from '@apollo/server/express4';
// After
import { expressMiddleware } from '@as-integrations/express4';
```

A follow-up `npm audit fix` (non-breaking) was run after the Apollo bump, which closed three further transitive advisories surfaced by Apollo Server 5's updated dependency tree (notably `qs` was bumped from `6.14.2` to `6.15.2`, closing **GHSA-q8mj-m7cp-5q26**).

Verification: full API test suite passes 334/334 against Apollo Server 5.5.1. `npm audit` post-upgrade reports `7 moderate` (down from the previous `9 moderate`). The remaining 7 advisories all require breaking-change upgrades to Next.js or to the Vite/Vitest tooling chain and are tracked under "Remaining open advisories" below.

A pre-existing flaky test (`apps/api/src/__tests__/photo.test.ts` "applies approximate privacy jitter to coordinates") was uncovered during the Apollo verification re-runs and fixed in the same commit. The test had asserted `not.toBeCloseTo(raw, 3)` against jitter drawn from the range `[-0.005, +0.005]`, which produced a ~10 % failure rate by construction. The fix asserts that jitter was applied (delta non-zero) and stayed within the documented bound (≤ 0.005), removing the flake without weakening coverage.

## 2026-05-22 — Sprint 1 dependency hardening

`npm audit` reported 17 findings (1 high, 16 moderate) across the root workspace. `npm audit fix` was run and reduced the count to 9 moderate without any breaking changes; the resulting `package-lock.json` delta was committed to `main` after a full CI pass. The 9 remaining advisories all require `--force`-level breaking-change upgrades and are tracked individually below.

### Resolved without breaking changes

The eight advisories closed by `npm audit fix` were transitive dependencies whose patched versions satisfied the existing semver ranges in the workspace. Reproduction step: check out the commit immediately before the lockfile bump (`git log -- package-lock.json | head`) and compare `npm audit --json` output before and after. The expected delta is:

- One `next` advisory (the only `high`-severity finding in the original report) downgraded out of the audit by the patch-level bump that `npm audit fix` selected.
- Seven moderate transitive advisories closed by patch-level bumps in dependencies pulled by `next`, `vite`, `@vitest/mocker`, and ESLint plugins.

### Remaining open advisories (require breaking-change upgrades)

The current `npm audit` output (verified 2026-05-22) reports exactly **9 moderate** advisories. Each is listed below with the source dependency, the advisory link, and the upgrade plan.

The Apollo Server XS-Search CSRF bypass affects `@apollo/server <5.5.0` and is published as **GHSA-9q82-xgwf-vj6h**. The application-layer `csrfGuard` middleware in `apps/api/src/index.ts` provides defence-in-depth, so the timeline is not emergency. Plan: branch `chore/apollo-5.5`, run `npm i @apollo/server@5.5.1`, fix any breaking-change call sites flagged by `tsc`, run the full vitest + Playwright E2E suite, ship.

The PostCSS unescaped-`</style>` XSS affects `postcss <8.5.10` and is published as **GHSA-qx2v-qp2m-jg93**. The advisory reaches us transitively via `next`. Resolution path: take the next major Next.js upgrade (see below); the postcss bump is bundled into that upgrade.

The Next.js advisory chain (the original `high`-severity finding, plus the postcss transitive) requires accepting the breaking `next` upgrade flagged by `npm audit fix --force`. The Next.js App Router migration plan in Sprint 3 (`docs/CODE_REVIEW_ACTION_PLAN_2026_05_22.md` S3.2) intersects with this upgrade; coordinate the two so the layout refactor and the framework bump ship together.

The esbuild dev-server SSRF affects `esbuild <=0.24.2` and is published as **GHSA-67mh-4wv8-2f99** (CVSS 5.3). The exposure is dev-only — the bundler does not run in production containers. Resolution path: take the next major `vite` upgrade; the bundled esbuild ships as part of that.

The Vite path-traversal in optimised-deps `.map` handling affects `vite <=6.4.1` and is published as **GHSA-4w7w-66w2-5vf9**. Dev-only exposure. Resolution path: bump `vite` to the latest 7.x line on a tooling branch alongside the vitest upgrade below.

The `@vitest/mocker`, `vitest`, and `vite-node` advisories all chain off the same `vite` finding above. Resolution path: same tooling branch.

The `uuid <11.1.1` missing-bounds-check on `v3/v5/v6` when a `buf` is provided is published as **GHSA-w5hq-g745-h8pq** (CVSS 7.5 by metric, but the SpotterHub codebase only uses `v4` `uuid` which is unaffected). Resolution path: bump `uuid` to `^11.1.1` on the tooling branch as a defence-in-depth measure.

The Apollo Server browser-bug XS-Search row above is the only finding currently rated as a real production-traffic risk. The remaining eight are dev/test-time only and can be batched into a single tooling-upgrade PR after the Apollo and Next.js upgrades land.

### Verification commands

The current state can be reproduced with:

```bash
npm audit
```

The expected output is `9 moderate severity vulnerabilities` until the breaking-change upgrades above are applied. For machine-readable output:

```bash
npm audit --json | jq '.metadata.vulnerabilities'
```

This will print the `info / low / moderate / high / critical / total` histogram and should currently show `{"info":0,"low":0,"moderate":9,"high":0,"critical":0,"total":9}`.

## AWS Lifecycle

This section tracks AWS-managed component end-of-life events that require migration. Entries are created when AWS sends a notification email and closed when the migration ships to production.

### 2026-05-22 — Lambda Node.js 20.x runtime end-of-life (Sprint 0)

**Component:** AWS Lambda Node.js 20.x runtime in account `654654553862`. Notification originated from `us-east-1`; affected functions must be enumerated across every region we use (`us-east-1` and `eu-west-1`).

**AWS-stated dates:**

| Date               | Effect                                            |
| ------------------ | ------------------------------------------------- |
| April 30, 2026     | End of security-patch support (passed)            |
| August 31, 2026    | Cannot **create** new Node.js 20.x functions      |
| September 30, 2026 | Cannot **update** existing Node.js 20.x functions |

**Planned remediation:** Bump every affected function to `nodejs22.x` (the current Lambda LTS, supported through April 2027) before **August 31, 2026**. The September date is the hard deadline because it removes our ability to deploy patches; the August date is the practical deadline because it prevents any clean replacement.

**Runbook:** `scripts/aws-runbook-2026-05-22.sh` enumerates affected functions read-only and prints the exact `update-function-configuration` commands. The runbook also flags the `spotterhub-keep-warm` Lambda as outside-IaC; codifying it in CDK is a follow-up task tracked under Sprint 0 in the action plan.

**Status:** Open. Code change required: none in the application monorepo (Lambda runtime is set per-function in AWS, not in source). Code change required outside the monorepo: optional CDK additions to bring `spotterhub-keep-warm` under IaC.

### 2026-05-22 — Fargate standalone-task retirement (reviewed, not applicable)

A separate AWS Health notification was received on 2026-05-22 covering routine retirement of standalone Fargate tasks ahead of platform-revision rotation (deadline: 2026-05-21 01:00 GMT). SpotterHub runs all production tasks under ECS Services (`api` and `web`) which are automatically replaced by the service controller during platform rotations. No standalone tasks are part of the production estate; the two historical `RunTask` invocations from the 2026-05-02 and 2026-05-22 incidents were both deregistered after use.

**Status:** Closed without action.
