import { expect, test } from 'vitest';
import { MAX_FRAME_STEP, ONE_FRAME, steadyDelta } from '../../src/shop/scene/steadyClock.ts';

test('the first frame after the loop went idle is one normal frame, so nothing jumps after a pause', () => {
  expect(steadyDelta(5.94, true)).toBe(ONE_FRAME);
});
test('while the loop keeps running, slow frames keep their real step (slow devices keep up), capped against hiccups', () => {
  expect(steadyDelta(0.6, false)).toBe(MAX_FRAME_STEP); // a slow machine mid-motion is not mistaken for a pause
  expect(steadyDelta(0.05, false)).toBe(0.05);
  expect(steadyDelta(1 / 60, false)).toBe(1 / 60);
});
