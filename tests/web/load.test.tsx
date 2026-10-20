// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { App } from '../../src/App.tsx';

afterEach(() => vi.unstubAllGlobals());

test('a missing catalog shows a helpful error, not a blank page', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
  render(<App />);
  const alert = await screen.findByRole('alert');
  expect(alert).toHaveTextContent("Couldn't load the record collection");
  expect(alert).toHaveTextContent('npm run catalog');
});
