// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import { embedUrl, toCompact } from '../../src/catalog/ids.ts';
import type { Catalog } from '../../src/catalog/schema.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
const album = fixture.albums.find((a) => a.title === 'Universal Beings')!;
const other = fixture.albums.find((a) => a.title === 'Days As Echoes')!;
const track = fixture.albums.find((a) => a.kind === 'track')!;

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

const card = (title: string) => screen.getByRole('button', { name: new RegExp(`^${title}`) });
const iframes = () => document.querySelectorAll('iframe');

test('clicking a card opens a named pop-up with exactly one Bandcamp player', async () => {
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  const dialog = screen.getByRole('dialog', { name: 'Universal Beings' });
  expect(within(dialog).getByText(album.artist, { selector: 'p' })).toBeInTheDocument();
  expect(iframes()).toHaveLength(1);
  expect(iframes()[0]).toHaveAttribute('src', embedUrl(album));
  expect(iframes()[0]).toHaveAttribute('title', `Bandcamp player: Universal Beings by ${album.artist}`);
  expect(window.location.search).toBe(`?record=${toCompact(album.id)}`);
});

test('closing removes the player and returns focus to the card; another record still has one player', async () => {
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  await user.click(screen.getByRole('button', { name: 'Close' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(iframes()).toHaveLength(0);
  expect(document.activeElement).toBe(card('Universal Beings'));
  await user.click(card('Days As Echoes'));
  expect(screen.getByRole('dialog', { name: 'Days As Echoes' })).toBeInTheDocument();
  expect(iframes()).toHaveLength(1);
  expect(iframes()[0]).toHaveAttribute('src', embedUrl(other));
});

test('Escape (the dialog cancel event) closes it', async () => {
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(iframes()).toHaveLength(0);
});

test('a direct record link opens that record, including single tracks', async () => {
  window.history.replaceState(null, '', `/?record=${toCompact(track.id)}`);
  render(<App />);
  const dialog = await screen.findByRole('dialog', { name: track.title });
  expect(within(dialog).getByText('Single track')).toBeInTheDocument();
  expect(iframes()[0]!.getAttribute('src')).toContain(`/track=${track.bandcampId}/`);
});

test.each(['a999999999', 'zzz'])('a bad record link (%s) opens nothing and says so', async (bad) => {
  window.history.replaceState(null, '', `/?record=${bad}`);
  render(<App />);
  expect(await screen.findByText(/that record link didn't match anything/i)).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(screen.getByRole('list', { name: /records/i })).toBeInTheDocument();
  expect(window.location.search).toBe('');
});

