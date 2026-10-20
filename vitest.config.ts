import { defineConfig } from 'vitest/config';

// The Subsonic probe keeps its own node:test suite (npm run test:probe). Web tests opt into
// jsdom per file with `// @vitest-environment jsdom`.
export default defineConfig({
  test: { include: ['tests/**/*.test.{ts,tsx}'], setupFiles: ['tests/web/setup.ts'] },
});
