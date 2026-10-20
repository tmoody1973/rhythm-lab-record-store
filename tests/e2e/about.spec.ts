import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort()); // stay offline
});

test('About: reachable from the header, and "Back to the shop" returns home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'About' }).click();
  await expect(page).toHaveURL(/\/about\.html$/);
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();

  await page.getByRole('link', { name: /back to the shop/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Pull up a crate.' })).toBeVisible();
});

test('About: no sideways scrolling on a 390px phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/about.html');
  await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
});
