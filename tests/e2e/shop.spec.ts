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
  await expect(page.locator('[data-testid="shop"] canvas')).toBeVisible();
  await page.evaluate(() => {
    const c = document.querySelector('[data-testid="shop"] canvas') as HTMLCanvasElement;
    (c.getContext('webgl2') ?? c.getContext('webgl'))!.getExtension('WEBGL_lose_context')!.loseContext();
  });
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
  await expect(page.getByText("The 3D shop stopped working in this browser, so here's the grid.")).toBeVisible();
  await page.goto('/');
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
});
