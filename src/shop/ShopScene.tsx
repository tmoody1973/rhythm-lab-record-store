// SPIKE v2 (throwaway, 2026-10-20): the record shop as the whole page. Perspective camera you can orbit like a
// dollhouse (walls between you and the room fade), eight sections, and digging *inside* the 3D bin with the motion
// ported from risq/cratedigger (MIT, © Valentin Ledrapier): passed records fall forward, the current one rises,
// the rest lean back, all on their bottom edges, eased out; the camera follows; the bin sways with the mouse.
// Look: the gpt-image-2 mockup (scratchpad shop-hybrid-v1.png). Not tested; not for merge as-is.
import { CameraControls, Text, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { PublicAlbum } from '../catalog/schema.ts';
import { BASE_Y, BD, BW, CW, GAP, SLEEVE, THICK, slot as slotOf } from './geometry.ts';
import { binsBySection, SECTIONS, type Bin, type Section } from './sections.ts';

const slot = (p: Placed, i: number) => slotOf(p.w, p.bin.records.length, i);

const WALNUT = '#4a2c18', WALNUT_DARK = '#2b190d', BRICK = '#6b2e22', FLOOR = '#2e1d12', SLEEVE_EDGE = '#140b05';
const reduced = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const LAMBDA = () => (reduced() ? 60 : 6); // ≈ cratedigger's 1s Quartic.Out settle

type Placed = { bin: Bin; x: number; z: number; w: number; key: string };
type View =
  | { level: 'store' }
  | { level: 'section'; section: string }
  | { level: 'dig'; section: string; bin: string; sel: number; shown: boolean };

function place(s: Section, bins: Bin[]): Placed[] {
  const w = s.crates ? CW : BW;
  const cols = Math.max(1, Math.floor((s.w + GAP) / (w + GAP)));
  const rows = Math.ceil(bins.length / cols);
  return bins.map((bin, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = Math.min(cols, bins.length - row * cols);
    return { bin, w, key: `${s.id}:${bin.index}`, x: s.x - ((inRow - 1) * (w + GAP)) / 2 + col * (w + GAP), z: s.z - ((rows - 1) * (BD + GAP)) / 2 + row * (BD + GAP) };
  });
}

function BinBox({ w, color }: { w: number; color: string }) {
  const t = 0.06;
  const parts: [number, number, number, number, number, number][] = [
    [0, 0.06, 0, w, 0.12, BD], [0, 0.25, BD / 2 - t / 2, w, 0.5, t], [0, 0.35, -BD / 2 + t / 2, w, 0.7, t],
    [-w / 2 + t / 2, 0.3, 0, t, 0.6, BD], [w / 2 - t / 2, 0.3, 0, t, 0.6, BD],
  ];
  if (w === BW) parts.push([0, 0.3, 0, t, 0.6, BD]);
  return (
    <>
      {parts.map(([px, py, pz, sx, sy, sz], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      ))}
    </>
  );
}

/** Every record not being dug, as one instanced mesh leaning back, coloured by its cover. */
function Sleeves({ placed, skip }: { placed: Placed[]; skip: string | null }) {
  const spots = useMemo(() => placed.filter((p) => p.key !== skip).flatMap((p) => p.bin.records.map((r, i) => {
    const s = slot(p, i);
    return { x: p.x + s.x, z: p.z + s.z, lean: s.back, color: r.cover?.dominant ?? '#c9b48a' };
  })), [placed, skip]);
  const ref = useRef<THREE.InstancedMesh>(null!);
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
    <instancedMesh ref={ref} args={[undefined, undefined, 1300]} castShadow>
      <boxGeometry args={[SLEEVE, SLEEVE, THICK]} />
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}

/** One record in the bin being dug: pivots on its bottom edge and eases between lean-back, fall-forward, up and shown. */
function DigRecord({ record, map, x, z, lean, pose, onClick }: {
  record: PublicAlbum; map?: THREE.Texture; x: number; z: number; lean: { forward: number; back: number };
  pose: 'back' | 'forward' | 'up' | 'shown'; onClick: (e: ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<THREE.Group>(null!);
  const { camera } = useThree();
  const mats = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: SLEEVE_EDGE, roughness: 0.7 });
    const face = map ? new THREE.MeshStandardMaterial({ map, roughness: 0.5 }) : new THREE.MeshStandardMaterial({ color: record.cover?.dominant ?? '#c9b48a' });
    return [edge, edge, edge, edge, face, edge];
  }, [map, record]);
  useFrame((_, dt) => {
    const g = ref.current, k = LAMBDA();
    const y = pose === 'shown' ? 0.95 : pose === 'up' ? BASE_Y + 0.18 : BASE_Y;
    const rx = pose === 'back' ? -lean.back : pose === 'forward' ? lean.forward : 0;
    // Shown: turn to face the camera, like cratedigger's flip toward you.
    const world = g.getWorldPosition(new THREE.Vector3());
    const ry = pose === 'shown' ? Math.atan2(camera.position.x - world.x, camera.position.z - world.z) - (g.parent?.rotation.y ?? 0) : 0;
    g.position.y = THREE.MathUtils.damp(g.position.y, y, k, dt);
    g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rx, k, dt);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, ry, k, dt);
  });
  return (
    <group ref={ref} position={[x, BASE_Y, z]} rotation={[-lean.back, 0, 0]}>
      <mesh position={[0, SLEEVE / 2, 0]} material={mats} castShadow onClick={onClick}>
        <boxGeometry args={[SLEEVE, SLEEVE, THICK]} />
      </mesh>
    </group>
  );
}

