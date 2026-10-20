import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
export async function offline(page: Page) {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
}
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
  await expect(page.locator('[data-testid="shop"] canvas')).toBeVisible();
  await page.waitForTimeout(4000);
  const a = await frames(page);
  expect(a).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  expect((await frames(page)) - a).toBeLessThanOrEqual(2);
});

test('if the GPU gives up, the grid takes over with a notice, for the rest of the visit', async ({ page }) => {
  await offline(page);
  await page.goto('/');
  await expect(page.locator('[data-testid="shop"][data-ready="true"] canvas')).toBeVisible(); // listening for context loss
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
