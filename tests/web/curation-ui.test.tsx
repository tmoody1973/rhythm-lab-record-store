// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { Catalog } from '../../src/catalog/schema.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
const universal = fixture.albums.find((a) => a.title === 'Universal Beings')!;
const days = fixture.albums.find((a) => a.title === 'Days As Echoes')!;

vi.mock('../../src/crates/curation.ts', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../src/crates/curation.ts')>();
  return {
    ...real,
    TARIK_CRATES: [{ id: 'staff-picks', name: 'Staff Picks', note: 'On repeat at Rhythm Lab.', records: [universal.id, days.id] }],
    TARIK_NOTES: { [universal.id]: 'Chicago at its most expansive.' },
  };
});
const { App } = await import('../../src/App.tsx');

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(fixture), { status: 200 })));
});
afterEach(() => vi.unstubAllGlobals());

test("Tarik's crate is a chip that filters, and the pop-up shows the crate and his note", async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Staff Picks' }));
  expect(screen.getByRole('status')).toHaveTextContent('of 2 records');
  expect(window.location.search).toBe('?crate=staff-picks');
  await user.click(screen.getByRole('button', { name: /^Universal Beings/ }));
  const dialog = screen.getByRole('dialog', { name: 'Universal Beings' });
  expect(within(dialog).getByText('Staff Picks · Jazz')).toBeInTheDocument();
  expect(within(dialog).getByText(/Chicago at its most expansive/)).toBeInTheDocument();
});
