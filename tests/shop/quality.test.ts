import { expect, test } from 'vitest';
import { qualityFor } from '../../src/shop/quality.ts';

test('phones and low-memory devices get the light tier; laptops the full one', () => {
  expect(qualityFor(390).tier).toBe('light');
  expect(qualityFor(1440).tier).toBe('full');
  expect(qualityFor(1440, 4).tier).toBe('light');
  expect(qualityFor(1440, 8).tier).toBe('full');
  expect(qualityFor(390)).toEqual({ tier: 'light', dpr: [1, 1.5], shadowMapSize: 1024, lushPlants: false, plantCount: 4 });
  expect(qualityFor(1440)).toEqual({ tier: 'full', dpr: [1, 2], shadowMapSize: 2048, lushPlants: true, plantCount: 8 });
});
