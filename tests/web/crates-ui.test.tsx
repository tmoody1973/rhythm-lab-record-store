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
  expect(within(panel).getByRole('button', { name: 'Late Night', pressed: true })).toBeInTheDocument();
  expect(within(panel).getByRole('heading', { name: 'Universal Beings' })).toBeInTheDocument();
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

test('closing a record opened from the shared banner returns focus to that banner button', async () => {
  window.history.replaceState(null, '', `/?shared=${encodeShare({ name: 'Mix', records: [universal.id] })}`);
  const user = userEvent.setup();
  render(<App />);
  const banner = await screen.findByRole('region', { name: 'Shared crate' });
  const opener = within(banner).getByRole('button', { name: new RegExp(`^Universal Beings by`) });
  await user.click(opener);
  await user.click(within(screen.getByRole('dialog', { name: 'Universal Beings' })).getByRole('button', { name: 'Close' }));
  await new Promise((r) => setTimeout(r, 30));
  expect(document.activeElement).toBe(opener);
});

// "My crates" as a wooden crate you dig through (agreed with Tarik 2026-10-20, mockup A).
function seed(lateNight: string[] = [days.id, universal.id]) {
  window.localStorage.setItem('rl-record-store:visitor', JSON.stringify({
    schemaVersion: 1,
    favorites: [universal.id, days.id],
    crates: [{ id: 'late-night', name: 'Late Night', records: lateNight }, { id: 'empty', name: 'Empty', records: [] }],
  }));
}
async function openCrates() {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /my crates/i }));
  return { user, panel: screen.getByRole('dialog', { name: 'My crates' }) };
}
const front = (panel: HTMLElement) => within(panel).getByRole('heading', { level: 3 });

test('My crates opens on Favorites and digs with Flip, Back and the arrow keys', async () => {
  seed();
  const { user, panel } = await openCrates();
  expect(within(panel).getByRole('button', { name: 'Favorites', pressed: true })).toBeInTheDocument();
  expect(front(panel)).toHaveTextContent('Universal Beings');
  expect(panel).toHaveTextContent('1 of 2');
  await user.click(within(panel).getByRole('button', { name: 'Flip' }));
  expect(front(panel)).toHaveTextContent('Days As Echoes');
  expect(within(panel).getByRole('status')).toHaveTextContent('Days As Echoes by Misha Panfilov Sound Combo, 2 of 2');
  expect(within(panel).getByRole('button', { name: 'Flip' })).toBeDisabled();
  await user.keyboard('{ArrowLeft}');
  expect(front(panel)).toHaveTextContent('Universal Beings');
  await user.keyboard('{ArrowRight}');
  expect(front(panel)).toHaveTextContent('Days As Echoes');
  await user.click(within(panel).getByRole('button', { name: 'Back' }));
  expect(front(panel)).toHaveTextContent('Universal Beings');
});

test('Open album from the crate; closing it returns to the same sleeve', async () => {
  seed();
  const { user, panel } = await openCrates();
  await user.click(within(panel).getByRole('button', { name: 'Flip' }));
  await user.click(within(panel).getByRole('button', { name: 'Open album' }));
  const album = screen.getByRole('dialog', { name: 'Days As Echoes' });
  await user.click(within(album).getByRole('button', { name: 'Close' }));
  const again = await screen.findByRole('dialog', { name: 'My crates' });
  expect(front(again)).toHaveTextContent('Days As Echoes');
  expect(again).toHaveTextContent('2 of 2');
});

test('switching crates, and My crates reopens on the last crate used', async () => {
  seed();
  const { user, panel } = await openCrates();
  await user.click(within(panel).getByRole('button', { name: 'Late Night' }));
  expect(front(panel)).toHaveTextContent('Days As Echoes');
  expect(panel).toHaveTextContent('1 of 2');
  await user.click(within(panel).getByRole('button', { name: 'Close' }));
  await user.click(screen.getByRole('button', { name: /my crates/i }));
  expect(within(screen.getByRole('dialog', { name: 'My crates' })).getByRole('button', { name: 'Late Night', pressed: true })).toBeInTheDocument();
  expect(window.localStorage.getItem('rl-record-store:last-crate')).toBe('late-night');
});

test('Remove takes the front record out; an empty crate says how to fill it', async () => {
  seed([days.id]);
  const { user, panel } = await openCrates();
  await user.click(within(panel).getByRole('button', { name: 'Late Night' }));
  await user.click(within(panel).getByRole('button', { name: 'Remove' }));
  expect(panel).toHaveTextContent(/nothing in here yet/i);
  expect(saved().crates[0].records).toEqual([]);
});

test('arrow keys do not flip while renaming a crate', async () => {
  seed();
  const { user, panel } = await openCrates();
  await user.click(within(panel).getByRole('button', { name: 'Late Night' }));
  await user.click(within(panel).getByRole('button', { name: 'Rename' }));
  await user.type(within(panel).getByRole('textbox', { name: 'Rename Late Night' }), '{ArrowRight}{ArrowRight}');
  expect(panel).toHaveTextContent('1 of 2');
});

test("arrow keys with a modifier are left to the browser (Alt/⌘+Arrow is Back/Forward)", async () => {
  seed();
  const { user, panel } = await openCrates();
  await user.keyboard('{Alt>}{ArrowRight}{/Alt}{Meta>}{ArrowRight}{/Meta}');
  expect(panel).toHaveTextContent('1 of 2');
});
