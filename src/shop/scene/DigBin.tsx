// The bin being dug. Each sleeve pivots on its bottom edge and eases to its pose: passed records fall forward, the
// current one rises, the rest lean back; a shown record lifts and turns to face you; the bin sways toward the mouse.
// Motion ported from cratedigger.js (https://github.com/risq/cratedigger), MIT licence:
//   Copyright (c) 2015 Oz Conseil
//   Copyright (c) 2014 Daniel Tello
import { useTexture } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { PublicAlbum } from '../../catalog/schema.ts';
import { easeFactor, poseOf, type Pose } from '../dig.ts';
import { BASE_Y, SLEEVE, THICK, slot } from '../geometry.ts';
import type { Placed } from '../layout.ts';
import { BinBox, reducedMotion } from './Bins.tsx';

// One edge material for every sleeve; each sleeve's face material is disposed with it.
const EDGE = new THREE.MeshStandardMaterial({ color: '#140b05', roughness: 0.7 });
const UP = 0.18, SHOWN_Y = 0.95;
const settled = (a: number, b: number) => Math.abs(a - b) < 0.001;

type Props = { p: Placed; sel: number; shown: boolean; mouse: RefObject<{ x: number; y: number }>; onPick: (i: number) => void; textured: boolean };

function DigRecord({ record, map, x, z, lean, pose, onPick }: {
  record: PublicAlbum; map?: THREE.Texture; x: number; z: number; lean: { forward: number; back: number }; pose: Pose; onPick: () => void;
}) {
  const ref = useRef<THREE.Group>(null!);
  const face = useMemo(() => (map ? new THREE.MeshStandardMaterial({ map, roughness: 0.5 }) : new THREE.MeshStandardMaterial({ color: record.cover?.dominant ?? '#c9b48a' })), [map, record]);
  useEffect(() => () => face.dispose(), [face]);
  const mats = useMemo(() => [EDGE, EDGE, EDGE, EDGE, face, EDGE], [face]);
  useFrame(({ camera, invalidate }, dt) => {
    const g = ref.current, k = easeFactor(dt, reducedMotion());
    const y = pose === 'shown' ? SHOWN_Y : pose === 'up' ? BASE_Y + UP : BASE_Y;
    const rx = pose === 'back' ? -lean.back : pose === 'forward' ? lean.forward : 0;
    const world = g.getWorldPosition(new THREE.Vector3());
    const ry = pose === 'shown' ? Math.atan2(camera.position.x - world.x, camera.position.z - world.z) - (g.parent?.rotation.y ?? 0) : 0;
    g.position.y += (y - g.position.y) * k;
    g.rotation.x += (rx - g.rotation.x) * k;
    g.rotation.y += (ry - g.rotation.y) * k;
    if (!settled(g.position.y, y) || !settled(g.rotation.x, rx) || !settled(g.rotation.y, ry)) invalidate();
  });
  return (
    <group ref={ref} position={[x, BASE_Y, z]} rotation={[-lean.back, 0, 0]}>
      <mesh name={record.id} position={[0, SLEEVE / 2, 0]} material={mats} castShadow onClick={(e) => { if (e.delta > 6) return; e.stopPropagation(); onPick(); }}>
        <boxGeometry args={[SLEEVE, SLEEVE, THICK]} />
      </mesh>
    </group>
  );
}

function Bin({ p, sel, shown, mouse, onPick, maps }: Omit<Props, 'textured'> & { maps: (THREE.Texture | undefined)[] }) {
  const ref = useRef<THREE.Group>(null!);
  // On-demand rendering only draws when asked: moving the mouse must ask, or the sway never shows.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const on = () => invalidate();
    window.addEventListener('pointermove', on);
    return () => window.removeEventListener('pointermove', on);
  }, [invalidate]);
  useFrame(({ invalidate }, dt) => {
    // cratedigger sways the crate toward the mouse so it never feels frozen.
    const g = ref.current, k = easeFactor(dt, reducedMotion(), 3);
    const [ty, tx] = [(mouse.current!.x - 0.5) * 0.18, (mouse.current!.y - 0.5) * 0.06];
    g.rotation.y += (ty - g.rotation.y) * k;
    g.rotation.x += (tx - g.rotation.x) * k;
    if (!settled(g.rotation.y, ty) || !settled(g.rotation.x, tx)) invalidate();
  });
  const n = p.bin.records.length;
  return (
    <group ref={ref} position={[p.x, 0, p.z]}>
      <BinBox w={p.w} kind="walnut" />
      {p.bin.records.map((r, i) => {
        const s = slot(p.w, n, i);
        return <DigRecord key={r.id} record={r} map={maps[i]} x={s.x} z={s.z} lean={s} pose={poseOf(p, i, sel, shown)} onPick={() => onPick(i)} />;
      })}
    </group>
  );
}

function Textured(props: Omit<Props, 'textured'>) {
  const urls = props.p.bin.records.map((r) => r.cover?.grid).filter((u): u is string => !!u);
  const loaded = useTexture(urls) as THREE.Texture[];
  const byUrl = new Map(urls.map((u, i) => [u, loaded[i]!]));
  loaded.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; });
  // Leaving the bin frees its 48 covers from the GPU and the loader cache (phones run out of WebGL memory).
  useEffect(() => () => { loaded.forEach((t) => t.dispose()); useTexture.clear(urls); }, [loaded]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Bin {...props} maps={props.p.bin.records.map((r) => (r.cover ? byUrl.get(r.cover.grid) : undefined))} />;
}

/** Artwork loads only for this bin; until it arrives, sleeves show their cover's colour. */
export function DigBin({ textured, ...props }: Props) {
  const plain = <Bin {...props} maps={[]} />;
  return textured ? <Suspense fallback={plain}><Textured key={props.p.key} {...props} /></Suspense> : plain;
}
