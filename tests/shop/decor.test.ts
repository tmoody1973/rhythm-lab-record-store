import { expect, test } from 'vitest';
import { DECOR_FILES, DecorManifestSchema, decorUrls } from '../../src/shop/decor.ts';

const full = { version: 1 as const, files: [...DECOR_FILES] };

test('no manifest (decor not fetched) → flat-colour fallback', () => {
  expect(decorUrls(null)).toBeNull();
});
test('a manifest missing any file → fallback, never a half-dressed room', () => {
  expect(decorUrls({ version: 1, files: DECOR_FILES.slice(1) })).toBeNull();
});
test('a complete manifest gives /decor/ URLs for every surface and plant', () => {
  const u = decorUrls(full)!;
  expect(u.brick.map).toBe('/decor/brick_wall_02_diff.webp');
  expect(u.floor.normal).toBe('/decor/dark_wooden_planks_nor.webp');
  expect(u.walnut.map).toBe('/decor/black_walnut_veneer_01_diff.webp');
  expect(u.plants).toEqual({ lush: '/decor/potted_plant_02.glb', small: '/decor/potted_plant_04.glb' });
});
test('the manifest schema rejects other versions and junk', () => {
  expect(DecorManifestSchema.safeParse({ version: 2, files: [] }).success).toBe(false);
  expect(DecorManifestSchema.safeParse({ version: 1, files: [3] }).success).toBe(false);
});
