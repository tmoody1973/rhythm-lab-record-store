import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
export async function offline(page: Page) {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
}
/** The scene is listening (context loss) and drawing; software rendering can take a while to get there. */
const ready = (page: Page) => expect(page.locator('[data-testid="shop"][data-ready="true"] canvas')).toBeVisible({ timeout: 30_000 });
const frames = (page: Page) => page.evaluate(() => (window as unknown as { __rlFrames?: number }).__rlFrames ?? -1);

test('the front door is the shop: a full-page canvas and the Store/Grid switch', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await expect(page.getByTestId('shop')).toBeVisible();
  await expect(page.locator('[data-testid="shop"] canvas')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Store', pressed: true })).toBeVisible();
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
});

test('the scene stops drawing when nothing moves', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await ready(page);
  // Count the browser's own animation-frame ticks alongside the scene's drawn frames. A scene that draws every frame
  // draws on (nearly) every tick, however slow the machine; an idle on-demand scene draws on almost none.
  await page.evaluate(() => { const w = window as unknown as { __raf: number }; w.__raf = 0; const tick = () => { w.__raf++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const sample = () => page.evaluate(() => { const w = window as unknown as { __raf: number; __rlFrames?: number }; return { raf: w.__raf, frames: w.__rlFrames ?? 0 }; });
  let prev = await sample();
  await expect.poll(async () => {
    await page.waitForTimeout(3000);
    const now = await sample();
    const [ticks, drawn] = [now.raf - prev.raf, now.frames - prev.frames];
    prev = now;
    return ticks >= 10 && drawn <= 2 + ticks * 0.1;
  }, { timeout: 45_000, intervals: [0] }).toBe(true);
});

test('if the GPU gives up, the grid takes over with a notice, for the rest of the visit', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await ready(page); // listening for context loss
  await page.evaluate(() => {
    const c = document.querySelector('[data-testid="shop"] canvas') as HTMLCanvasElement;
    (c.getContext('webgl2') ?? c.getContext('webgl'))!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
  await expect(page.getByText("The 3D shop stopped working in this browser, so here's the grid.")).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
});

test('step into a section and a bin; the link follows, and Back steps out one level at a time', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  const sections = page.getByRole('navigation', { name: 'Shop sections' });
  await sections.getByRole('button', { name: /^Jazz/ }).click();
  await expect(page).toHaveURL(/[?&]section=jazz(&|$)/);
  const bins = page.getByRole('navigation', { name: 'Bins' });
  await bins.getByRole('button').first().click();
  await expect(page).toHaveURL(/[?&]section=jazz&bin=0$/);
  for (const name of ['Previous', 'Show', 'Next']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/[?&]section=jazz$/);
  await expect(bins).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/section=/);
  await expect(sections.getByRole('button', { name: 'Whole shop', pressed: true })).toBeVisible();
});

test('Esc steps out one level', async ({ page }) => {
  await offline(page);
  await page.goto('/?section=jazz&bin=0');
  await expect(page.getByRole('button', { name: 'Show', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/[?&]section=jazz$/);
  await page.keyboard.press('Escape');
  await expect(page).not.toHaveURL(/section=/);
});

test('a hand-edited link to a section or bin that does not exist opens the whole shop', async ({ page }) => {
  await offline(page);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?section=bogus&bin=99');
  await expect(page.getByRole('navigation', { name: 'Shop sections' }).getByRole('button', { name: 'Whole shop', pressed: true })).toBeVisible();
  await expect(page).not.toHaveURL(/section=|bin=/);
  await page.goto('/?section=jazz&bin=99');
  await expect(page).toHaveURL(/[?&]section=jazz$/);
  expect(errors).toEqual([]);
});

async function openFirstJazzBin(page: Page) {
  await offline(page);
  await page.goto('/?section=jazz&bin=0');
  await ready(page);
  return page.getByRole('status');
}

test('digging: Next and the arrow keys step through the bin; the status names the standing record', async ({ page }) => {
  const status = await openFirstJazzBin(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(status).toHaveText(/, 1 of 3$/);
  await page.keyboard.press('ArrowRight');
  await expect(status).toHaveText(/, 2 of 3$/);
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText(/, 1 of 3$/);
});

test('mashing Next never leaves the bin, and the caption matches the status', async ({ page }) => {
  const status = await openFirstJazzBin(page);
  const next = page.getByRole('button', { name: 'Next', exact: true });
  for (let i = 0; i < 60; i++) await next.click({ delay: 0 });
  await expect(status).toHaveText(/, 3 of 3$/);
  const title = (await status.textContent())!.split(' by ')[0]!;
  await expect(page.getByTestId('dig-caption')).toContainText(title);
});

test('Alt/⌘ + arrow is left to the browser', async ({ page }) => {
  const status = await openFirstJazzBin(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(status).toHaveText(/, 1 of 3$/);
  await page.keyboard.press('Alt+ArrowRight');
  await page.keyboard.press('Meta+ArrowRight');
  await expect(status).toHaveText(/, 1 of 3$/);
});

test('Show, then Open album opens that record; closing it leaves you where you were', async ({ page }) => {
  const status = await openFirstJazzBin(page);
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Show', exact: true }).click();
  const title = (await status.textContent())!.split(' by ')[0]!;
  await page.getByRole('button', { name: 'Open album' }).click();
  const album = page.getByRole('dialog', { name: title });
  await expect(album).toBeVisible();
  await album.getByRole('button', { name: 'Close' }).click();
  await expect(album).toBeHidden();
  await expect(status).toHaveText(/, 1 of 3$/);
  await expect(page.getByRole('button', { name: 'Put back' })).toBeVisible();
});

test('with reduced motion the shop says so (sleeves snap instead of easing)', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openFirstJazzBin(page);
  await expect(page.getByTestId('shop')).toHaveAttribute('data-reduced-motion', 'true');
});

test('with no staff picks yet, there is no Staff picks pill and a link to them opens the whole shop', async ({ page }) => {
  await offline(page);
  await page.goto('/?section=staff-picks&bin=0');
  const sections = page.getByRole('navigation', { name: 'Shop sections' });
  await expect(sections.getByRole('button', { name: 'Whole shop', pressed: true })).toBeVisible();
  await expect(sections.getByRole('button', { name: /^Staff picks/ })).toHaveCount(0);
  await expect(page).not.toHaveURL(/section=/);
});

// ---- Final-review fixes ----

test('leaving the shop for the grid is not a GPU failure: no notice, and Store still works', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await ready(page);
  await page.getByRole('button', { name: 'Grid' }).click();
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText("The 3D shop stopped working in this browser, so here's the grid.")).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('rl-no-3d'))).toBeNull();
  await page.getByRole('button', { name: 'Store' }).click();
  await ready(page);
});

