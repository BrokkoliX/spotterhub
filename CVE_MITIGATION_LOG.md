# CVE Mitigation Log

This file tracks security advisories that have been addressed in the SpotterHub codebase. Each entry records the advisory, the affected dependency, the fix applied, and the date the fix landed on `main`.

The convention is to append new entries at the top, keeping the most recent mitigations visible first. Each entry should contain enough detail that a future auditor can reproduce the upgrade decision without re-reading the original advisory.

## 2026-05-22 — Sprint 1 dependency hardening

`npm audit` reported 17 findings (1 high, 16 moderate) across the root workspace. `npm audit fix` was run and resolved 8 advisories without any breaking changes; the package-lock.json delta was committed to `main` after a full CI pass. The remaining 9 moderate-severity advisories require breaking-change upgrades and are tracked below for the Sprint 1 follow-up branch.

### Resolved without breaking changes

The eight advisories closed by `npm audit fix` covered transitive dependencies whose patched versions satisfied the existing semver ranges. The auditor should re-run `npm audit` against the post-fix `package-lock.json` to confirm the count drop from 17 to 9.

### Pending breaking-change upgrades

The following advisories remain open and require coordinated upgrades on a feature branch with a full E2E pass before landing.

The Apollo Server XS-Search CSRF bypass (GHSA-9q82-xgwf-vj6h) requires `@apollo/server@5.5.1`, a major-version bump from the current 4.x line. The application-layer `csrfGuard` middleware in `apps/api/src/index.ts` provides defence-in-depth, so the timeline is not emergency. Plan: branch `chore/apollo-5.5`, run `npm i @apollo/server@5.5.1`, fix any breaking-change call sites flagged by `tsc`, run the full vitest + E2E suite, ship.

The Next.js high-severity advisory requires accepting the breaking `next` upgrade flagged by `npm audit fix --force`. The Next.js App Router migration plan in Sprint 3 (`docs/CODE_REVIEW_ACTION_PLAN_2026_05_22.md` S3.2) intersects with this upgrade; coordinate the two so the layout refactor and the framework bump ship together.

The PostCSS XSS advisory (GHSA-qx2v-qp2m-jg93) is transitive via Next.js and will be resolved by the Next.js upgrade above.

The remaining `uuid <11.1.1`, `vitest`, `vite`, `vite-node`, `@vitest/mocker`, `esbuild`, and `turbo` findings are dev-only or test-time and can be batched into a single tooling-upgrade PR after the Apollo and Next.js upgrades land.

### Verification commands

The current state can be reproduced with:

```bash
npm audit
```

The expected output is `9 moderate severity vulnerabilities` until the breaking-change upgrades above are applied.

## AWS Lifecycle

This section tracks AWS-managed component end-of-life events that require migration. Entries are created when AWS sends a notification email and closed when the migration ships to production.

The first row is reserved for the AWS notification flagged on 2026-05-22 (component to be confirmed once the email is captured in `docs/CODE_REVIEW_ACTION_PLAN_2026_05_22.md` Sprint 0 EOL details).
