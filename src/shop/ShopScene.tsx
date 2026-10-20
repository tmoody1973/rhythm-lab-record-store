// SPIKE (throwaway, 2026-10-20): the isometric "hybrid" record shop. Dollhouse cutaway, moody light, eight sections
// as lit islands. Click a section to glide in, click a bin to dig, click a sleeve to open the album.
// Look: docs/design mockup from gpt-image-2 (scratchpad shop-hybrid-v1.png). Not tested; not for merge as-is.
import { Html, Text, useTexture } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { PublicAlbum } from '../catalog/schema.ts';
import { binsBySection, SECTIONS, type Bin, type Section } from './sections.ts';

const BW = 2.2, BD = 1.15, GAP = 0.2; // walnut bin footprint
const CW = 1.1; // milk crate width
const WALNUT = '#4a2c18', WALNUT_DARK = '#2b190d', BRICK = '#6b2e22', FLOOR = '#2e1d12';
const OFFSET = new THREE.Vector3(1, 1.05, 1).multiplyScalar(30); // fixed isometric viewing direction
const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

type Placed = { bin: Bin; x: number; z: number; w: number };

function place(s: Section, bins: Bin[]): Placed[] {
  const w = s.crates ? CW : BW;
  const cols = Math.max(1, Math.floor((s.w + GAP) / (w + GAP)));
  const rows = Math.ceil(bins.length / cols);
  return bins.map((bin, i) => {
    const row = Math.floor(i / cols), col = i % cols;
    const inRow = Math.min(cols, bins.length - row * cols);
    return { bin, w, x: s.x - ((inRow - 1) * (w + GAP)) / 2 + col * (w + GAP), z: s.z - ((rows - 1) * (BD + GAP)) / 2 + row * (BD + GAP) };
  });
}

/** An open-topped box: bottom, low front, taller back and sides. */
function BinBox({ x, z, w, color }: { x: number; z: number; w: number; color: string }) {
  const t = 0.06;
  const parts: [number, number, number, number, number, number][] = [
    [0, 0.06, 0, w, 0.12, BD],
    [0, 0.25, BD / 2 - t / 2, w, 0.5, t],
    [0, 0.35, -BD / 2 + t / 2, w, 0.7, t],
    [-w / 2 + t / 2, 0.3, 0, t, 0.6, BD],
    [w / 2 - t / 2, 0.3, 0, t, 0.6, BD],
  ];
  if (w === BW) parts.push([0, 0.3, 0, t, 0.6, BD]); // walnut bins have two compartments
  return (
    <group position={[x, 0, z]}>
      {parts.map(([px, py, pz, sx, sy, sz], i) => (
        <mesh key={i} position={[px, py, pz]} castShadow receiveShadow>
          <boxGeometry args={[sx, sy, sz]} />
          <meshStandardMaterial color={color} roughness={0.75} />
        </mesh>
      ))}
    </group>
  );
}

type SleeveSpot = { x: number; y: number; z: number; color: string; record: PublicAlbum; front: boolean };
const TILT = new THREE.Euler(-0.22, 0, 0);

/** Every record in the shop as one instanced mesh, coloured by its cover's dominant colour. */
function Sleeves({ spots }: { spots: SleeveSpot[] }) {
  const ref = useRef<THREE.InstancedMesh>(null!);
  useLayoutEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(TILT), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
    spots.forEach((s, i) => {
      ref.current.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), q, one));
      ref.current.setColorAt(i, c.set(s.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
  }, [spots]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, spots.length]} castShadow>
      <boxGeometry args={[0.9, 0.9, 0.012]} />
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}

/** The front sleeve of each compartment shows its real cover. */
function FrontCover({ spot }: { spot: SleeveSpot }) {
  const tex = useTexture(spot.record.cover!.grid);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[spot.x, spot.y, spot.z + 0.008]} rotation={TILT}>
      <planeGeometry args={[0.9, 0.9]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  );
}

function sleeveSpots(p: Placed): SleeveSpot[] {
  const halves = p.w === BW ? [p.bin.records.slice(0, 24), p.bin.records.slice(24)] : [p.bin.records];
  return halves.flatMap((rs, h) => {
    const cx = p.w === BW ? p.x + (h === 0 ? -0.53 : 0.53) : p.x;
    const step = (BD - 0.16) / Math.max(rs.length, 24);
    return rs.map((record, j) => ({ x: cx, y: 0.57, z: p.z + BD / 2 - 0.1 - j * step, color: record.cover?.dominant ?? '#c9b48a', record, front: j === 0 }));
  });
}

function SectionLight({ s, bright }: { s: Section; bright: boolean }) {
  const target = useMemo(() => new THREE.Object3D(), []);
  return (
    <>
      <primitive object={target} position={[s.x, 0, s.z]} />
      <spotLight position={[s.x, 7, s.z + 1.5]} target={target} angle={0.5} penumbra={0.8} decay={1.4} distance={16} intensity={bright ? 260 : 110} color="#ffc27a" />
    </>
  );
}

