# CVE Mitigation Log

This file tracks security advisories that have been addressed in the SpotterHub codebase. Each entry records the advisory, the affected dependency, the fix applied, and the date the fix landed on `main`.

The convention is to append new entries at the top, keeping the most recent mitigations visible first. Each entry should contain enough detail that a future auditor can reproduce the upgrade decision without re-reading the original advisory.

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

The first row is reserved for the AWS notification flagged on 2026-05-22 (component to be confirmed once the email is captured in `docs/CODE_REVIEW_ACTION_PLAN_2026_05_22.md` Sprint 0 EOL details).
