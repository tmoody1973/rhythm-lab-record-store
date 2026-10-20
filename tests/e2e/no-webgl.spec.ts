// A browser that has WebGL's constructor but can't make a context (blocklisted GPU, acceleration off) must get the
// grid and the flat My crates — never a blank page (Global Constraints: "never a blank room").
import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--disable-webgl', '--disable-3d-apis'] } });
const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');

test('no usable WebGL: the front door is the grid, and My crates is the flat version', async ({ page }) => {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
  await page.goto('/');
  await expect(page.getByRole('banner')).toBeVisible();
  await expect(page.getByRole('list', { name: /records/i })).toBeVisible();
  await page.getByRole('button', { name: /my crates/i }).click();
  const panel = page.getByRole('dialog', { name: 'My crates' });
  await expect(panel).toBeVisible();
  await expect(panel.locator('canvas')).toHaveCount(0);
});
