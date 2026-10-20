// The lived-in room: brick back wall with the neon and tribute posters, the green staff-picks wall, plank floor,
// rug, brass lamps, listening station, counter, the front door, and CC0 plants. Walls between the camera and the
// room fade out, so it always reads as an open dollhouse. Placed relative to the room, which grows with the catalog.
import { Clone, Text, useGLTF, useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Suspense, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { easeFactor } from '../dig.ts';
import type { PublicAlbum } from '../../catalog/schema.ts';
import type { Room as RoomSize } from '../layout.ts';
import type { Quality } from '../quality.ts';
import { BrassPlaque, FONT, reducedMotion } from './Bins.tsx';
import { useDecor, useMats } from './Materials.tsx';

const H = 3.6; // wall height

function Wall({ position, size, normal, material, children }: { position: [number, number, number]; size: [number, number, number]; normal: [number, number, number]; material: THREE.MeshStandardMaterial; children?: ReactNode }) {
  // Each wall fades on its own, so it needs its own copy of the shared material.
  const own = useMemo(() => material.clone(), [material]);
  const kids = useRef<THREE.Group>(null!);
  const n = useMemo(() => new THREE.Vector3(...normal), [normal]);
  const p = useMemo(() => new THREE.Vector3(...position), [position]);
  useFrame(({ camera, invalidate }, dt) => {
    if (own.map !== material.map) { // the decor textures arrived after this wall was made
      own.map = material.map; own.normalMap = material.normalMap; own.color.copy(material.color); own.needsUpdate = true;
    }
    const goal = camera.position.clone().sub(p).dot(n) > 0 ? 0 : 1;
    own.opacity += (goal - own.opacity) * easeFactor(dt, reducedMotion(), 8);
    own.transparent = own.opacity < 0.99;
    own.depthWrite = own.opacity > 0.5;
    kids.current.visible = own.opacity > 0.5;
    if (Math.abs(goal - own.opacity) > 0.005) invalidate();
  });
  return (
    <group position={position}>
      <mesh receiveShadow material={own}><boxGeometry args={size} /></mesh>
      <group ref={kids}>{children}</group>
    </group>
  );
}

// Typographic tribute posters (Tarik's pick): no faces, logos or album art.
const POSTERS: [string, number, number][] = [
  ['miles-davis', -10.4, 0.5], ['bjork', -8.1, 0.5], ['tribe-called-quest', 3.3, 0.5], ['j-dilla', 5.6, 0.5], ['sun-ra', 8.9, 0.75], ['alice-coltrane', 10.9, 0.75],
];

function Poster({ url, position }: { url: string; position: [number, number, number] }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const [w, h] = [0.95, 1.425];
  return (
    <group position={position}>
      <mesh position={[0, 0, 0.02]} castShadow><boxGeometry args={[w + 0.1, h + 0.1, 0.04]} /><meshStandardMaterial color="#141110" roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.045]}><planeGeometry args={[w, h]} /><meshStandardMaterial map={tex} roughness={0.45} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.12} /></mesh>
      <mesh position={[0, h / 2 + 0.1, 0.12]}><boxGeometry args={[0.32, 0.05, 0.08]} /><meshStandardMaterial color="#b8955a" metalness={0.7} roughness={0.3} /></mesh>
    </group>
  );
}

function Sconce({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.12]}><cylinderGeometry args={[0.025, 0.025, 0.25, 8]} /><meshStandardMaterial color="#b8955a" metalness={0.7} roughness={0.3} /></mesh>
      <mesh position={[0, -0.06, 0.25]}><coneGeometry args={[0.14, 0.18, 16, 1, true]} /><meshStandardMaterial color="#1f2d24" side={THREE.DoubleSide} /></mesh>
      <mesh position={[0, -0.1, 0.25]}><sphereGeometry args={[0.05, 12, 12]} /><meshBasicMaterial color={[3, 2.2, 1.2]} toneMapped={false} /></mesh>
      <pointLight position={[0, -0.2, 0.35]} color="#ffb766" intensity={6} distance={5} decay={1.6} />
    </group>
  );
}

