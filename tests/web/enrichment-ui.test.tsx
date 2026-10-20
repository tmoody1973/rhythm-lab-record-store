// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { App } from '../../src/App.tsx';
import type { Catalog } from '../../src/catalog/schema.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
const universal = fixture.albums.find((a) => a.title === 'Universal Beings')!;

function serve(enrichment: unknown | null) {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url === '/catalog.json') return new Response(JSON.stringify(fixture), { status: 200, headers: { 'content-type': 'application/json' } });
    if (url === '/enrichment.json' && enrichment) return new Response(JSON.stringify(enrichment), { status: 200, headers: { 'content-type': 'application/json' } });
    return new Response('', { status: 404 });
  }));
}
const file = (entries: Record<string, unknown>) => ({ schemaVersion: 1, generatedAt: 't', entries });
const open = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(await screen.findByRole('button', { name: /^Universal Beings/ }));
  return screen.getByRole('dialog', { name: 'Universal Beings' });
};

beforeEach(() => window.history.replaceState(null, '', '/'));
afterEach(() => vi.unstubAllGlobals());

test('the pop-up shows the label line and an Open on Bandcamp link', async () => {
  serve(file({ [universal.id]: { label: 'International Anthem', releaseDate: '2018-10-26', catalogNumber: 'IARC 0022', bandcampUrl: 'https://intlanthem.bandcamp.com/album/universal-beings', sources: ['musicbrainz'] } }));
  const user = userEvent.setup();
  render(<App />);
  const dialog = await open(user);
  expect(within(dialog).getByText('International Anthem · 2018 · IARC 0022')).toBeInTheDocument();
  const link = within(dialog).getByRole('link', { name: /open on bandcamp/i });
  expect(link).toHaveAttribute('href', 'https://intlanthem.bandcamp.com/album/universal-beings');
  expect(link).toHaveAttribute('target', '_blank');
  expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('a non-Bandcamp link in the file is rejected and nothing breaks', async () => {
  serve(file({ [universal.id]: { label: 'X', bandcampUrl: 'https://evil.example/x', sources: ['musicbrainz'] } }));
  const user = userEvent.setup();
  render(<App />);
  const dialog = await open(user);
  expect(within(dialog).queryByRole('link', { name: /open on bandcamp/i })).toBeNull();
  expect(within(dialog).queryByText('X')).toBeNull(); // the whole file failed validation, so nothing from it shows
});

test('without an enrichment file the site works and shows neither', async () => {
  serve(null);
  const user = userEvent.setup();
  render(<App />);
  const dialog = await open(user);
  expect(within(dialog).queryByRole('link', { name: /open on bandcamp/i })).toBeNull();
  expect(screen.queryByLabelText('Country')).toBeNull();
});

test('a Country filter appears when enough records have a country, and filters', async () => {
  const ids = fixture.albums.slice(0, 7).map((a) => a.id); // 7 of 20 = 35%
  serve(file(Object.fromEntries(ids.map((id, i) => [id, { artistCountry: i < 4 ? 'GB' : 'US', sources: ['musicbrainz'] }]))));
  const user = userEvent.setup();
  render(<App />);
  const select = await screen.findByLabelText('Country');
  expect(within(select).getByRole('option', { name: 'United Kingdom' })).toBeInTheDocument();
  await user.selectOptions(select, 'GB');
  expect(screen.getByRole('status')).toHaveTextContent('of 4 records');
  expect(window.location.search).toBe('?country=GB');
  expect(screen.getByText(/Metadata: MusicBrainz/)).toBeInTheDocument();
});

test('at 25% coverage (above the 20% bar) the Country filter shows', async () => {
  serve(file(Object.fromEntries(fixture.albums.slice(0, 5).map((a) => [a.id, { artistCountry: 'GB', sources: ['musicbrainz'] }]))));
  render(<App />);
  expect(await screen.findByLabelText('Country')).toBeInTheDocument();
});

test('below 20% coverage the Country filter stays hidden', async () => {
  serve(file({ [fixture.albums[0]!.id]: { artistCountry: 'GB', sources: ['discogs'] } }));
  render(<App />);
  await screen.findByRole('heading', { name: 'Pull up a crate.' });
  expect(screen.queryByLabelText('Country')).toBeNull();
});
