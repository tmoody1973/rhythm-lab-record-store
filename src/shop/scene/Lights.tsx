// Room light: warm ambient and sky, one shadow-casting key light. Dims while a record is shown, like cratedigger.
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type * as THREE from 'three';
import { easeFactor } from '../dig.ts';
import type { Quality } from '../quality.ts';
import { reducedMotion } from './Bins.tsx';

export function RoomLights({ dim, quality }: { dim: boolean; quality: Quality }) {
  const amb = useRef<THREE.AmbientLight>(null!), hemi = useRef<THREE.HemisphereLight>(null!), sun = useRef<THREE.DirectionalLight>(null!);
  useFrame(({ invalidate }, dt) => {
    const f = dim ? 0.3 : 1, k = easeFactor(dt, reducedMotion(), 5);
    amb.current.intensity += (0.8 * f - amb.current.intensity) * k;
    hemi.current.intensity += (0.8 * f - hemi.current.intensity) * k;
    sun.current.intensity += (1.6 * f - sun.current.intensity) * k;
    if (Math.abs(1.6 * f - sun.current.intensity) > 0.01) invalidate();
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.8} color="#ffd9b0" />
      <hemisphereLight ref={hemi} args={['#ffcc99', '#1a100a', 0.8]} />
      <directionalLight ref={sun} position={[14, 22, 10]} intensity={1.6} color="#ffd2a0" castShadow shadow-mapSize={[quality.shadowMapSize, quality.shadowMapSize]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
    </>
  );
}
