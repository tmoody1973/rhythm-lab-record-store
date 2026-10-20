// Where every section and bin stands. Sections keep their floor width; their depth grows with their bin count,
// aisles stack from the back wall forward with a walkway between, and the room deepens to fit — so new purchases
// never make bins collide (spec: "Room layout").
import { BD, BW, CW, GAP } from './geometry.ts';
import { SECTIONS, type Bin, type SectionId } from './sections.ts';

export type Placed = { key: string; bin: Bin; x: number; z: number; w: number };
export type Rect = { x: number; z: number; w: number; d: number };
export type Room = { width: 24; backZ: -8; frontZ: number };

const BACK_Z = -8, START = 1, WALKWAY = 1.6, FRONT_SPACE = 2.6, MIN_DEPTH = 16;

export function layoutShop(bins: Map<SectionId, Bin[]>): { room: Room; placed: Placed[]; sections: Map<SectionId, Rect> } {
  const placed: Placed[] = [];
  const sections = new Map<SectionId, Rect>();
  let back = BACK_Z + START;
  let lastFront = back;
  for (const aisle of [0, 1, 2, 3] as const) {
    const dims = SECTIONS.filter((s) => s.aisle === aisle).map((s) => {
      const list = bins.get(s.id) ?? [];
      const w = s.crates ? CW : BW;
      const cols = Math.max(1, Math.floor((s.width + GAP) / (w + GAP)));
      const rows = Math.ceil(list.length / cols);
      return { s, list, w, cols, rows, d: rows ? rows * (BD + GAP) - GAP : 0 };
    });
    const depth = Math.max(0, ...dims.map((d) => d.d));
    for (const { s, list, w, cols, d } of dims) {
      const zc = back + depth / 2;
      sections.set(s.id, { x: s.x, z: zc, w: s.width, d });
      list.forEach((bin, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = Math.min(cols, list.length - row * cols);
        placed.push({ key: `${s.id}:${bin.index}`, bin, w, x: s.x - ((inRow - 1) * (w + GAP)) / 2 + col * (w + GAP), z: zc - d / 2 + BD / 2 + row * (BD + GAP) });
      });
    }
    if (depth > 0) { lastFront = back + depth; back = lastFront + WALKWAY; }
  }
  return { room: { width: 24, backZ: BACK_Z, frontZ: Math.max(BACK_Z + MIN_DEPTH, lastFront + FRONT_SPACE) }, placed, sections };
}
