// With on-demand rendering, R3F's frame delta is "time since the last drawn frame" — seconds, after an idle pause —
// so the first frame after Next would jump records and camera to the end (Tarik: "it glitches"). Cap it, so motion
// after a pause eases exactly as it does mid-animation.
import type * as THREE from 'three';

export const MAX_FRAME_STEP = 1 / 30;

export function steadyClock(clock: THREE.Clock): void {
  const raw = clock.getDelta.bind(clock);
  clock.getDelta = () => Math.min(raw(), MAX_FRAME_STEP);
}