function DigBin({ p, sel, shown, maps, mouse, onPick }: {
  p: Placed; sel: number; shown: boolean; maps: (THREE.Texture | undefined)[];
  mouse: React.RefObject<{ x: number; y: number }>; onPick: (i: number, e: ThreeEvent<MouseEvent>) => void;
}) {
  const ref = useRef<THREE.Group>(null!);
  useFrame((_, dt) => {
    // cratedigger sways the crate toward the mouse so it never feels frozen.
    ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, (mouse.current.x - 0.5) * 0.18, 3, dt);
    ref.current.rotation.x = THREE.MathUtils.damp(ref.current.rotation.x, (mouse.current.y - 0.5) * 0.06, 3, dt);
  });
  const selSlot = sel >= 0 ? slot(p, sel) : null;
  return (
    <group ref={ref} position={[p.x, 0, p.z]}>
      <BinBox w={p.w} color={WALNUT} />
      {p.bin.records.map((r, i) => {
        const s = slot(p, i);
        const pose = i === sel ? (shown ? 'shown' : 'up') : selSlot && s.comp === selSlot.comp && s.j < selSlot.j ? 'forward' : 'back';
        return <DigRecord key={r.id} record={r} map={maps[i]} x={s.x} z={s.z} lean={s} pose={pose} onClick={(e) => onPick(i, e)} />;
      })}
    </group>
  );
}

function TexturedDigBin(props: Omit<Parameters<typeof DigBin>[0], 'maps'>) {
  const urls = props.p.bin.records.map((r) => r.cover?.grid).filter((u): u is string => !!u);
  const loaded = useTexture(urls);
  const byUrl = new Map(urls.map((u, i) => [u, loaded[i]!]));
  loaded.forEach((t) => { t.colorSpace = THREE.SRGBColorSpace; });
  return <DigBin {...props} maps={props.p.bin.records.map((r) => (r.cover ? byUrl.get(r.cover.grid) : undefined))} />;
}

