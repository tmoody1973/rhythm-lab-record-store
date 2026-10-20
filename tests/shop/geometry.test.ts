import { expect, test } from 'vitest';
import { BACK_H, BASE_Y, BD, BW, CW, FRONT_H, LEAN, STEP, THICK, WALL, slot } from '../../src/shop/geometry.ts';

// Tarik saw a record that fell forward pass through the crate's front wall (2026-10-20).
test('no sleeve leans through a bin wall or into its neighbour', () => {
  const front = BD / 2 - WALL, back = -front;
  for (const [w, counts] of [[BW, [1, 4, 24, 36, 48]], [CW, [1, 10, 24]]] as const) {
    for (const n of counts) for (let i = 0; i < n; i++) {
      const s = slot(w, n, i);
      expect(BASE_Y + (front - s.z) / Math.tan(s.forward)).toBeGreaterThanOrEqual(FRONT_H - 1e-9);
      expect(BASE_Y + (s.z - back) / Math.tan(s.back)).toBeGreaterThanOrEqual(BACK_H - 1e-9);
    }
  }
  expect(STEP * Math.cos(LEAN)).toBeGreaterThan(THICK);
});
