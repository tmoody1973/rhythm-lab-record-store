import { defineConfig } from 'vitest/config';

// The Subsonic probe keeps its own node:test suite (npm run test:probe).
export default defineConfig({ test: { include: ['tests/**/*.test.ts'] } });