function Room({ wall }: { wall: PublicAlbum[] }) {
  return (
    <group>
      <mesh position={[0, -0.15, 0]} receiveShadow><boxGeometry args={[24, 0.3, 16]} /><meshStandardMaterial color={FLOOR} roughness={0.85} /></mesh>
      <mesh position={[0, 2.4, -8.1]} receiveShadow><boxGeometry args={[24, 5.1, 0.2]} /><meshStandardMaterial color={BRICK} roughness={0.95} /></mesh>
      <mesh position={[-12.1, 2.4, 0]} receiveShadow><boxGeometry args={[0.2, 5.1, 16.4]} /><meshStandardMaterial color="#2c3a31" roughness={0.9} /></mesh>
      <Text position={[-1.5, 3.6, -7.95]} fontSize={1} letterSpacing={0.08} anchorX="center">
        RHYTHM LAB
        <meshBasicMaterial color={[3.2, 1.2, 0.5]} toneMapped={false} />
      </Text>
      <pointLight position={[-1.5, 3.4, -6.8]} color="#ff7a3c" intensity={18} distance={9} decay={1.6} />
      {/* Staff picks: face-out on the left wall */}
      <Suspense fallback={null}>
        {wall.map((r, i) => <WallCover key={r.id} record={r} y={1.4 + Math.floor(i / 4) * 1.15} z={-2.4 + (i % 4) * 1.6} />)}
      </Suspense>
      <Plaque position={[-11.9, 4.4, 0]} label="Staff picks" />
      {/* Listening station, back right */}
      <mesh position={[9.8, 0.55, -5.9]} castShadow receiveShadow><boxGeometry args={[3.4, 1.1, 1.3]} /><meshStandardMaterial color={WALNUT} /></mesh>
      {[9, 10.6].map((x) => (
        <mesh key={x} position={[x, 1.15, -5.9]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.08, 32]} /><meshStandardMaterial color="#151515" roughness={0.3} /></mesh>
      ))}
      <Plaque position={[9.8, 2, -5.9]} label="Listening station" />
      {/* Counter by the door */}
      <mesh position={[10.2, 0.55, 3]} castShadow receiveShadow><boxGeometry args={[1.4, 1.1, 3]} /><meshStandardMaterial color={WALNUT} /></mesh>
      <mesh position={[10.2, 1.3, 2.4]} castShadow><boxGeometry args={[0.6, 0.4, 0.5]} /><meshStandardMaterial color="#1d1d1d" /></mesh>
      {[[-11, -7.2], [11.2, -7.2], [-11.2, 7.2], [3.2, 6.6]].map(([x, z]) => (
        <group key={`${x},${z}`} position={[x!, 0, z!]}>
          <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.32, 0.26, 0.6, 16]} /><meshStandardMaterial color="#8a4b2a" /></mesh>
          <mesh position={[0, 1, 0]} castShadow><sphereGeometry args={[0.6, 12, 12]} /><meshStandardMaterial color="#2f5a35" roughness={0.9} /></mesh>
        </group>
      ))}
    </group>
  );
}

function WallCover({ record, y, z }: { record: PublicAlbum; y: number; z: number }) {
  const tex = useTexture(record.cover!.grid);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[-11.95, y, z]} rotation={[0, Math.PI / 2, 0]}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  );
}

function Plaque({ position, label }: { position: [number, number, number]; label: string }) {
  return (
    <Html position={position} center zIndexRange={[10, 0]}>
      <span className="pointer-events-none whitespace-nowrap rounded-sm bg-[linear-gradient(180deg,#cdb27a,#a88a4e)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.25em] text-[#2a1f14] shadow">{label}</span>
    </Html>
  );
}

/** Glides the orthographic camera between the whole shop and one section; renders only while moving. */
function CameraRig({ focus }: { focus: Section | null }) {
  const { camera, size, invalidate } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0.5));
  useEffect(() => invalidate(), [focus, size, invalidate]);
  useFrame((_, dt) => {
    const cam = camera as THREE.OrthographicCamera;
    const goal = focus ? new THREE.Vector3(focus.x, 0.4, focus.z) : new THREE.Vector3(0, 0.6, 0.5);
    const span = focus ? (focus.w + focus.d) * 0.9 + 7 : 30;
    const zoom = Math.min(size.width / span, size.height / (focus ? span * 0.62 + 2 : 21), 110);
    const k = reduced() ? 1 : 1 - Math.exp(-dt * 5);
    target.current.lerp(goal, k);
    cam.zoom += (zoom - cam.zoom) * k;
    cam.position.copy(target.current).add(OFFSET);
    cam.lookAt(target.current);
    cam.updateProjectionMatrix();
    if (target.current.distanceTo(goal) > 0.01 || Math.abs(cam.zoom - zoom) > 0.05) invalidate();
  });
  return null;
}