function FrontCover({ p, i }: { p: Placed; i: number }) {
  const r = p.bin.records[i]!;
  const tex = useTexture(r.cover!.grid);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = slot(p, i);
  const q = new THREE.Euler(-s.back, 0, 0);
  const c = new THREE.Vector3(0, SLEEVE / 2, THICK / 2 + 0.002).applyEuler(q);
  return (
    <mesh position={[p.x + s.x + c.x, BASE_Y + c.y, p.z + s.z + c.z]} rotation={q}>
      <planeGeometry args={[SLEEVE, SLEEVE]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  );
}

/** A wall that fades out while the camera is on its outside, so the room always reads like an open dollhouse. */
function Wall({ position, size, normal, color, children }: { position: [number, number, number]; size: [number, number, number]; normal: [number, number, number]; color: string; children?: ReactNode }) {
  const mat = useRef<THREE.MeshStandardMaterial>(null!);
  const kids = useRef<THREE.Group>(null!);
  const n = useMemo(() => new THREE.Vector3(...normal), [normal]);
  const p = useMemo(() => new THREE.Vector3(...position), [position]);
  useFrame(({ camera }, dt) => {
    const outside = camera.position.clone().sub(p).dot(n) > 0;
    const o = THREE.MathUtils.damp(mat.current.opacity, outside ? 0 : 1, 8, dt);
    mat.current.opacity = o;
    mat.current.transparent = o < 0.99;
    mat.current.depthWrite = o > 0.5;
    kids.current.visible = o > 0.5;
  });
  return (
    <group position={position}>
      <mesh receiveShadow><boxGeometry args={size} /><meshStandardMaterial ref={mat} color={color} roughness={0.95} /></mesh>
      <group ref={kids}>{children}</group>
    </group>
  );
}

function WallCover({ record, y, z }: { record: PublicAlbum; y: number; z: number }) {
  const tex = useTexture(record.cover!.grid);
  tex.colorSpace = THREE.SRGBColorSpace;
  return <mesh position={[0.12, y, z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[0.9, 0.9]} /><meshStandardMaterial map={tex} roughness={0.5} /></mesh>;
}

function BrassPlaque({ position, rotation = [0, 0, 0], label, width }: { position: [number, number, number]; rotation?: [number, number, number]; label: string; width: number }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow><boxGeometry args={[width, 0.2, 0.02]} /><meshStandardMaterial color="#c4a463" metalness={0.6} roughness={0.35} /></mesh>
      <Text position={[0, 0, 0.012]} fontSize={0.1} letterSpacing={0.2} color="#2a1f14" anchorX="center" anchorY="middle">{label.toUpperCase()}</Text>
    </group>
  );
}

function Room({ wall }: { wall: PublicAlbum[] }) {
  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow><boxGeometry args={[24, 0.3, 16]} /><meshStandardMaterial color={FLOOR} roughness={0.85} /></mesh>
      <Wall position={[0, 1.8, -8.1]} size={[24.4, 3.6, 0.2]} normal={[0, 0, -1]} color={BRICK}>
        <Text position={[-1.5, 1.05, 0.12]} fontSize={0.85} letterSpacing={0.08} anchorX="center">
          RHYTHM LAB
          <meshBasicMaterial color={[3.2, 1.2, 0.5]} toneMapped={false} />
        </Text>
        <pointLight position={[-1.5, 0.9, 1.2]} color="#ff7a3c" intensity={14} distance={8} decay={1.6} />
      </Wall>
      <Wall position={[-12.1, 1.8, 0]} size={[0.2, 3.6, 16.4]} normal={[-1, 0, 0]} color="#2c3a31">
        <Suspense fallback={null}>
          {wall.map((r, i) => <WallCover key={r.id} record={r} y={-0.9 + Math.floor(i / 4) * 1.05} z={-2.4 + (i % 4) * 1.6} />)}
        </Suspense>
        <BrassPlaque position={[0.13, 1.45, 0] } rotation={[0, Math.PI / 2, 0]} label="Staff picks" width={1.6} />
      </Wall>
      <Wall position={[0, 1.8, 8.1]} size={[24.4, 3.6, 0.2]} normal={[0, 0, 1]} color="#3a2a20" />
      <Wall position={[12.1, 1.8, 0]} size={[0.2, 3.6, 16.4]} normal={[1, 0, 0]} color="#3a2a20" />
      {/* Listening station, back right */}
      <mesh position={[9.8, 0.55, -6.6]} castShadow receiveShadow><boxGeometry args={[3.4, 1.1, 1.3]} /><meshStandardMaterial color={WALNUT} /></mesh>
      {[9, 10.6].map((x) => (
        <mesh key={x} position={[x, 1.15, -6.6]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.08, 32]} /><meshStandardMaterial color="#151515" roughness={0.3} /></mesh>
      ))}
      <BrassPlaque position={[9.8, 0.75, -5.94]} label="Listening station" width={2} />
      {/* Counter by the door */}
      <mesh position={[10.4, 0.55, 3]} castShadow receiveShadow><boxGeometry args={[1.4, 1.1, 3]} /><meshStandardMaterial color={WALNUT} /></mesh>
      <mesh position={[10.4, 1.3, 2.4]} castShadow><boxGeometry args={[0.6, 0.4, 0.5]} /><meshStandardMaterial color="#1d1d1d" /></mesh>
      {[[-11, -7.2], [11.2, -7.6], [-11.2, 7.2], [3.2, 6.6]].map(([x, z]) => (
        <group key={`${x},${z}`} position={[x!, 0, z!]}>
          <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.32, 0.26, 0.6, 16]} /><meshStandardMaterial color="#8a4b2a" /></mesh>
          <mesh position={[0, 1, 0]} castShadow><sphereGeometry args={[0.6, 12, 12]} /><meshStandardMaterial color="#2f5a35" roughness={0.9} /></mesh>
        </group>
      ))}
    </group>
  );
}

