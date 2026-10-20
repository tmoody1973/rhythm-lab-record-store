// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import type { Catalog, PublicAlbum } from '../../src/catalog/schema.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));

function serve(catalog: Catalog) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(catalog), { status: 200 })));
}
const cards = () => within(screen.getByRole('list', { name: /records/i })).getAllByRole('button');
const cardTitles = () => cards().map((c) => c.querySelector('[data-title]')?.textContent);

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => vi.unstubAllGlobals());

test('shows the headline, count and every record card', async () => {
  serve(fixture);
  render(<App />);
  expect(await screen.findByRole('heading', { name: 'Pull up a crate.' })).toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Showing 1–20 of 20 records');
  expect(cards()).toHaveLength(20);
});

test('genre chips filter (via More), update the count and the URL', async () => {
  serve(fixture);
  render(<App />);
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  await user.click(screen.getByText('More'));
  await user.click(screen.getByRole('button', { name: /^Jazz/ }));
  expect(cards()).toHaveLength(3);
  expect(screen.getByRole('status')).toHaveTextContent('of 3 records');
  expect(window.location.search).toBe('?genre=jazz');
});

test('a record with no genre is under More → Unclassified', async () => {
  serve(fixture);
  render(<App />);
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  await user.click(screen.getByText('More'));
  await user.click(screen.getByRole('button', { name: /^Unclassified/ }));
  expect(cardTitles()).toEqual(["Don't Wanna Be Normal (Sunship Remix)"]);
});

test('Artist Z–A reverses the order', async () => {
  serve(fixture);
  render(<App />);
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  const az = cardTitles();
  await user.selectOptions(screen.getByLabelText('Sort by'), 'artist-desc');
  expect(cardTitles()).toEqual([...az].reverse());
});

test('a record without a cover gets a typographic sleeve, not a broken image', async () => {
  serve(fixture);
  render(<App />);
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  const card = cards()[0]!;
  expect(card.querySelector('img')).toBeNull();
  expect(card).toHaveTextContent(card.querySelector('[data-title]')!.textContent!);
});

test('a record with a cover shows the self-hosted image', async () => {
  const withCover: Catalog = { ...fixture, albums: fixture.albums.map((a, i) => (i === 0 ? { ...a, cover: { grid: '/covers/x-300.webp', large: '/covers/x-1000.webp', dominant: '#123456', accent: '#abcdef', text: '#ffffff' } } : a)) };
  serve(withCover);
  render(<App />);
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  expect(screen.getByRole('button', { name: /oneiric/ }).querySelector('img')).toHaveAttribute('src', '/covers/x-300.webp');
});

test('letter jump reaches later pages, focuses the first match, and disables empty letters', async () => {
  const albums: PublicAlbum[] = [
    ...Array.from({ length: 100 }, (_, i) => ({ ...fixture.albums[0]!, id: `bandcamp:album:${i + 1}`, bandcampId: i + 1, artist: `A Artist ${String(i).padStart(3, '0')}` })),
    ...Array.from({ length: 20 }, (_, i) => ({ ...fixture.albums[0]!, id: `bandcamp:album:${i + 201}`, bandcampId: i + 201, artist: `M Artist ${i}` })),
  ];
  serve({ ...fixture, count: albums.length, albums });
  render(<App />);
  const user = userEvent.setup();
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  expect(screen.getByRole('button', { name: 'Jump to Q' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Jump to M' }));
  expect(screen.getByRole('status')).toHaveTextContent('Showing 97–120 of 120 records');
  expect(document.activeElement).toHaveTextContent('M Artist 0');
  expect(window.location.search).toBe('?page=3');
});

test('an empty result offers Clear filters, which resets', async () => {
  serve(fixture);
  window.history.replaceState(null, '', '/?q=zzzznothing');
  render(<App />);
  const user = userEvent.setup();
  expect(await screen.findByText('No records match.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Clear filters' }));
  expect(cards()).toHaveLength(20);
  expect(window.location.search).toBe('');
});