type Props = { albums: PublicAlbum[]; onOpenBin: (bin: Bin, name: string) => void };

export default function ShopScene({ albums, onOpenBin }: Props) {
  const bins = useMemo(() => binsBySection(albums), [albums]);
  const placed = useMemo(() => new Map(SECTIONS.map((s) => [s.id, place(s, bins.get(s.id) ?? [])])), [bins]);
  const spots = useMemo(() => [...placed.values()].flat().flatMap(sleeveSpots), [placed]);
  const wall = useMemo(() => albums.filter((r) => r.cover).filter((_, i) => i % 97 === 0).slice(0, 12), [albums]);
  const [hover, setHover] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const focused = SECTIONS.find((s) => s.id === focus) ?? null;

  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : ''; return () => { document.body.style.cursor = ''; }; }, [hover]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape' && focus && !document.querySelector('dialog[open]')) setFocus(null); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [focus]);

  const stop = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();
  const count = (id: string) => (bins.get(id) ?? []).reduce((n, b) => n + b.records.length, 0);

  return (
    <div className="relative mt-8 overflow-hidden rounded-3xl bg-[#171210]">
      <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-3 p-4 text-sm text-[#f3e6cf]">
        <nav aria-label="Where you are" className="flex items-center gap-2">
          <button type="button" onClick={() => setFocus(null)} className="underline-offset-4 hover:underline">Shop</button>
          {focused && <><span aria-hidden="true">›</span><span className="font-semibold">{focused.name}</span><span className="opacity-70">· {count(focused.id)} records</span></>}
        </nav>
        <span className="hidden opacity-70 sm:inline">{focused ? 'Pick a bin to dig · Esc to step back' : 'Click a section to step in'}</span>
      </div>
      <div className="h-[72vh] min-h-[460px]">
        <Canvas orthographic shadows dpr={[1, 2]} frameloop="demand" camera={{ position: OFFSET.toArray(), zoom: 30, near: 0.1, far: 200 }} onPointerMissed={() => setHover(null)}>
          <color attach="background" args={['#171210']} />
          <ambientLight intensity={0.8} color="#ffd9b0" />
          <hemisphereLight args={['#ffcc99', '#1a100a', 0.8]} />
          <directionalLight position={[14, 22, 10]} intensity={1.6} color="#ffd2a0" castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-16} shadow-camera-right={16} shadow-camera-top={16} shadow-camera-bottom={-16} />
          <CameraRig focus={focused} />
          <Room wall={wall} />
          {SECTIONS.map((s) => (
            <group
              key={s.id}
              onPointerOver={(e) => { stop(e); if (!focus) setHover(s.id); }}
              onPointerOut={() => setHover((h) => (h === s.id ? null : h))}
              onClick={(e) => { stop(e); if (!focus) setFocus(s.id); }}
            >
              <SectionLight s={s} bright={hover === s.id || focus === s.id} />
              {placed.get(s.id)!.map((p) => (
                <group key={p.bin.index} onClick={(e) => { if (focus === s.id) { stop(e); onOpenBin(p.bin, s.name); } }}>
                  <BinBox x={p.x} z={p.z} w={p.w} color={s.crates ? (p.bin.index % 2 ? '#2f5d3f' : '#8a6a3c') : p.bin.index % 2 ? WALNUT : WALNUT_DARK} />
                  {focus === s.id && (
                    <Html position={[p.x, 1.35, p.z]} center zIndexRange={[30, 0]}>
                      <button type="button" onClick={() => onOpenBin(p.bin, s.name)} className="whitespace-nowrap rounded-full bg-[#f3efe8] px-3 py-1 text-xs font-semibold text-[#131718] shadow-lg hover:bg-white focus-visible:outline-2 focus-visible:outline-[#cdb27a]">
                        {p.bin.label} · {p.bin.records.length}
                      </button>
                    </Html>
                  )}
                </group>
              ))}
              {!focus && (
                <Html position={[s.x + s.w / 2 - 1.2, 0.7, s.z + s.d / 2 + 0.3]} center zIndexRange={[20, 0]}>
                  <button
                    type="button"
                    onClick={() => setFocus(s.id)}
                    onMouseEnter={() => setHover(s.id)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(s.id)}
                    onBlur={() => setHover(null)}
                    className="whitespace-nowrap rounded-sm bg-[linear-gradient(180deg,#d9bf86,#a88a4e)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.25em] text-[#2a1f14] shadow-md focus-visible:outline-2 focus-visible:outline-white"
                  >
                    {s.name} <span className="font-normal opacity-70">{count(s.id)}</span>
                  </button>
                </Html>
              )}
            </group>
          ))}
          <Sleeves spots={spots} />
          <Suspense fallback={null}>
            {spots.filter((s) => s.front && s.record.cover).map((s) => <FrontCover key={s.record.id} spot={s} />)}
          </Suspense>
        </Canvas>
      </div>
    </div>
  );
}