function SectionLight({ s, bright }: { s: Section; bright: boolean }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const ref = useRef<THREE.SpotLight>(null!);
  useFrame((_, dt) => { ref.current.intensity = THREE.MathUtils.damp(ref.current.intensity, bright ? 260 : 110, 6, dt); });
  return (
    <>
      <primitive object={target} position={[s.x, 0, s.z]} />
      <spotLight ref={ref} position={[s.x, 7, s.z + 1.5]} target={target} angle={0.5} penumbra={0.8} decay={1.4} distance={16} intensity={110} color="#ffc27a" />
    </>
  );
}

/** Ambient light dims while a record is shown, so it stands out like cratedigger's info view. */
function RoomLights({ dim }: { dim: boolean }) {
  const amb = useRef<THREE.AmbientLight>(null!), hemi = useRef<THREE.HemisphereLight>(null!), sun = useRef<THREE.DirectionalLight>(null!);
  useFrame((_, dt) => {
    const f = dim ? 0.3 : 1;
    amb.current.intensity = THREE.MathUtils.damp(amb.current.intensity, 0.8 * f, 5, dt);
    hemi.current.intensity = THREE.MathUtils.damp(hemi.current.intensity, 0.8 * f, 5, dt);
    sun.current.intensity = THREE.MathUtils.damp(sun.current.intensity, 1.6 * f, 5, dt);
  });
  return (
    <>
      <ambientLight ref={amb} intensity={0.8} color="#ffd9b0" />
      <hemisphereLight ref={hemi} args={['#ffcc99', '#1a100a', 0.8]} />
      <directionalLight ref={sun} position={[14, 22, 10]} intensity={1.6} color="#ffd2a0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
    </>
  );
}

type Props = { albums: PublicAlbum[]; onOpenRecord: (r: PublicAlbum) => void; toggle: ReactNode };

