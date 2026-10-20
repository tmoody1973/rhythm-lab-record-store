// The camera: drei CameraControls for orbiting (limits keep it above the floor and inside the street), and one eased
// move whenever the aim changes — the way cratedigger's camera follows the record you're on.
import { CameraControls } from '@react-three/drei';
import { useEffect, useRef } from 'react';
import type { Aim } from '../camera.ts';
import { reducedMotion } from './Bins.tsx';

export function CameraRig({ aim, interactive, minDistance }: { aim: Aim; interactive: boolean; minDistance: number }) {
  const ref = useRef<CameraControls>(null);
  const key = JSON.stringify(aim);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.smoothTime = reducedMotion() ? 0 : 0.35;
    void c.setLookAt(...aim.position, ...aim.target, true);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <CameraControls ref={ref} makeDefault enabled={interactive} minPolarAngle={0.2} maxPolarAngle={1.32} minDistance={minDistance} maxDistance={42} />;
}
