// "My crates" as a 3D crate (plan Task 10; decision 9). Driven through its HTML controls and status line.
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
const albums: { id: string; title: string }[] = JSON.parse(fixture).albums;
const id = (title: string) => albums.find((a) => a.title === title)!.id;

async function openCrates(page: Page) {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
  await page.addInitScript(([favorites, crate]) => {
    window.localStorage.setItem('rl-record-store:visitor', JSON.stringify({
      schemaVersion: 1, favorites, crates: [{ id: 'late-night', name: 'Late night', records: crate }],
    }));
  }, [[id('Universal Beings'), id('Days As Echoes')], [id('Days As Echoes'), 'bandcamp:album:999999999', id('Universal Beings')]]);
  await page.goto('/?view=grid');
  await page.getByRole('button', { name: /my crates/i }).click();
  const stage = page.getByRole('dialog', { name: 'My crates' });
  await expect(stage.locator('[data-ready="true"]')).toBeAttached({ timeout: 30_000 }); // software 3D can be slow to start
  return stage;
}

test('tabs count only records still in the catalog; Flip moves the standing record', async ({ page }) => {
  const stage = await openCrates(page);
  await expect(stage.getByRole('button', { name: /^Late night 2$/ })).toBeVisible(); // the unknown id isn't counted
  const status = stage.getByRole('status');
  await expect(status).toHaveText(/, 1 of 2$/);
  await stage.getByRole('button', { name: 'Flip' }).click();
  await expect(status).toHaveText(/, 2 of 2$/);
});

test('dragging up digs; Alt/⌘ + arrow is left to the browser', async ({ page }) => {
  const stage = await openCrates(page);
  const status = stage.getByRole('status');
  const box = (await stage.locator('canvas').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 40, { steps: 5 });
  await page.mouse.up();
  await expect(status).toHaveText(/, 2 of 2$/);
  await page.keyboard.press('Alt+ArrowLeft');
  await expect(status).toHaveText(/, 2 of 2$/);
  await page.keyboard.press('ArrowLeft');
  await expect(status).toHaveText(/, 1 of 2$/);
});

test('Show, Open album, close: back in the crate on the same record', async ({ page }) => {
  const stage = await openCrates(page);
  await stage.getByRole('button', { name: 'Flip' }).click();
  const title = (await stage.getByRole('status').textContent())!.split(' by ')[0]!;
  await stage.getByRole('button', { name: 'Show' }).click();
  await stage.getByRole('button', { name: 'Open album' }).click();
  const album = page.getByRole('dialog', { name: title });
  await expect(album).toBeVisible();
  await album.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: 'My crates' }).getByRole('status')).toHaveText(new RegExp(`^${title} by .*, 2 of 2$`));
});

test('Copy share link works from the 3D crate', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write']);
  const page = await ctx.newPage();
  const stage = await openCrates(page);
  await stage.getByRole('button', { name: /^Late night/ }).click();
  await stage.getByRole('button', { name: 'Copy share link' }).click();
  await expect(stage.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/\/\?shared=[A-Za-z0-9_-]+$/);
});

test('with reduced motion the crate says so', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const stage = await openCrates(page);
  await expect(stage.locator('[data-reduced-motion="true"]')).toBeAttached();
});
