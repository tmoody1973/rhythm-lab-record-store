import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest runs without globals, so Testing Library can't register its own cleanup. Also let any
// history.back() from a closed pop-up finish, so it can't land in the next test.
afterEach(async () => {
  cleanup();
  await new Promise((r) => setTimeout(r, 20));
});
