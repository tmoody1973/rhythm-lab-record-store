// Where sleeves stand in a bin and how far they may lean, so nothing passes through the wood.
// Same idea as risq/cratedigger's crate: the front record sits just far enough from the front wall that, fallen
// forward, it rests on the wall's top edge; there's room behind for the rest to lean back.
export const BW = 2.2, BD = 1.15, GAP = 0.2, CW = 1.1;
export const SLEEVE = 0.9, THICK = 0.012, BASE_Y = 0.12, WALL = 0.06;
export const FRONT_H = 0.5, BACK_H = 0.7; // tops of the front and back panels
export const LEAN = Math.PI / 7; // cratedigger's push/pull angle
export const STEP = 0.02; // sleeve spacing: packed like a real bin
const FRONT_GAP = 0.2;

export type Slot = { comp: number; j: number; x: number; z: number; forward: number; back: number };

/** Record i of a bin of width w holding `count` records: walnut bins have two compartments of 24, crates one. */
export function slot(w: number, count: number, i: number, perComp = 24): Slot {
  const twoUp = w === BW;
  const comp = twoUp ? Math.floor(i / perComp) : 0;
  const j = twoUp ? i % perComp : i;
  const n = twoUp ? Math.min(perComp, count - comp * perComp) : count;
  const front = BD / 2 - WALL, back = -front;
  const z0 = front - FRONT_GAP;
  const zLast = z0 - (n - 1) * STEP;
  return {
    comp, j, x: twoUp ? (comp === 0 ? -0.53 : 0.53) : 0, z: z0 - j * STEP,
    // The steepest lean before a sleeve's face meets the top of the wall it falls toward.
    forward: Math.min(LEAN, Math.atan((front - z0) / (FRONT_H - BASE_Y))),
    back: Math.min(LEAN, Math.atan((zLast - back) / (BACK_H - BASE_Y))),
  };
}
