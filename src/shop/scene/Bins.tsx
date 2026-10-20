// The bins: walnut boxes (milk crates in Fresh Crates), every record as one instanced sleeve coloured by its cover,
// real artwork on each compartment's front sleeve, white A–Z divider cards, brass plaques and a spotlight per section.
import { Text, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { easeFactor } from '../dig.ts';
import { BASE_Y, BD, BW, SLEEVE, THICK, slot } from '../geometry.ts';
import type { Placed, Rect } from '../layout.ts';
import { initialOf } from '../sections.ts';
import { useMats, type Mats } from './Materials.tsx';

export const FONT = '/fonts/InterTight.ttf';
export const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const slotOf = (p: Placed, i: number) => slot(p.w, p.bin.records.length, i);

/** An open-topped box: bottom, low front, taller back and sides (walnut bins add a middle divider). */
export function BinBox({ w, kind }: { w: number; kind: keyof Mats }) {
  const material = useMats()[kind];
  const t = 0.06;
  const parts: [number, number, number, number, number, number][] = [
    [0, 0.06, 0, w, 0.12, BD], [0, 0.25, BD / 2 - t / 2, w, 0.5, t], [0, 0.35, -BD / 2 + t / 2, w, 0.7, t],
    [-w / 2 + t / 2, 0.3, 0, t, 0.6, BD], [w / 2 - t / 2, 0.3, 0, t, 0.6, BD],
  ];
  if (w === BW) parts.push([0, 0.3, 0, t, 0.6, BD]);
  return (
    <>
      {parts.map(([px, py, pz, sx, sy, sz], i) => (
        <mesh key={i} position={[px, py, pz]} material={material} castShadow receiveShadow><boxGeometry args={[sx, sy, sz]} /></mesh>
      ))}
    </>
  );
}

/** Every record not being dug, as one instanced mesh leaning back, coloured by its cover's dominant colour. */
export function Sleeves({ placed, skip }: { placed: Placed[]; skip: string | null }) {
  const spots = useMemo(() => placed.filter((p) => p.key !== skip).flatMap((p) => p.bin.records.map((r, i) => {
    const s = slotOf(p, i);
    return { x: p.x + s.x, z: p.z + s.z, lean: s.back, color: r.cover?.dominant ?? '#c9b48a' };
  })), [placed, skip]);
  const ref = useRef<THREE.InstancedMesh>(null!);
  const capacity = useMemo(() => placed.reduce((n, p) => n + p.bin.records.length, 0) || 1, [placed]);
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    spots.forEach((s, i) => {
      q.setFromEuler(new THREE.Euler(-s.lean, 0, 0));
      const up = new THREE.Vector3(0, SLEEVE / 2, 0).applyQuaternion(q);
      ref.current.setMatrixAt(i, m.compose(new THREE.Vector3(s.x + up.x, BASE_Y + up.y, s.z + up.z), q, one));
      ref.current.setColorAt(i, c.set(s.color));
    });
    ref.current.count = spots.length;
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh key={capacity} ref={ref} args={[undefined, undefined, capacity]} castShadow>
      <boxGeometry args={[SLEEVE, SLEEVE, THICK]} />
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}

function FrontCover({ p, i }: { p: Placed; i: number }) {
  const tex = useTexture(p.bin.records[i]!.cover!.grid);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = slotOf(p, i);
  const q = new THREE.Euler(-s.back, 0, 0);
  const c = new THREE.Vector3(0, SLEEVE / 2, THICK / 2 + 0.002).applyEuler(q);
  return (
    <mesh position={[p.x + s.x + c.x, BASE_Y + c.y, p.z + s.z + c.z]} rotation={q}>
      <planeGeometry args={[SLEEVE, SLEEVE]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  );
}

/** The front sleeve of each compartment shows its real cover (300 px). */
export function FrontCovers({ placed, skip }: { placed: Placed[]; skip: string | null }) {
  const fronts = placed.filter((p) => p.key !== skip).flatMap((p) => p.bin.records.map((r, i) => ({ p, i, r })))
    .filter(({ p, i, r }) => r.cover && slotOf(p, i).j === 0);
  return <>{fronts.map(({ p, i }) => <FrontCover key={`${p.key}:${i}`} p={p} i={i} />)}</>;
}

/** A white A–Z card every 8 sleeves, riding the sleeve tops at their lean. */
export function DividerTabs({ placed, skip }: { placed: Placed[]; skip: string | null }) {
  const tabs = useMemo(() => placed.filter((p) => p.key !== skip).flatMap((p) => p.bin.records.flatMap((r, i) => {
    const s = slotOf(p, i);
    if (s.j === 0 || s.j % 8) return [];
    const letter = initialOf(r.artist);
    return [{ key: `${p.key}:${i}`, x: p.x + s.x - 0.3, y: BASE_Y + 0.96 * Math.cos(s.back), z: p.z + s.z - 0.96 * Math.sin(s.back) + 0.008, rx: -s.back, letter }];
  })), [placed, skip]);
  return (
    <>
      {tabs.map((t) => (
        <group key={t.key} position={[t.x, t.y, t.z]} rotation={[t.rx, 0, 0]}>
          <mesh><boxGeometry args={[0.16, 0.12, 0.006]} /><meshStandardMaterial color="#efe7d6" roughness={0.8} /></mesh>
          <Text font={FONT} position={[0, 0, 0.004]} fontSize={0.08} color="#2a1f14" anchorX="center" anchorY="middle">{t.letter}</Text>
        </group>
      ))}
    </>
  );
}

export function BrassPlaque({ position, rotation = [0, 0, 0], label, width }: { position: [number, number, number]; rotation?: [number, number, number]; label: string; width: number }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[width, 0.2, 0.02]} /><meshStandardMaterial color="#c4a463" metalness={0.6} roughness={0.35} /></mesh>
      <Text font={FONT} position={[0, 0, 0.012]} fontSize={0.1} letterSpacing={0.2} color="#2a1f14" anchorX="center" anchorY="middle">{label.toUpperCase()}</Text>
    </group>
  );
}

/** A warm pool of light over a section; brighter when hovered or chosen. Asks for frames only while it fades. */
export function SectionLight({ rect, bright }: { rect: Rect; bright: boolean }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.SpotLight>(null!);
  useFrame(({ invalidate }, dt) => {
    const goal = bright ? 260 : 110;
    const l = ref.current;
    l.intensity += (goal - l.intensity) * easeFactor(dt, reducedMotion());
    if (Math.abs(goal - l.intensity) > 0.5) invalidate();
  });
  return (
    <>
      <primitive object={target} position={[rect.x, 0, rect.z]} />
      <spotLight ref={ref} position={[rect.x, 7, rect.z + 1.5]} target={target} angle={0.5} penumbra={0.8} decay={1.4} distance={16} intensity={110} color="#ffc27a" />
    </>
  );
}
