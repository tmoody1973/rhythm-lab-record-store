import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
const albums: { id: string; title: string }[] = JSON.parse(fixture).albums;
const id = (title: string) => albums.find((a) => a.title === title)!.id;

async function openCrates(page: Page) {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
  await page.addInitScript((favorites) => {
    window.localStorage.setItem('rl-record-store:visitor', JSON.stringify({ schemaVersion: 1, favorites, crates: [] }));
  }, [id('Universal Beings'), id('Days As Echoes')]);
  await page.goto('/');
  await page.getByRole('button', { name: /my crates/i }).click();
  return page.getByRole('dialog', { name: 'My crates' });
}

// Describes the flat My crates; the 3D crate replaces it in plan Task 10, which rewrites these.
test.fixme('swiping the sleeve left flips to the next record, right goes back', async ({ page }) => {
  const panel = await openCrates(page);
  const box = (await panel.locator('[style*="touch-action"]').boundingBox())!;
  const y = box.y + box.height / 2;
  const swipe = async (from: number, to: number) => {
    await page.mouse.move(from, y);
    await page.mouse.down();
    await page.mouse.move(to, y, { steps: 5 });
    await page.mouse.up();
  };
  await swipe(box.x + box.width * 0.7, box.x + box.width * 0.3);
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText('Days As Echoes');
  await swipe(box.x + box.width * 0.3, box.x + box.width * 0.7);
  await expect(panel.getByRole('heading', { level: 3 })).toHaveText('Universal Beings');
});

// Describes the flat My crates; the 3D crate replaces it in plan Task 10, which rewrites these.
test.fixme('with reduced motion, sleeves swap without moving', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const panel = await openCrates(page);
  const animated = await panel.locator('.origin-bottom').evaluateAll((els) => els.map((e) => getComputedStyle(e).transitionProperty));
  expect(animated.length).toBeGreaterThan(0);
  expect(new Set(animated)).toEqual(new Set(['none']));
});
