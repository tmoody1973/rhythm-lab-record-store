import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
const { albums } = JSON.parse(fixture) as { albums: { id: string; title: string; bandcampId: number }[] };
const universal = albums.find((a) => a.title === 'Universal Beings')!;

test.beforeEach(async ({ page }) => {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort()); // stay offline
});

test('open from the grid, browser Back closes it and keeps the filters', async ({ page }) => {
  await page.goto('/?genre=jazz');
  await page.getByRole('button', { name: /^Universal Beings/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Universal Beings' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(`/?genre=jazz&record=a${universal.bandcampId}`);
  await expect(dialog.locator('iframe')).toHaveAttribute('src', new RegExp(`/album=${universal.bandcampId}/`));

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL('/?genre=jazz');
  await expect(page.getByRole('button', { name: /^Universal Beings/ })).toBeFocused();
  await expect(page.locator('iframe')).toHaveCount(0);
});

test('Escape closes; a direct link closes back to the collection, not out of the site', async ({ page }) => {
  await page.goto(`/?record=a${universal.bandcampId}`);
  await expect(page.getByRole('dialog', { name: 'Universal Beings' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Pull up a crate.' })).toBeVisible();
});
