import { expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { easeFactor, poseOf, stepSel } from '../../src/shop/dig.ts';
import { BW } from '../../src/shop/geometry.ts';
import type { Placed } from '../../src/shop/layout.ts';

const records = Array.from({ length: 48 }, (_, i): PublicAlbum => ({
  id: `bandcamp:album:${i + 1}`, kind: 'album', bandcampId: i + 1, title: `T${i}`, artist: 'A', genre: 'jazz', cover: null, songCount: 10, durationSec: 1,
}));
const bin48: Placed = { key: 'jazz:0', x: 0, z: 0, w: BW, bin: { section: 'jazz', index: 0, label: 'A', records } };

test('passed records fall forward, the current one is up (or shown), the rest lean back — same compartment only', () => {
  expect(poseOf(bin48, 3, 5, false)).toBe('forward');
  expect(poseOf(bin48, 5, 5, false)).toBe('up');
  expect(poseOf(bin48, 5, 5, true)).toBe('shown');
  expect(poseOf(bin48, 6, 5, false)).toBe('back');
  expect(poseOf(bin48, 30, 5, false)).toBe('back'); // the other compartment
  expect(poseOf(bin48, 24, 30, false)).toBe('forward'); // second compartment, passed
  expect(poseOf(bin48, 3, 30, false)).toBe('back'); // first compartment while digging the second
  expect(poseOf(bin48, 0, -1, false)).toBe('back'); // nothing selected yet
});

test('rapid stepping never leaves the bin', () => {
  let s = -1;
  for (let k = 0; k < 500; k++) s = stepSel(s, 1, 48);
  expect(s).toBe(47);
  for (let k = 0; k < 500; k++) s = stepSel(s, -1, 48);
  expect(s).toBe(0);
  expect(stepSel(-1, 1, 0)).toBe(-1); // empty bin
  expect(stepSel(-1, -1, 48)).toBe(0); // first step from nothing lands on the front record
});

test('reduced motion snaps; otherwise eases', () => {
  expect(easeFactor(0.016, true)).toBe(1);
  expect(easeFactor(0.016, false)).toBeCloseTo(1 - Math.exp(-6 * 0.016));
  expect(easeFactor(0.016, false, 10)).toBeCloseTo(1 - Math.exp(-10 * 0.016));
});
