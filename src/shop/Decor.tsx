// SPIKE: the lived-in layer — CC0 Poly Haven materials and plants (npm run decor), framed posters, a rug,
// brass wall lamps, divider tabs, headphones, the counter lamp and the door. Nothing here is interactive.
import { Clone, Text, useGLTF, useTexture } from '@react-three/drei';
import { useMemo } from 'react';
import * as THREE from 'three';

const D = '/decor/';

function tiled(t: THREE.Texture, x: number, y: number, srgb: boolean) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(x, y);
  if (srgb) c.colorSpace = THREE.SRGBColorSpace;
  c.needsUpdate = true;
  return c;
}

/** Brick, planks and walnut veneer, tiled for each surface. */
export function useShopMaterials() {
  const [brick, brickN, planks, planksN, walnut, walnutN] = useTexture([
    `${D}brick_wall_02_diff.jpg`, `${D}brick_wall_02_nor.jpg`, `${D}dark_wooden_planks_diff.jpg`,
    `${D}dark_wooden_planks_nor.jpg`, `${D}black_walnut_veneer_01_diff.jpg`, `${D}black_walnut_veneer_01_nor.jpg`,
  ]);
  return useMemo(() => ({
    brick: new THREE.MeshStandardMaterial({ map: tiled(brick, 9, 1.4, true), normalMap: tiled(brickN, 9, 1.4, false), roughness: 0.95, color: '#b9907a' }),
    floor: new THREE.MeshStandardMaterial({ map: tiled(planks, 5, 3.5, true), normalMap: tiled(planksN, 5, 3.5, false), roughness: 0.8, color: '#8a6a52' }),
    walnut: new THREE.MeshStandardMaterial({ map: tiled(walnut, 1, 1, true), normalMap: tiled(walnutN, 1, 1, false), roughness: 0.6, color: '#a77b5a' }),
    walnutDark: new THREE.MeshStandardMaterial({ map: tiled(walnut, 1, 1, true), roughness: 0.65, color: '#6e4d36' }),
  }), [brick, brickN, planks, planksN, walnut, walnutN]);
}
export type ShopMaterials = ReturnType<typeof useShopMaterials>;

/** A photo-scanned potted plant; `lush` is the big leafy one, otherwise the small one. */
export function Plant({ position, scale = 1, lush = false, turn = 0 }: { position: [number, number, number]; scale?: number; lush?: boolean; turn?: number }) {
  const id = lush ? 'potted_plant_02' : 'potted_plant_04';
  const { scene } = useGLTF(`${D}${id}/${id}.gltf`);
  return <Clone object={scene} position={position} scale={(lush ? 2.2 : 6.4) * scale} rotation={[0, turn, 0]} castShadow receiveShadow />;
}

/** A framed 2:3 print with a little brass picture light. Tribute posters live in public/posters/. */
export function Poster({ url, position, rotation = [0, 0, 0], width = 0.95 }: { url: string; position: [number, number, number]; rotation?: [number, number, number]; width?: number }) {
  const tex = useTexture(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const h = width * 1.5;
  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, 0.02]} castShadow><boxGeometry args={[width + 0.1, h + 0.1, 0.04]} /><meshStandardMaterial color="#141110" roughness={0.4} /></mesh>
      <mesh position={[0, 0, 0.045]}><planeGeometry args={[width, h]} /><meshStandardMaterial map={tex} roughness={0.45} emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.12} /></mesh>
      <mesh position={[0, h / 2 + 0.1, 0.12]}><boxGeometry args={[0.32, 0.05, 0.08]} /><meshStandardMaterial color="#b8955a" metalness={0.7} roughness={0.3} /></mesh>
    </group>
  );
}

/** A brass wall lamp throwing a warm pool of light. */
export function Sconce({ position, rotation = [0, 0, 0] }: { position: [number, number, number]; rotation?: [number, number, number] }) {
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
export function Rug({ position, size }: { position: [number, number, number]; size: [number, number] }) {
  const map = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d')!;
    g.fillStyle = '#5b1a17'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#1d2b4a'; g.lineWidth = 22; g.strokeRect(11, 11, 490, 234);
    g.strokeStyle = '#c9a66b'; g.lineWidth = 4; g.strokeRect(30, 30, 452, 196);
    g.fillStyle = '#8b2c22';
    for (let x = 70; x < 470; x += 62) for (const y of [78, 178]) { g.beginPath(); g.moveTo(x, y - 26); g.lineTo(x + 22, y); g.lineTo(x, y + 26); g.lineTo(x - 22, y); g.fill(); }
    g.fillStyle = '#c9a66b';
    g.beginPath(); g.moveTo(256, 92); g.lineTo(300, 128); g.lineTo(256, 164); g.lineTo(212, 128); g.fill();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, []);
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={size} /><meshStandardMaterial map={map} roughness={1} /></mesh>;
}

