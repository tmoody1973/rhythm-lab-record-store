import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');

async function offline(page: Page) {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
}

test('visitor flow: filter, open, crate it, share it, save it in another browser', async ({ browser }) => {
  const mine = await browser.newContext();
  await mine.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await mine.newPage();
  await offline(page);

  await page.goto('/');
  await page.getByText('More', { exact: true }).click();
  await page.getByRole('button', { name: /^Jazz/ }).click();
  await page.getByLabel('Sort by').selectOption('artist-asc');
  await page.getByRole('button', { name: /^Universal Beings/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Universal Beings' });
  await expect(dialog.locator('iframe')).toHaveAttribute('src', /EmbeddedPlayer\/album=\d+\//);
  await dialog.getByRole('button', { name: 'Add to crate' }).click();
  await dialog.getByRole('textbox', { name: 'New crate name' }).fill('Road Trip');
  await dialog.getByRole('button', { name: 'Create crate' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Road Trip' })).toBeChecked();
  await dialog.getByRole('button', { name: 'Close' }).click();

  await page.getByRole('button', { name: /my crates/i }).click();
  const panel = page.getByRole('dialog', { name: 'My crates' });
  await panel.getByRole('button', { name: 'Copy share link' }).click();
  await expect(panel.getByRole('button', { name: 'Link copied' })).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/\?shared=[A-Za-z0-9_-]+$/);

  // A friend with an empty browser opens the link.
  const friend = await (await browser.newContext()).newPage();
  await offline(friend);
  await friend.goto(link.replace(/^https?:\/\/[^/]+/, ''));
  const banner = friend.getByRole('region', { name: 'Shared crate' });
  await expect(banner.getByRole('heading', { name: 'Road Trip' })).toBeVisible();
  await banner.getByRole('button', { name: 'Save to my crates' }).click();
  await friend.getByRole('button', { name: /my crates/i }).click();
  await expect(friend.getByRole('dialog', { name: 'My crates' }).getByText('Universal Beings')).toBeVisible();
});