/** A worn red Persian-style rug, drawn once into a canvas texture. */
function Rug({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  const map = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    if (g) {
      g.fillStyle = '#5b1a17'; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = '#1d2b4a'; g.lineWidth = 22; g.strokeRect(11, 11, 490, 234);
      g.strokeStyle = '#c9a66b'; g.lineWidth = 4; g.strokeRect(30, 30, 452, 196);
      g.fillStyle = '#8b2c22';
      for (let x = 70; x < 470; x += 62) for (const y of [78, 178]) { g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 22, y); g.lineTo(x, y + 26); g.lineTo(x - 22, y); g.fill(); }
      g.fillStyle = '#c9a66b';
      g.beginPath(); g.moveTo(256, 92); g.lineTo(300, 128); g.lineTo(256, 164); g.lineTo(212, 128); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return <mesh position={position} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow><planeGeometry args={size} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}

function Door({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <mesh><boxGeometry args={[1.3, 2.3, 0.12]} /><meshStandardMaterial color="#1e2a23" roughness={0.6} /></mesh>
      <mesh position={[0, 0.2, 0.07]}><planeGeometry args={[0.9, 1.3]} /><meshStandardMaterial color="#d9b77a" emissive="#ffb35a" emissiveIntensity={0.35} /></mesh>
      <Text font={FONT} position={[0, 0.4, 0.08]} fontSize={0.16} color="#1e2a23">OPEN</Text>
    </group>
  );
}

/** Tarik's picks face-out on the left wall (up to 12); clicking one digs them all. Bare when there are none. */
export function StaffPicksWall({ records, onPick }: { records: PublicAlbum[]; onPick: () => void }) {
  return (
    <Suspense fallback={null}>
      {records.filter((r) => r.cover).map((r, i) => (
        <WallCover key={r.id} url={r.cover!.grid} y={-0.9 + Math.floor(i / 4) * 1.05} z={-2.4 + (i % 4) * 1.6} onPick={onPick} />
      ))}
    </Suspense>
  );
}

function WallCover({ url, y, z, onPick }: { url: string; y: number; z: number; onPick: () => void }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  return (
    <mesh position={[0.12, y, z]} rotation={[0, Math.PI / 2, 0]} onClick={(e) => { if (e.delta > 6) return; e.stopPropagation(); onPick(); }}>
      <planeGeometry args={[0.9, 0.9]} />
      <meshStandardMaterial map={tex} roughness={0.5} />
    </mesh>
  );
}

export function Plant({ url, position, scale, turn }: { url: string; position: [number, number, number]; scale: number; turn: number }) {
  const { scene } = useGLTF(url);
  return <Clone object={scene} position={position} scale={scale} rotation={[0, turn, 0]} castShadow receiveShadow />;
}

function Plants({ room, quality }: { room: RoomSize; quality: Quality }) {
  const decor = useDecor();
  if (!decor) return null;
  const { backZ: b, frontZ: f } = room;
  const cz = (b + f) / 2;
  const spots: { at: [number, number, number]; lush: boolean; s?: number; turn: number }[] = [
    { at: [-11.1, 0, b + 0.8], lush: true, turn: 0 },
    { at: [-11.1, 0, f - 0.9], lush: true, turn: 2.1 },
    { at: [10.4, 0, f - 0.8], lush: true, s: 0.8, turn: 1 },
    { at: [11.25, 1.1, b + 1.05], lush: false, s: 0.7, turn: 0 },
    { at: [-11.2, 0, cz - 4.4], lush: true, turn: 1.2 },
    { at: [-11.2, 0, cz + 3.4], lush: false, turn: 0.4 },
    { at: [7.5, 0, b + 0.8], lush: false, turn: 0.9 },
    { at: [3.2, 0, f - 2.4], lush: false, turn: 2.6 },
  ];
  return (
    <>
      {spots.slice(0, quality.plantCount).map(({ at, lush, s = 1, turn }) => {
        const big = lush && quality.lushPlants;
        return <Plant key={at.join()} url={big ? decor.plants.lush : decor.plants.small} position={at} scale={(big ? 2.2 : 6.4) * s} turn={turn} />;
      })}
    </>
  );
}

export function Room({ room, quality, staffPicksWall }: { room: RoomSize; quality: Quality; staffPicksWall?: ReactNode }) {
  const m = useMats();
  const { backZ: b, frontZ: f } = room;
  const depth = f - b, cz = (b + f) / 2;
  return (
    <group>
      <mesh position={[0, -0.15, cz]} receiveShadow material={m.floor}><boxGeometry args={[24, 0.3, depth]} /></mesh>
      <Wall position={[0, H / 2, b - 0.1]} size={[24.4, H, 0.2]} normal={[0, 0, -1]} material={m.brick}>
        <Text font={FONT} position={[-1.5, 1.05, 0.12]} fontSize={0.85} letterSpacing={0.08} anchorX="center">
          RHYTHM LAB
          <meshBasicMaterial color={[3.2, 1.2, 0.5]} toneMapped={false} />
        </Text>
        <pointLight position={[-1.5, 0.9, 1.2]} color="#ff7a3c" intensity={14} distance={8} decay={1.6} />
        <Suspense fallback={null}>
          {POSTERS.map(([slug, x, y]) => <Poster key={slug} url={`/posters/${slug}.webp`} position={[x, y, 0.1]} />)}
        </Suspense>
        <Sconce position={[-9.25, 1.35, 0.1]} />
        <Sconce position={[4.45, 1.35, 0.1]} />
        <Sconce position={[9.9, 1.55, 0.1]} />
      </Wall>
      <Wall position={[-12.1, H / 2, cz]} size={[0.2, H, depth + 0.4]} normal={[-1, 0, 0]} material={m.plaster}>
        {staffPicksWall}
        <BrassPlaque position={[0.13, 1.45, 0]} rotation={[0, Math.PI / 2, 0]} label="Staff picks" width={1.6} />
        <Sconce position={[0.1, 1.2, -4.2]} rotation={[0, Math.PI / 2, 0]} />
        <Sconce position={[0.1, 1.2, 4.2]} rotation={[0, Math.PI / 2, 0]} />
      </Wall>
      <Wall position={[0, H / 2, f + 0.1]} size={[24.4, H, 0.2]} normal={[0, 0, 1]} material={m.trim}>
        <Door position={[8.8, -0.65, -0.12]} />
      </Wall>
      <Wall position={[12.1, H / 2, cz]} size={[0.2, H, depth + 0.4]} normal={[1, 0, 0]} material={m.trim} />
      <Rug position={[-10.2, 0.006, cz]} size={[5.2, 1.8]} />
      <group position={[8.8, 0.006, f - 0.7]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.4, 0.8]} /><meshStandardMaterial color="#2d3b2f" roughness={1} /></mesh>
        <Text font={FONT} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.12} letterSpacing={0.15} color="#c9a66b">RHYTHM LAB</Text>
      </group>
      {/* Listening station, back right */}
      <group position={[9.8, 0, b + 1.4]}>
        <mesh position={[0, 0.55, 0]} material={m.walnut} castShadow receiveShadow><boxGeometry args={[3.4, 1.1, 1.3]} /></mesh>
        {[-0.8, 0.8].map((x) => (
          <group key={x}>
            <mesh position={[x, 1.15, 0]} castShadow><cylinderGeometry args={[0.42, 0.42, 0.08, 32]} /><meshStandardMaterial color="#151515" roughness={0.3} /></mesh>
            <mesh position={[x + 0.33, 1.2, 0.05]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.03, 0.03, 0.4]} /><meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.2} /></mesh>
          </group>
        ))}
        <mesh position={[0, 1.55, -0.55]}><boxGeometry args={[2.2, 0.08, 0.1]} /><meshStandardMaterial color="#3a2414" /></mesh>
        {[-0.7, 0, 0.7].map((x) => (
          <mesh key={x} position={[x, 1.4, -0.48]}><torusGeometry args={[0.13, 0.018, 8, 24, Math.PI]} /><meshStandardMaterial color="#111" roughness={0.4} /></mesh>
        ))}
        <BrassPlaque position={[0, 0.75, 0.66]} label="Listening station" width={2} />
      </group>
      {/* Counter by the door */}
      <group position={[10.4, 0, f - 6]}>
        <mesh position={[0, 0.55, 0]} material={m.walnut} castShadow receiveShadow><boxGeometry args={[1.4, 1.1, 3]} /></mesh>
        <mesh position={[0, 1.3, -0.6]} castShadow><boxGeometry args={[0.6, 0.4, 0.5]} /><meshStandardMaterial color="#1d1d1d" /></mesh>
        <mesh position={[0, 1.35, 0.9]}><cylinderGeometry args={[0.02, 0.02, 0.35, 8]} /><meshStandardMaterial color="#b8955a" metalness={0.7} /></mesh>
        <mesh position={[0, 1.55, 0.9]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.4, 16, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#1f5a3a" side={THREE.DoubleSide} /></mesh>
        <pointLight position={[0, 1.45, 0.9]} color="#ffcf8a" intensity={2.5} distance={3} decay={1.8} />
      </group>
      <Suspense fallback={null}><Plants room={room} quality={quality} /></Suspense>
    </group>
  );
}
