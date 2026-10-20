// With on-demand rendering, R3F's frame delta is "time since the last drawn frame": seconds, after the scene sat idle.
// Handed straight to the animation, the first frame after Next would jump records and camera to the end (Tarik: "it
// glitches"). So the first frame after the loop went idle counts as one normal frame; while the loop keeps running the
// real delta is used (capped against hiccups), so a slow device keeps up instead of crawling. Idle is R3F's own signal
// (addTail fires when the loop stops), not a timing guess: under load a single frame can take over half a second.
import { addTail, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import type * as THREE from 'three';

export const ONE_FRAME = 1 / 60;
export const MAX_FRAME_STEP = 0.1;

export function steadyDelta(raw: number, afterIdle: boolean): number {
  return afterIdle ? ONE_FRAME : Math.min(raw, MAX_FRAME_STEP);
}

function steadyClock(clock: THREE.Clock): () => void {
  const raw = clock.getDelta;
  let idle = true;
  const stop = addTail(() => { idle = true; });
  clock.getDelta = function () { const d = steadyDelta(raw.call(this), idle); idle = false; return d; };
  return () => { stop(); clock.getDelta = raw; };
}

/** Mount inside a demand-rendered <Canvas>. */
export function SteadyClock() {
  const clock = useThree((s) => s.clock);
  useEffect(() => steadyClock(clock), [clock]);
  return null;
}