export default function ShopScene({ albums, onOpenRecord, toggle }: Props) {
  const bins = useMemo(() => binsBySection(albums), [albums]);
  const placedBySection = useMemo(() => new Map(SECTIONS.map((s) => [s.id, place(s, bins.get(s.id) ?? [])])), [bins]);
  const placed = useMemo(() => [...placedBySection.values()].flat(), [placedBySection]);
  const wall = useMemo(() => albums.filter((r) => r.cover).filter((_, i) => i % 97 === 0).slice(0, 12), [albums]);
  const [view, setView] = useState<View>({ level: 'store' });
  const [hover, setHover] = useState<string | null>(null);
  const controls = useRef<CameraControls>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const lastWheel = useRef(0);

  const section = view.level === 'store' ? null : SECTIONS.find((s) => s.id === view.section)!;
  const digging = view.level === 'dig' ? placed.find((p) => p.key === view.bin)! : null;
  const sel = view.level === 'dig' ? view.sel : -1;
  const shown = view.level === 'dig' && view.shown;
  const current = digging && sel >= 0 ? digging.bin.records[sel]! : null;
  const count = (id: string) => (bins.get(id) ?? []).reduce((n, b) => n + b.records.length, 0);

  // Camera: one eased move per view change, the way cratedigger's camera follows the record you're on.
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    c.smoothTime = reduced() ? 0 : 0.35;
    if (view.level === 'store') void c.setLookAt(17, 15, 21, 0, 0, 0, true);
    else if (view.level === 'section' && section) void c.setLookAt(section.x + 2.5, 5.5, section.z + section.d / 2 + 6.5, section.x, 0.4, section.z, true);
    else if (digging) {
      if (sel < 0) void c.setLookAt(digging.x + 1.2, 2.1, digging.z + 2.8, digging.x, 0.35, digging.z, true);
      else {
        const s = slot(digging, sel);
        const [rx, rz] = [digging.x + s.x, digging.z + s.z];
        if (shown) void c.setLookAt(rx + 0.6, 1.55, rz + 2.6, rx, 1.35, rz + 0.1, true);
        else void c.setLookAt(rx + 1, 1.95, rz + 2.1, rx, 0.6, rz, true);
      }
    }
  }, [view, section, digging, sel, shown]);

  const step = (d: 1 | -1) => setView((v) => {
    if (v.level !== 'dig') return v;
    const n = placed.find((p) => p.key === v.bin)!.bin.records.length;
    if (v.shown) return { ...v, shown: false };
    return { ...v, sel: Math.max(0, Math.min(n - 1, v.sel + d)) };
  });
  const toggleShow = () => setView((v) => (v.level === 'dig' ? { ...v, sel: Math.max(0, v.sel), shown: !v.shown } : v));
  const back = () => setView((v) => (v.level === 'dig' ? (v.shown ? { ...v, shown: false } : { level: 'section', section: v.section }) : { level: 'store' }));

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (document.querySelector('dialog[open]') || (t && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)))) return;
      if (e.key === 'Escape') back();
      if (view.level !== 'dig') return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleShow(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : ''; return () => { document.body.style.cursor = ''; }; }, [hover]);

  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current!;
    // Digging: the wheel flips through the bin (and doesn't scroll the page); otherwise the camera controls own it.
    const wheel = (e: WheelEvent) => {
      if (view.level !== 'dig') return;
      e.preventDefault();
      if (performance.now() - lastWheel.current < 90 || Math.abs(e.deltaY) < 2) return;
      lastWheel.current = performance.now();
      step(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const pickSection = (id: string, e?: ThreeEvent<MouseEvent>) => {
    if (e && e.delta > 6) return; // that was an orbit drag, not a click
    e?.stopPropagation();
    setHover(null);
    setView({ level: 'section', section: id });
  };
  const pickBin = (p: Placed, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return;
    e.stopPropagation();
    setView({ level: 'dig', section: p.bin.section, bin: p.key, sel: -1, shown: false });
  };
  const pickRecord = (i: number, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6 || drag.current?.moved) return;
    e.stopPropagation();
    setView((v) => (v.level === 'dig' ? (v.sel === i ? { ...v, shown: !v.shown } : { ...v, sel: i, shown: false }) : v));
  };

  const pill = 'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm transition-colors';
  return (
    <>
      {/* The store is the page: the canvas fills the window and the controls float over it, like the bookshelf. */}
      <div
        ref={box}
        className="fixed inset-0 z-0"
        style={{ touchAction: view.level === 'dig' ? 'none' : undefined }}
        onPointerMove={(e) => {
          mouse.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
          if (drag.current && view.level === 'dig') {
            const dy = e.clientY - drag.current.y;
            if (Math.abs(dy) >= 26) { step(dy < 0 ? 1 : -1); drag.current = { y: e.clientY, moved: true }; }
          }
        }}
        onPointerDown={(e) => { if (view.level === 'dig') drag.current = { y: e.clientY, moved: false }; }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
      >
        <Canvas shadows dpr={[1, 2]} camera={{ position: [17, 15, 21], fov: 40, near: 0.1, far: 200 }}>
          <color attach="background" args={['#1a1411']} />
          <fog attach="fog" args={['#1a1411', 40, 70]} />
          <CameraControls
            ref={controls}
            makeDefault
            enabled={view.level !== 'dig'}
            minPolarAngle={0.2}
            maxPolarAngle={1.32}
            minDistance={2.5}
            maxDistance={42}
          />
          <RoomLights dim={shown} />
          <Room wall={wall} />
          {SECTIONS.map((s) => {
            const ps = placedBySection.get(s.id)!;
            const frontZ = Math.max(...ps.map((p) => p.z)) + BD / 2 + 0.03;
            return (
              <group
                key={s.id}
                onPointerOver={(e) => { e.stopPropagation(); if (view.level === 'store') setHover(s.id); }}
                onPointerOut={() => setHover((h) => (h === s.id ? null : h))}
                onClick={(e) => { if (view.level === 'store') pickSection(s.id, e); }}
              >
                <SectionLight s={s} bright={hover === s.id || section?.id === s.id} />
                {ps.filter((p) => p.key !== digging?.key).map((p) => (
                  <group key={p.key} position={[p.x, 0, p.z]} onClick={(e) => { if (view.level !== 'store') pickBin(p, e); }}>
                    <BinBox w={p.w} color={s.crates ? (p.bin.index % 2 ? '#2f5d3f' : '#8a6a3c') : p.bin.index % 2 ? WALNUT : WALNUT_DARK} />
                  </group>
                ))}
                <BrassPlaque position={[s.x, 0.27, frontZ]} label={s.name} width={Math.max(1.4, s.name.length * 0.12 + 0.4)} />
              </group>
            );
          })}
          <Sleeves placed={placed} skip={digging?.key ?? null} />
          <Suspense fallback={null}>
            {placed.filter((p) => p.key !== digging?.key).flatMap((p) => p.bin.records.map((r, i) => ({ r, i, p })))
              .filter(({ r, i, p }) => r.cover && slot(p, i).j === 0)
              .map(({ p, i }) => <FrontCover key={`${p.key}:${i}`} p={p} i={i} />)}
          </Suspense>
          {digging && (
            <Suspense fallback={<DigBin p={digging} sel={sel} shown={shown} maps={[]} mouse={mouse} onPick={pickRecord} />}>
              <TexturedDigBin key={digging.key} p={digging} sel={sel} shown={shown} mouse={mouse} onPick={pickRecord} />
            </Suspense>
          )}
        </Canvas>
      </div>

      {/* Section pills, floating at the top like the bookshelf's categories. */}
      <nav aria-label="Shop sections" className="relative z-10 mx-auto flex max-w-full justify-center">
        <ul className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-[#1a1411]/70 p-1 text-[#f3e6cf] backdrop-blur">
          <li><button type="button" aria-pressed={view.level === 'store'} onClick={() => setView({ level: 'store' })} className={`${pill} aria-pressed:bg-[#f3e6cf] aria-pressed:text-[#1a1411] hover:bg-white/10`}>Whole shop</button></li>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <button type="button" aria-pressed={section?.id === s.id} onClick={() => pickSection(s.id)} onMouseEnter={() => view.level === 'store' && setHover(s.id)} onMouseLeave={() => setHover(null)}
                className={`${pill} aria-pressed:bg-[#f3e6cf] aria-pressed:text-[#1a1411] hover:bg-white/10`}>
                {s.name} <span className="opacity-60">{count(s.id)}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Bins of the chosen section, as keyboard-reachable buttons. */}
      {section && (
        <div className="relative z-10 mt-3 flex flex-wrap justify-center gap-2">
          {placedBySection.get(section.id)!.map((p) => (
            <button key={p.key} type="button" aria-pressed={digging?.key === p.key} onClick={() => setView({ level: 'dig', section: section.id, bin: p.key, sel: -1, shown: false })}
              className="rounded-full border border-white/20 bg-[#1a1411]/70 px-3 py-1 text-xs text-[#f3e6cf] backdrop-blur hover:bg-white/10 aria-pressed:bg-[#cdb27a] aria-pressed:text-[#1a1411]">
              {p.bin.label} · {p.bin.records.length}
            </button>
          ))}
        </div>
      )}

      {/* The record you're on, shown big: title above, open or put back. */}
      {shown && current && (
        <div className="pointer-events-none fixed inset-x-0 bottom-36 z-10 text-center text-[#f3e6cf] [text-shadow:0_2px_12px_rgb(0_0_0/0.8)]">
          <p className="text-lg">{current.artist}</p>
          <p className="font-serif text-4xl font-bold">{current.title}</p>
        </div>
      )}

      <p role="status" className="sr-only">{current ? `${current.title} by ${current.artist}, ${sel + 1} of ${digging!.bin.records.length}` : ''}</p>

      <div className="fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 sm:p-6">
        {digging ? (
          <div className="flex items-center gap-2">
            {shown && current ? (
              <>
                <button type="button" onClick={() => onOpenRecord(current)} className="rounded-full bg-[#f3e6cf] px-5 py-2.5 text-sm font-semibold text-[#1a1411] hover:bg-white">Open album</button>
                <button type="button" onClick={toggleShow} className="rounded-full border border-white/30 bg-[#1a1411]/70 px-5 py-2.5 text-sm text-[#f3e6cf] backdrop-blur hover:bg-white/10">Put back</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => step(-1)} className="rounded-full border border-white/30 bg-[#1a1411]/70 px-5 py-2.5 text-sm text-[#f3e6cf] backdrop-blur hover:bg-white/10">Previous</button>
                <button type="button" onClick={toggleShow} className="rounded-full bg-[#f3e6cf] px-5 py-2.5 text-sm font-semibold text-[#1a1411] hover:bg-white">Show</button>
                <button type="button" onClick={() => step(1)} className="rounded-full border border-white/30 bg-[#1a1411]/70 px-5 py-2.5 text-sm text-[#f3e6cf] backdrop-blur hover:bg-white/10">Next</button>
              </>
            )}
          </div>
        ) : null}
        <div className="flex w-full items-end justify-between gap-4 text-xs text-[#f3e6cf]/70">
          <span>
            {view.level === 'store' && 'Drag to walk around · scroll to step closer · click a section'}
            {view.level === 'section' && 'Pick a bin · drag to look around · Esc steps back'}
            {view.level === 'dig' && (current ? `${current.title} — ${current.artist} · ${sel + 1} of ${digging!.bin.records.length}` : 'Scroll, drag or use the arrow keys to dig')}
          </span>
          {toggle}
        </div>
      </div>
    </>
  );
}
