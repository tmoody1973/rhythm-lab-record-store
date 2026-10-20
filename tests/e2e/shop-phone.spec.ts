// The shop on a phone (decision 10: tuned for phones, no desktop-only features).
import { readFileSync } from 'node:fs';
import { devices, expect, test, type Page } from '@playwright/test';

const { defaultBrowserType: _, ...iPhone } = devices['iPhone 13']; // keep Chromium (software WebGL), take the phone's screen and touch
test.use(iPhone);

const fixture = readFileSync('fixtures/catalog-sample.json', 'utf8');
async function open(page: Page, path: string) {
  await page.route('**/catalog.json', (r) => r.fulfill({ body: fixture, contentType: 'application/json' }));
  await page.route(/bandcamp\.com|bcbits\.com/, (r) => r.abort());
  await page.goto(path);
  await expect(page.locator('[data-testid="shop"][data-ready="true"] canvas')).toBeVisible({ timeout: 30_000 });
}
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('the overview fits a phone: pills scroll inside their bar, the page never scrolls sideways', async ({ page }) => {
  await open(page, '/');
  const sections = page.getByRole('navigation', { name: 'Shop sections' });
  await expect(sections.getByRole('button', { name: 'Whole shop' })).toBeVisible();
  expect(await noSidewaysScroll(page)).toBe(true);
  // The pills sit below the header, not under it.
  const header = (await page.locator('header').boundingBox())!;
  const pills = (await sections.boundingBox())!;
  expect(pills.y).toBeGreaterThanOrEqual(header.y + header.height - 1);
});

test('dig by tapping: Jazz, first bin, Next ×3, Show, Open album', async ({ page }) => {
  await open(page, '/');
  await page.getByRole('navigation', { name: 'Shop sections' }).getByRole('button', { name: /^Jazz/ }).tap();
  await page.getByRole('navigation', { name: 'Bins' }).getByRole('button').first().tap();
  const next = page.getByRole('button', { name: 'Next', exact: true });
  const box = (await next.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(44); // comfortable tap target
  for (let i = 0; i < 3; i++) await next.tap();
  await expect(page.getByRole('status')).toHaveText(/, 3 of 3$/);
  const title = (await page.getByRole('status').textContent())!.split(' by ')[0]!;
  await page.getByRole('button', { name: 'Show', exact: true }).tap();
  await page.getByRole('button', { name: 'Open album' }).tap();
  await expect(page.getByRole('dialog', { name: title })).toBeVisible();
});

test('rotating the phone mid-dig keeps your place and never scrolls sideways', async ({ page }) => {
  await open(page, '/?section=jazz&bin=0');
  await page.getByRole('button', { name: 'Next', exact: true }).tap();
  await page.getByRole('button', { name: 'Next', exact: true }).tap();
  await expect(page.getByRole('status')).toHaveText(/, 2 of 3$/);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(500);
  await expect(page.getByRole('status')).toHaveText(/, 2 of 3$/);
  expect(await noSidewaysScroll(page)).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('status')).toHaveText(/, 2 of 3$/);
});

test('a shown record is not buried under its title on a phone', async ({ page }) => {
  await open(page, '/?section=jazz&bin=0');
  await page.getByRole('button', { name: 'Next', exact: true }).tap();
  await page.getByRole('button', { name: 'Show', exact: true }).tap();
  const title = page.getByTestId('shown-title');
  await expect(title).toBeVisible();
  expect((await title.boundingBox())!.height).toBeLessThan(844 * 0.12);
  await expect(page.getByTestId('dig-caption')).toBeHidden(); // no duplicate title in the corner on small screens
});