test('Enter on a header link still follows it while digging', async ({ page }) => {
  await offline(page);
  await page.goto('/?section=jazz&bin=0');
  await ready(page);
  await page.getByRole('link', { name: 'About' }).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/about\.html$/);
});

test('the bin sways with the mouse even when nothing else moves', async ({ page }) => {
  await offline(page);
  await page.goto('/?section=jazz&bin=0');
  await ready(page);
  // Wait until the scene is quiet (1.5 s with no frames drawn), then move the mouse.
  let last = await frames(page);
  await expect.poll(async () => { await page.waitForTimeout(1500); const now = await frames(page); const d = now - last; last = now; return d; }, { timeout: 45_000, intervals: [0] }).toBe(0);
  const before = await frames(page);
  const box = (await page.locator('[data-testid="shop"] canvas').boundingBox())!;
  for (let i = 0; i < 10; i++) await page.mouse.move(box.x + box.width * (0.2 + i * 0.06), box.y + box.height / 2);
  await expect.poll(() => frames(page), { timeout: 10_000 }).toBeGreaterThan(before + 2);
});

test('"Whole shop" brings the camera back after you have orbited away', async ({ page }) => {
  test.setTimeout(180_000); // three eased camera moves; slow under software rendering
  await offline(page);
  await page.goto('/');
  await ready(page);
  const read = () => page.evaluate(() => { const w = window as unknown as { __rlCamera?: number[]; __rlAim?: number[] }; return { cam: w.__rlCamera ?? [0, 0, 0], aim: w.__rlAim ?? [9, 9, 9] }; });
  const offAim = async () => { const { cam, aim } = await read(); return Math.hypot(...cam.map((v, i) => v - aim[i]!)); };
  await expect.poll(offAim, { timeout: 45_000 }).toBeLessThan(0.5); // settled on the store aim
  const box = (await page.locator('[data-testid="shop"] canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.6, { steps: 10 });
  await page.mouse.up();
  await expect.poll(offAim, { timeout: 30_000 }).toBeGreaterThan(2); // orbited away
  await page.getByRole('navigation', { name: 'Shop sections' }).getByRole('button', { name: 'Whole shop' }).click();
  await expect.poll(offAim, { timeout: 45_000 }).toBeLessThan(0.5);
});

test('after the shop sits idle, Next eases the records instead of jumping (Tarik: "it glitches")', async ({ page }) => {
  await offline(page);
  await page.goto('/?section=jazz&bin=0');
  await ready(page);
  // Press Next only while R3F's loop is stopped, checking and pressing in one page task so no frame slips in between
  // (a late font load can start a burst of frames right after a "looks idle" check on a slow machine).
  await expect.poll(() => page.evaluate(() => {
    const w = window as unknown as { __rlIdle?: boolean; __rlDeltas: number[] };
    if (!w.__rlIdle) return false;
    w.__rlDeltas = [];
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Next')!.click();
    return true;
  }), { timeout: 45_000 }).toBe(true);
  await page.waitForTimeout(1500);
  const deltas = await page.evaluate(() => (window as unknown as { __rlDeltas: number[] }).__rlDeltas);
  expect(deltas.length).toBeGreaterThan(0);
  expect(deltas[0]).toBeLessThanOrEqual(1 / 60 + 1e-6); // the first frame after the pause is one normal step, not seconds
  expect(Math.max(...deltas)).toBeLessThanOrEqual(0.1 + 1e-6);
});

test('clicking a record in the right-hand compartment picks it (Tarik: "just the one on the left")', async ({ page }) => {
  const base = JSON.parse(fixture);
  const one = base.albums.find((a: { genre: string | null }) => a.genre === 'rock');
  const albums = Array.from({ length: 30 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return { ...one, id: `bandcamp:album:90${n}`, bandcampId: 9000 + i, title: `Record ${n}`, artist: `Artist ${n}` };
  });
  await page.route('**/catalog.json', (r) => r.fulfill({ body: JSON.stringify({ ...base, count: albums.length, albums }), contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
  await page.goto('/?section=rock-pop-alt&bin=0');
  await ready(page);
  let last = await frames(page);
  await expect.poll(async () => { await page.waitForTimeout(1500); const now = await frames(page); const d = now - last; last = now; return d; }, { timeout: 45_000, intervals: [0] }).toBe(0);
  // Record 25 is the front sleeve of the right compartment (24 per compartment).
  const at = await page.evaluate(() => (window as unknown as { __rlScreenOf: (n: string) => number[] | null }).__rlScreenOf('bandcamp:album:9025'));
  expect(at).not.toBeNull();
  await page.mouse.click(at![0]!, at![1]!);
  await expect(page.getByRole('status')).toHaveText('Record 25 by Artist 25, 25 of 30');
});
