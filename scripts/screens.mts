// Visual self-check: screenshot pages at desktop and phone width for comparison with docs/design/*.png.
// Usage: node scripts/screens.mts [path ...]   (dev server must be running on :5317)
import { chromium } from '@playwright/test';

const paths = process.argv.slice(2).length ? process.argv.slice(2) : ['/'];
const browser = await chromium.launch();
for (const [label, viewport] of [['desktop', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  const page = await browser.newPage({ viewport });
  for (const p of paths) {
    await page.goto(`http://localhost:5317${p}`, { waitUntil: 'networkidle' });
    const file = `test-results/screens/${label}-${p.replace(/[^a-z0-9]+/gi, '_') || 'root'}.png`;
    await page.screenshot({ path: file, fullPage: false });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    process.stdout.write(`${file}${overflow ? '  (HORIZONTAL OVERFLOW)' : ''}\n`);
  }
  await page.close();
}
await browser.close();