/** White A–Z divider cards standing up between the sleeves, like the ones in Play & Chill's bins. */
export function DividerTabs({ spots }: { spots: { x: number; y: number; z: number; rx: number; letter: string }[] }) {
  return (
    <>
      {spots.map((s, i) => (
        <group key={i} position={[s.x, s.y, s.z]} rotation={[s.rx, 0, 0]}>
          <mesh><boxGeometry args={[0.16, 0.12, 0.006]} /><meshStandardMaterial color="#efe7d6" roughness={0.8} /></mesh>
          <Text position={[0, 0, 0.004]} fontSize={0.08} color="#2a1f14" anchorX="center" anchorY="middle">{s.letter}</Text>
        </group>
      ))}
    </>
  );
}

export function ListeningDetails({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* headphone rack on the wall behind the turntables */}
      <mesh position={[0, 1.55, -0.55]}><boxGeometry args={[2.2, 0.08, 0.1]} /><meshStandardMaterial color="#3a2414" /></mesh>
      {[-0.7, 0, 0.7].map((x) => (
        <group key={x} position={[x, 1.4, -0.48]}>
          <mesh rotation={[0, 0, 0]}><torusGeometry args={[0.13, 0.018, 8, 24, Math.PI]} /><meshStandardMaterial color="#111" roughness={0.4} /></mesh>
          {[-0.13, 0.13].map((dx) => <mesh key={dx} position={[dx, -0.02, 0]} rotation={[0, Math.PI / 2, 0]}><cylinderGeometry args={[0.06, 0.06, 0.05, 16]} /><meshStandardMaterial color="#1b1b1b" /></mesh>)}
        </group>
      ))}
      {/* tonearms */}
      {[-0.8, 0.8].map((x) => <mesh key={x} position={[x + 0.33, 1.2, 0.05]} rotation={[0, 0.5, 0]}><boxGeometry args={[0.03, 0.03, 0.4]} /><meshStandardMaterial color="#cfcfcf" metalness={0.8} roughness={0.2} /></mesh>)}
    </group>
  );
}

export function CounterDetails({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {/* banker's lamp */}
      <mesh position={[0, 0.25, 0.9]}><cylinderGeometry args={[0.02, 0.02, 0.35, 8]} /><meshStandardMaterial color="#b8955a" metalness={0.7} /></mesh>
      <mesh position={[0, 0.45, 0.9]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.1, 0.1, 0.4, 16, 1, false, 0, Math.PI]} /><meshStandardMaterial color="#1f5a3a" side={THREE.DoubleSide} /></mesh>
      <pointLight position={[0, 0.35, 0.9]} color="#ffcf8a" intensity={2.5} distance={3} decay={1.8} />
      {/* a short stack of records waiting to be priced */}
      {[0, 1, 2, 3].map((i) => <mesh key={i} position={[0.05, 0.08 + i * 0.012, -0.6]} rotation={[0, i * 0.12, 0]}><boxGeometry args={[0.6, 0.01, 0.6]} /><meshStandardMaterial color={['#c94f2a', '#e8dcc3', '#25424f', '#d8a73b'][i]} /></mesh>)}
    </group>
  );
}

/** The front door with a lit OPEN sign, seen from inside (lives on the front wall so it fades with it). */
export function Door({ position }: { position: [number, number, number] }) {
  return (
    <group position={position} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 0, 0]}><boxGeometry args={[1.3, 2.3, 0.12]} /><meshStandardMaterial color="#1e2a23" roughness={0.6} /></mesh>
      <mesh position={[0, 0.2, 0.07]}><planeGeometry args={[0.9, 1.3]} /><meshStandardMaterial color="#d9b77a" emissive="#ffb35a" emissiveIntensity={0.35} /></mesh>
      <Text position={[0, 0.4, 0.08]} fontSize={0.16} color="#1e2a23">OPEN</Text>
    </group>
  );
}

export function DoorMat({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[1.4, 0.8]} /><meshStandardMaterial color="#2d3b2f" roughness={1} /></mesh>
      <Text position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.12} letterSpacing={0.15} color="#c9a66b">RHYTHM LAB</Text>
    </group>
  );
}

useGLTF.preload(`${D}potted_plant_02/potted_plant_02.gltf`);
useGLTF.preload(`${D}potted_plant_04/potted_plant_04.gltf`);
