// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, expect, test, vi } from 'vitest';
import { loadAbout, type About } from '../../src/catalog/about.ts';
import type { Catalog } from '../../src/catalog/schema.ts';
import { AlbumAbout } from '../../src/ui/AlbumAbout.tsx';
import { AlbumDialog } from '../../src/ui/AlbumDialog.tsx';

afterEach(() => vi.unstubAllGlobals());

const long: About = {
  url: 'https://intlanthem.bandcamp.com/album/edge-conditions',
  description: 'Edge Conditions is the new album.\n\n' + 'A long paragraph about the record. '.repeat(30),
  credits: 'Composed by Jeremiah Chiu.\nMarquis Hill performs trumpet on (4).',
  tags: ['electronic', 'jazz', 'chicago'],
};
const json = (body: unknown, type = 'application/json') => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': type } });

test('a long description shows a preview and Read more opens the rest in place', async () => {
  render(<AlbumAbout about={long} />);
  const text = screen.getByText(/Edge Conditions is the new album/);
  expect(text).toHaveClass('line-clamp-4');
  const more = screen.getByRole('button', { name: 'Read more' });
  expect(more).toHaveAttribute('aria-expanded', 'false');
  await userEvent.setup().click(more);
  expect(text).not.toHaveClass('line-clamp-4');
  expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
});

test('a short description has no Read more', () => {
  render(<AlbumAbout about={{ description: 'Prod Mndsgn' }} />);
  expect(screen.getByText('Prod Mndsgn')).not.toHaveClass('line-clamp-4');
  expect(screen.queryByRole('button', { name: 'Read more' })).toBeNull();
});

test('credits start folded, tags are listed, and the source links to the Bandcamp page', () => {
  render(<AlbumAbout about={long} />);
  const credits = screen.getByText('Credits').closest('details')!;
  expect(credits).not.toHaveAttribute('open');
  expect(within(credits).getByText(/Marquis Hill performs trumpet/)).toBeInTheDocument();
  expect(within(screen.getByRole('list', { name: 'Bandcamp tags' })).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['electronic', 'jazz', 'chicago']);
  expect(screen.getByRole('link', { name: /From the Bandcamp page/ })).toHaveAttribute('href', long.url);
});

test('loadAbout reads the record file, and treats missing, HTML or empty answers as nothing', async () => {
  const f = vi.fn(async () => json(long));
  expect(await loadAbout('bandcamp:album:3274104668', f)).toEqual(long);
  expect(f).toHaveBeenCalledWith('/about/a3274104668.json');
  expect(await loadAbout('bandcamp:album:1', async () => json({}))).toBeNull();
  expect(await loadAbout('bandcamp:album:1', async () => json({ description: 'x' }, 'text/html'))).toBeNull();
  expect(await loadAbout('bandcamp:album:1', async () => new Response('nope', { status: 404 }))).toBeNull();
  expect(await loadAbout('bandcamp:album:1', async () => json({ description: '<b>' + 'x'.repeat(30_000) }))).toBeNull();
});

test('the pop-up shows About under the player once the record file arrives', async () => {
  const record = (JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8')) as Catalog).albums[0];
  vi.stubGlobal('fetch', vi.fn(async () => json(long)));
  render(<AlbumDialog record={record} onClose={() => {}} />);
  const heading = await screen.findByRole('heading', { name: 'About this record' });
  const player = screen.getByTitle(/Bandcamp player/);
  expect(player.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
