// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import type { Catalog } from '../../src/catalog/schema.ts';
import { encodeShare } from '../../src/crates/share.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
const universal = fixture.albums.find((a) => a.title === 'Universal Beings')!;
const days = fixture.albums.find((a) => a.title === 'Days As Echoes')!;
const saved = () => JSON.parse(window.localStorage.getItem('rl-record-store:visitor') ?? 'null');

beforeEach(() => {
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

async function openUniversal() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  return { user, dialog: screen.getByRole('dialog', { name: 'Universal Beings' }) };
}

test('the heart saves a favorite in this browser', async () => {
  const { user, dialog } = await openUniversal();
  const heart = within(dialog).getByRole('button', { name: 'Save to favorites' });
  expect(heart).toHaveAttribute('aria-pressed', 'false');
  await user.click(heart);
  expect(heart).toHaveAttribute('aria-pressed', 'true');
  expect(saved().favorites).toEqual([universal.id]);
});

test('add to a new crate from the pop-up, then find it under My crates', async () => {
  const { user, dialog } = await openUniversal();
  await user.click(within(dialog).getByRole('button', { name: 'Add to crate' }));
  await user.type(within(dialog).getByRole('textbox', { name: 'New crate name' }), 'Late Night');
  await user.click(within(dialog).getByRole('button', { name: 'Create crate' }));
  expect(within(dialog).getByRole('checkbox', { name: 'Late Night' })).toBeChecked();
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));
  await user.click(screen.getByRole('button', { name: /my crates/i }));
  const panel = screen.getByRole('dialog', { name: 'My crates' });
  expect(within(panel).getByText('Late Night')).toBeInTheDocument();
  expect(within(panel).getByText('Universal Beings')).toBeInTheDocument();
  expect(saved().crates[0]).toMatchObject({ name: 'Late Night', records: [universal.id] });
});

test('a shared crate shows its name as plain text and can be saved', async () => {
  const name = '<script>alert(1)</script>';
  window.history.replaceState(null, '', `/?shared=${encodeShare({ name, records: [universal.id, days.id] })}`);
  const user = userEvent.setup();
  render(<App />);
  const banner = await screen.findByRole('region', { name: 'Shared crate' });
  expect(within(banner).getByText(name, { exact: false })).toBeInTheDocument();
  expect(document.querySelector('script')).toBeNull();
  expect(banner).toHaveTextContent('2 records');
  await user.click(within(banner).getByRole('button', { name: 'Save to my crates' }));
  expect(screen.queryByRole('region', { name: 'Shared crate' })).toBeNull();
  expect(saved().crates[0]).toMatchObject({ name, records: [universal.id, days.id] });
  expect(window.location.search).toBe('');
});

test('a broken share link says so and the collection still loads', async () => {
  window.history.replaceState(null, '', '/?shared=!!!notbase64');
  render(<App />);
  expect(await screen.findByText(/that share link is broken/i)).toBeInTheDocument();
  expect(screen.getByRole('list', { name: /records/i })).toBeInTheDocument();
});

test('when the browser blocks storage, the site works and says saving is off', async () => {
  vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('SecurityError'); });
  render(<App />);
  expect(await screen.findByText(/saving is off in this browser/i)).toBeInTheDocument();
  expect(screen.getByRole('list', { name: /records/i })).toBeInTheDocument();
  vi.restoreAllMocks();
});
