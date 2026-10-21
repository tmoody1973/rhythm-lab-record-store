// @vitest-environment jsdom
// Custom events (docs/decisions/009-analytics-events.md): each fires once per action, carries at most two
// properties (the Pro plan's limit), and never carries anything a visitor typed.
import { readFileSync } from 'node:fs';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { track } from '@vercel/analytics';
import { App } from '../../src/App.tsx';
import { scrubUrl } from '../../src/analytics.ts';
import type { Enriched } from '../../src/catalog/enrichment.ts';
import { embedUrl, toCompact } from '../../src/catalog/ids.ts';
import type { Catalog } from '../../src/catalog/schema.ts';
import { encodeShare } from '../../src/crates/share.ts';
import { AlbumAbout } from '../../src/ui/AlbumAbout.tsx';
import { AlbumDialog } from '../../src/ui/AlbumDialog.tsx';

vi.mock('@vercel/analytics', () => ({ track: vi.fn() }));

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
const universal = fixture.albums.find((a) => a.title === 'Universal Beings')!;
const days = fixture.albums.find((a) => a.title === 'Days As Echoes')!;
const label = (r: { artist: string; title: string }) => `${r.artist} — ${r.title}`;
const calls = (name: string) => vi.mocked(track).mock.calls.filter(([n]) => n === name).map(([, p]) => p);

beforeEach(() => {
  vi.mocked(track).mockClear();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

test('page views send the path only: no search text, no shared-crate link', () => {
  expect(scrubUrl('https://records.rhythmlabradio.com/?q=late%20night&shared=abc#x')).toBe('https://records.rhythmlabradio.com/');
  expect(scrubUrl('https://records.rhythmlabradio.com/about.html?ref=1')).toBe('https://records.rhythmlabradio.com/about.html');
});

test('opening a record from the grid says which record and where from', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  expect(calls('Record Opened')).toEqual([{ record: label(universal), from: 'grid' }]);
});

test('a record link opened from outside counts once, as a link', async () => {
  window.history.replaceState(null, '', `/?record=${toCompact(days.id)}`);
  render(<App />);
  await screen.findByRole('dialog', { name: 'Days As Echoes' });
  expect(calls('Record Opened')).toEqual([{ record: label(days), from: 'link' }]);
});

test('a shared crate: opening the link, opening a record from it, saving it', async () => {
  window.history.replaceState(null, '', `/?shared=${encodeShare({ name: 'For you', records: [universal.id, days.id] })}`);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: `Universal Beings by ${universal.artist}` }));
  expect(calls('Record Opened')).toEqual([{ record: label(universal), from: 'shared' }]);
  await user.click(screen.getByRole('button', { name: 'Close' }));
  await user.click(screen.getByRole('button', { name: 'Save to my crates' }));
  expect(calls('Shared Crate')).toEqual([{ action: 'opened', records: 2 }, { action: 'saved', records: 2 }]);
});

test('hearting, adding to a crate and starting a crate are crate actions; un-hearting is not', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  const dialog = screen.getByRole('dialog', { name: 'Universal Beings' });
  const heart = within(dialog).getByRole('button', { name: 'Save to favorites' });
  await user.click(heart);
  await user.click(heart);
  await user.click(within(dialog).getByRole('button', { name: 'Add to crate' }));
  await user.type(within(dialog).getByRole('textbox', { name: 'New crate name' }), 'Late Night');
  await user.click(within(dialog).getByRole('button', { name: 'Create crate' }));
  await user.click(within(dialog).getByRole('checkbox', { name: 'Late Night' })); // take it out
  await user.click(within(dialog).getByRole('checkbox', { name: 'Late Night' })); // put it back
  expect(calls('Crate Action')).toEqual([
    { action: 'favorite', record: label(universal) },
    { action: 'new-crate', record: label(universal) },
    { action: 'add-to-crate', record: label(universal) },
  ]);
});

test('every way out to Bandcamp from the pop-up is a Bandcamp click, named by which link', async () => {
  const about = { url: 'https://x.bandcamp.com/album/y', description: 'Notes.' };
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(about), { status: 200, headers: { 'content-type': 'application/json' } })));
  const enriched = { sources: ['apple'], bandcampUrl: 'https://x.bandcamp.com/album/y' } as Enriched;
  render(<AlbumDialog record={universal} enriched={enriched} onClose={() => {}} />);
  const user = userEvent.setup();
  const noNav = (e: MouseEvent) => e.preventDefault(); // jsdom can't follow links
  document.addEventListener('click', noNav);
  await user.click(screen.getByRole('link', { name: /Player not loading/ }));
  await user.click(screen.getByRole('link', { name: /Open on Bandcamp/ }));
  await user.click(await screen.findByRole('link', { name: /From the Bandcamp page/ }));
  document.removeEventListener('click', noNav);
  expect(screen.getByRole('link', { name: /Player not loading/ })).toHaveAttribute('href', embedUrl(universal));
  expect(calls('Bandcamp Clicked')).toEqual(['player-fallback', 'open-button', 'notes'].map((link) => ({ record: label(universal), link })));
});

test('opening the notes counts; closing them again does not', async () => {
  const user = userEvent.setup();
  render(<AlbumAbout about={{ description: 'A long paragraph. '.repeat(40), credits: 'Mixed by Dave.' }} />);
  await user.click(screen.getByRole('button', { name: 'Read more' }));
  await user.click(screen.getByRole('button', { name: 'Show less' }));
  await user.click(screen.getByText('Credits'));
  expect(calls('Notes Expanded')).toEqual([{ part: 'read-more' }, { part: 'credits' }]);
});

test('a search counts once when typing stops, as some or no results, never the words', async () => {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('button', { name: /^Universal Beings/ });
  await user.type(screen.getByPlaceholderText(/search records/i), 'universal');
  await waitFor(() => expect(calls('Search')).toEqual([{ results: 'some' }]), { timeout: 2000 });
  await user.clear(screen.getByPlaceholderText(/search records/i));
  await user.type(screen.getByPlaceholderText(/search records/i), 'zzzz');
  await waitFor(() => expect(calls('Search')).toEqual([{ results: 'some' }, { results: 'none' }]), { timeout: 2000 });
});

test('a visitor whose browser cannot draw the shop counts once', async () => {
  render(<App />);
  await screen.findByRole('button', { name: /^Universal Beings/ });
  expect(calls('3D Unavailable')).toEqual([{ reason: 'unsupported' }]);
});

test('3D trouble counts once per browser session, not on every page load', async () => {
  const first = render(<App />);
  await screen.findByRole('button', { name: /^Universal Beings/ });
  first.unmount();
  render(<App />); // back from the about page, same tab
  await screen.findByRole('button', { name: /^Universal Beings/ });
  expect(calls('3D Unavailable')).toEqual([{ reason: 'unsupported' }]);
});

test('a page that loads with a search already in its link is not a new search', async () => {
  window.history.replaceState(null, '', '/?view=grid&q=universal');
  render(<App />);
  await screen.findByRole('button', { name: /^Universal Beings/ });
  await new Promise((r) => setTimeout(r, 1000));
  expect(calls('Search')).toEqual([]);
});

test('choosing the grid on purpose is not a 3D failure', async () => {
  window.history.replaceState(null, '', '/?view=grid');
  render(<App />);
  await screen.findByRole('button', { name: /^Universal Beings/ });
  expect(calls('3D Unavailable')).toEqual([]);
});

test('no event carries more than two properties', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  for (const [, props] of vi.mocked(track).mock.calls) expect(Object.keys(props ?? {}).length).toBeLessThanOrEqual(2);
});
