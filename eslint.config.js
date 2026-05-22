// Root ESLint flat config for lint-staged pre-commit hook.
// Each workspace app (apps/web, apps/api, packages/*) manages its own ESLint
// config. This root config exists solely to satisfy ESLint v9's requirement for
// a flat config file at the project root when lint-staged invokes `eslint` from
// the monorepo root. All files are ignored here; linting is enforced per-app
// via `turbo run lint` in CI and each workspace's own config during development.
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
  globalIgnores(['**/*']),
]);
