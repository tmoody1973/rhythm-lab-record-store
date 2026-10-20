// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { resetSupportProbe } from '../../src/shop/support.ts';
import type { Catalog } from '../../src/catalog/schema.ts';

vi.mock('../../src/shop/ShopScene.tsx', () => ({ default: () => <div data-testid="shop" /> }));
const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetSupportProbe();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as unknown as RenderingContext);
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

test('with 3D available, the front door is the shop', async () => {
  vi.stubGlobal('WebGLRenderingContext', class {});
  render(<App />);
  expect(await screen.findByTestId('shop')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: /records/i })).toBeNull();
  expect(screen.getByRole('heading', { level: 1, name: /record shop/i })).toBeInTheDocument(); // the front page has a heading
});

test('searching from the shop takes you to the grid', async () => {
  vi.stubGlobal('WebGLRenderingContext', class {});
  const user = userEvent.setup();
  render(<App />);
  await screen.findByTestId('shop');
  await user.type(screen.getByPlaceholderText(/search records/i), 'universal');
  expect(await screen.findByRole('list', { name: /records/i })).toBeInTheDocument();
  expect(window.location.search).toContain('view=grid');
});

test('without 3D, the front door is the grid and Store explains why it is off', async () => {
  render(<App />);
  expect(await screen.findByRole('list', { name: /records/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Store' })).toHaveAttribute('title', "This browser can't show the 3D shop");
});

test('if 3D gave up earlier this session, the grid stays', async () => {
  vi.stubGlobal('WebGLRenderingContext', class {});
  window.sessionStorage.setItem('rl-no-3d', '1');
  render(<App />);
  expect(await screen.findByRole('list', { name: /records/i })).toBeInTheDocument();
});
