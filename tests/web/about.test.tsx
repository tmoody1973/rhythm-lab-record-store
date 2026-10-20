// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { expect, test } from 'vitest';
import { AboutPage } from '../../src/ui/AboutPage.tsx';
import { Header } from '../../src/ui/Header.tsx';

test('the main header links to the About page', () => {
  render(<Header />);
  expect(within(screen.getByRole('banner')).getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about.html');
});

test('About page: one h1, a heading per section, and a way back to the shop', () => {
  render(<AboutPage />);
  expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['About']);
  expect(screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)).toEqual([
    'About Rhythm Lab',
    'How it works',
    'The code',
    'Inspirations & credits',
  ]);
  expect(screen.getByRole('main')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /back to the shop/i })).toHaveAttribute('href', '/');
});

test('About page links to the repo, the show and the projects that inspired it', () => {
  render(<AboutPage />);
  const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
  expect(hrefs).toEqual(expect.arrayContaining([
    'https://github.com/tmoody1973/rhythm-lab-record-store',
    'https://radiomilwaukee.org/rhythm-lab-radio-syndication',
    'https://bandcamp.com/rhythmlab',
    'https://github.com/chrija76/bookshelf',
    'https://github.com/risq/cratedigger',
    'https://polyhaven.com',
    'https://musicbrainz.org',
    'https://www.discogs.com',
  ]));
  // Descriptive link text, never a bare URL.
  for (const a of screen.getAllByRole('link')) expect(a.textContent).not.toMatch(/^https?:/);
});

test('How it works says the 3D shop is live, with a link to the third-party notices', () => {
  render(<AboutPage />);
  expect(screen.getByText(/the front page is a 3D record shop you can turn around, step into and dig through/i)).toBeInTheDocument();
  expect(screen.queryByText(/in progress/i)).toBeNull();
  expect(screen.getByRole('link', { name: /third-party notices/i })).toHaveAttribute('href', 'https://github.com/tmoody1973/rhythm-lab-record-store/blob/main/THIRD_PARTY_NOTICES.md');
});
