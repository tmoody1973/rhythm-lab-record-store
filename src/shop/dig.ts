// Digging, decided without a GPU: which way each sleeve leans, how the index moves, how fast things settle.
// The poses are risq/cratedigger's (MIT): passed records fall forward, the current one rises, the rest lean back.
import { slot } from './geometry.ts';
import type { Placed } from './layout.ts';

export type Pose = 'back' | 'forward' | 'up' | 'shown';

export function poseOf(p: Placed, i: number, sel: number, shown: boolean): Pose {
  if (i === sel) return shown ? 'shown' : 'up';
  if (sel < 0) return 'back';
  const n = p.bin.records.length;
  const [s, c] = [slot(p.w, n, i), slot(p.w, n, sel)];
  return s.comp === c.comp && s.j < c.j ? 'forward' : 'back';
}

/** Move the current record by delta, staying inside the bin; the first step from nothing lands on the front record. */
export function stepSel(sel: number, delta: number, count: number): number {
  if (count <= 0) return -1;
  if (sel < 0) return 0;
  return Math.max(0, Math.min(count - 1, sel + delta));
}

/** Share of the remaining distance to cover this frame (exponential settle ≈ cratedigger's 1 s ease-out); 1 snaps. */
export function easeFactor(dt: number, reduced: boolean, lambda = 6): number {
  return reduced ? 1 : 1 - Math.exp(-lambda * dt);
}
