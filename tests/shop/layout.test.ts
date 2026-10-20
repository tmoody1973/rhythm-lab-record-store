import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import type { Catalog, PublicAlbum } from '../../src/catalog/schema.ts';
import { layoutShop, type Placed } from '../../src/shop/layout.ts';
import { binsBySection, SECTIONS } from '../../src/shop/sections.ts';
import { BD } from '../../src/shop/geometry.ts';

const fixture: Catalog = JSON.parse(readFileSync('fixtures/catalog-sample.json', 'utf8'));
const GENRE: Record<string, string | null> = { electronic: 'electronic', 'soul-funk': 'r&b soul', 'hip-hop': 'hip hop rap', jazz: 'jazz', 'rock-pop-alt': 'alternative', global: 'world', 'left-field': 'experimental', fresh: null };
const TODAY: Record<string, number> = { electronic: 297, 'soul-funk': 228, 'hip-hop': 169, jazz: 148, 'rock-pop-alt': 132, global: 64, 'left-field': 59, fresh: 118 };
let n = 0;
const catalogOf = (counts: Record<string, number>, scale = 1): PublicAlbum[] => Object.entries(counts).flatMap(([s, c]) =>
  Array.from({ length: c * scale }, () => ({ id: `bandcamp:album:${++n}`, kind: 'album' as const, bandcampId: n, title: 't', artist: 'A', genre: GENRE[s]!, cover: null, songCount: 10, durationSec: 1 })));

const rect = (p: Placed) => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - BD / 2, z1: p.z + BD / 2 });
const overlap = (a: Placed, b: Placed) => { const [r, s] = [rect(a), rect(b)]; return r.x0 < s.x1 && s.x0 < r.x1 && r.z0 < s.z1 && s.z0 < r.z1; };
const cases = { fixture: fixture.albums, today: catalogOf(TODAY), double: catalogOf(TODAY, 2) };

for (const [name, albums] of Object.entries(cases)) {
  test(`${name}: no two bins overlap and every bin is inside the room`, () => {
    const { placed, room } = layoutShop(binsBySection(albums));
    for (let i = 0; i < placed.length; i++) for (let j = i + 1; j < placed.length; j++) expect(overlap(placed[i]!, placed[j]!), `${placed[i]!.key} vs ${placed[j]!.key}`).toBe(false);
    for (const p of placed) {
      const r = rect(p);
      expect(r.x0).toBeGreaterThan(-room.width / 2);
      expect(r.x1).toBeLessThan(room.width / 2);
      expect(r.z0).toBeGreaterThan(room.backZ);
      expect(r.z1).toBeLessThan(room.frontZ);
    }
  });
  test(`${name}: aisles keep a walkway of at least 1.6 between them`, () => {
    const { sections } = layoutShop(binsBySection(albums));
    const aisles = [0, 1, 2, 3].map((a) => SECTIONS.filter((s) => s.aisle === a).map((s) => sections.get(s.id)!).filter((r) => r.d > 0));
    for (let a = 1; a < 4; a++) {
      if (!aisles[a]!.length || !aisles[a - 1]!.length) continue;
      const prevFront = Math.max(...aisles[a - 1]!.map((r) => r.z + r.d / 2));
      const thisBack = Math.min(...aisles[a]!.map((r) => r.z - r.d / 2));
      expect(thisBack - prevFront).toBeGreaterThanOrEqual(1.6 - 1e-9);
    }
  });
}

test('the room grows when the catalog does, and is never shallower than 16', () => {
  const today = layoutShop(binsBySection(cases.today)).room;
  const double = layoutShop(binsBySection(cases.double)).room;
  expect(double.frontZ).toBeGreaterThan(today.frontZ);
  expect(layoutShop(binsBySection(cases.fixture)).room.frontZ - layoutShop(binsBySection(cases.fixture)).room.backZ).toBeGreaterThanOrEqual(16);
});
