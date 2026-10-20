import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');

test.beforeEach(async ({ page }) => {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort()); // stay offline
});

test('browse: genre, sort, search and letter jump update the URL and survive a reload', async ({ page }) => {
  await page.goto('/?view=grid');
  await expect(page.getByRole('heading', { name: 'Pull up a crate.' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Showing 1–20 of 20 records');

  await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: /^Jazz/ }).click();
  await expect(page.getByRole('status')).toHaveText('Showing 1–3 of 3 records');
  await page.getByLabel('Sort by').selectOption('title-desc');
  await expect(page).toHaveURL(/\?genre=jazz&sort=title-desc&view=grid$/);

  await page.reload();
  await expect(page.getByRole('status')).toHaveText('Showing 1–3 of 3 records');
  await expect(page.getByLabel('Sort by')).toHaveValue('title-desc');

  await page.getByRole('searchbox', { name: /search records/i }).fill('makaya');
  await expect(page.getByRole('status')).toHaveText('Showing 1–1 of 1 records');
  await expect(page).toHaveURL(/q=makaya/);

  await page.getByRole('button', { name: 'All records' }).click();
  await page.getByRole('searchbox', { name: /search records/i }).fill('');
  await page.getByLabel('Sort by').selectOption('artist-asc');
  await page.getByRole('button', { name: 'Jump to T' }).click();
  await expect(page.locator(':focus')).toContainText('TASO TEKLIFE');
  // Placeholder sleeves are decorative: the card's name is title + artist once, not twice.
  await expect(page.locator(':focus')).toHaveAccessibleName(/^THA GREEK FREQ VOL\. 1\s*TASO TEKLIFE$/);
});
