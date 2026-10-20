import { expect, test } from 'vitest';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import { digAim, sectionAim, storeAim, type Aim } from '../../src/shop/camera.ts';
import { BW } from '../../src/shop/geometry.ts';
import type { Placed, Room } from '../../src/shop/layout.ts';

const dist = (a: Aim) => Math.hypot(...a.position.map((v, i) => v - a.target[i]!));
const records = Array.from({ length: 48 }, (_, i): PublicAlbum => ({ id: `bandcamp:album:${i + 1}`, kind: 'album', bandcampId: i + 1, title: 't', artist: 'A', genre: 'jazz', cover: null, songCount: 1, durationSec: 1 }));
const p: Placed = { key: 'jazz:0', x: -5, z: 2, w: BW, bin: { section: 'jazz', index: 0, label: 'A', records } };
const room: Room = { width: 24, backZ: -8, frontZ: 10 };
const rect = { x: -5, z: 2, w: 7.2, d: 2.5 };
const PHONE = 390 / 844, LAPTOP = 1440 / 900;

test('a phone (portrait) frames from farther away than a laptop', () => {
  expect(dist(digAim(p, 3, false, PHONE))).toBeGreaterThan(dist(digAim(p, 3, false, LAPTOP)));
  expect(dist(storeAim(room, PHONE))).toBeGreaterThan(dist(storeAim(room, LAPTOP)));
  expect(dist(sectionAim(rect, PHONE))).toBeGreaterThan(dist(sectionAim(rect, LAPTOP)));
  expect(dist(digAim(p, 3, false, 0.1))).toBeCloseTo(dist(digAim(p, 3, false, LAPTOP)) * 2.2); // capped
});

test('showing a record moves the camera closer than digging', () => {
  expect(dist(digAim(p, 3, true, LAPTOP))).toBeLessThan(dist(digAim(p, 3, false, LAPTOP)));
});

test('the store aim looks at the middle of the room; every aim stays above the floor', () => {
  expect(storeAim(room, LAPTOP).target).toEqual([0, 0, 1]);
  for (const aim of [storeAim(room, PHONE), sectionAim(rect, PHONE), digAim(p, -1, false, PHONE), digAim(p, 5, false, LAPTOP), digAim(p, 5, true, PHONE)]) {
    expect(aim.position[1]).toBeGreaterThan(0.5);
  }
});

test('digging follows the current record', () => {
  expect(digAim(p, 10, false, LAPTOP).target[2]).toBeLessThan(digAim(p, 0, false, LAPTOP).target[2]); // deeper = further back
});
