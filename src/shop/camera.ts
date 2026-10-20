// Where the camera looks at each level, decided without a GPU. Landscape values are the spike's; on a tall phone
// screen the camera backs away along the same line so the same things stay in frame.
import { slot } from './geometry.ts';
import type { Placed, Rect, Room } from './layout.ts';

type V3 = [number, number, number];
export type Aim = { position: V3; target: V3 };

const MAX_PORTRAIT_PULLBACK = 2.2;

function framed(position: V3, target: V3, aspect: number): Aim {
  const k = aspect < 1 ? Math.min(MAX_PORTRAIT_PULLBACK, 1 / aspect) : 1;
  return { target, position: position.map((v, i) => target[i]! + (v - target[i]!) * k) as V3 };
}

/** The whole shop from a high three-quarter view; backs off further for deeper rooms. */
export function storeAim(room: Room, aspect: number): Aim {
  const cz = (room.backZ + room.frontZ) / 2;
  const s = Math.max(1, (room.frontZ - room.backZ) / 16);
  return framed([17 * s, 15 * s, cz + 21 * s], [0, 0, cz], aspect);
}

export function sectionAim(r: Rect, aspect: number): Aim {
  return framed([r.x + 2.5, 5.5, r.z + r.d / 2 + 6.5], [r.x, 0.4, r.z], aspect);
}

/** Low and close over a bin; then following the current record (cratedigger's camera); closer still when shown. */
export function digAim(p: Placed, sel: number, shown: boolean, aspect: number): Aim {
  if (sel < 0) return framed([p.x + 1.2, 2.1, p.z + 2.8], [p.x, 0.35, p.z], aspect);
  const s = slot(p.w, p.bin.records.length, sel);
  const [rx, rz] = [p.x + s.x, p.z + s.z];
  return shown
    ? framed([rx + 0.6, 1.55, rz + 2.6], [rx, 1.35, rz + 0.1], aspect)
    : framed([rx + 1, 1.95, rz + 2.1], [rx, 0.6, rz], aspect);
}

const dist = (a: Aim) => Math.hypot(...a.position.map((v, i) => v - a.target[i]!));

/** Fog that starts past what the camera is aimed at, so a phone's pulled-back view isn't swallowed. */
export function fogFor(aim: Aim): [number, number] {
  const d = dist(aim);
  return [d + 10, d + 45];
}

/** Zoom limits for orbiting: the store keeps you out of the floor; both always include where the camera was put. */
export function orbitLimits(aim: Aim, level: 'store' | 'section'): { minDistance: number; maxDistance: number } {
  return { minDistance: level === 'store' ? 10 : 3, maxDistance: Math.max(42, dist(aim) + 2) };
}
