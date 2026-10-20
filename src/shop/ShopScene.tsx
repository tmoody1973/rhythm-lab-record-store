// The 3D record shop: the site's front door (decision 11). Pure modules decide what goes where (sections, layout,
// camera, quality); this file draws it and wires the HTML controls. Lazy-loaded from Collection.
import { Canvas, useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import type { UrlState } from '../state/url.ts';
import { storeAim } from './camera.ts';
import { layoutShop } from './layout.ts';
import { qualityFor } from './quality.ts';
import { RoomLights } from './scene/Lights.tsx';
import { BinBox, BrassPlaque, DividerTabs, FrontCovers, reducedMotion, SectionLight, Sleeves } from './scene/Bins.tsx';
import { CameraRig } from './scene/CameraRig.tsx';
import { ShopMaterials } from './scene/Materials.tsx';
import { Room } from './scene/Room.tsx';
import { binsBySection, SECTIONS } from './sections.ts';
import { ShopOverlay } from './ShopOverlay.tsx';
import { give3DUp } from './support.ts';

export type ShopSceneProps = {
  albums: PublicAlbum[];
  state: UrlState;
  patch: (p: Partial<UrlState>, opts?: { push?: boolean }) => void;
  onOpenRecord: (r: PublicAlbum) => void;
  onNotice: (text: string) => void;
  staffPicks: PublicAlbum[];
};

export const GAVE_UP_NOTICE = "The 3D shop stopped working in this browser, so here's the grid.";

/** Development builds count frames so tests can check that an idle shop stops drawing. */
function FrameCounter() {
  useFrame(() => { const w = window as unknown as { __rlFrames?: number }; w.__rlFrames = (w.__rlFrames ?? 0) + 1; });
  return null;
}

function useAspect() {
  const [aspect, setAspect] = useState(() => window.innerWidth / window.innerHeight);
  useEffect(() => {
    const on = () => setAspect(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return aspect;
}

export default function ShopScene({ albums, patch, onNotice }: ShopSceneProps) {
  const quality = useMemo(() => qualityFor(window.innerWidth, (navigator as Navigator & { deviceMemory?: number }).deviceMemory), []);
  const bins = useMemo(() => binsBySection(albums), [albums]);
  const { room, placed, sections } = useMemo(() => layoutShop(bins), [bins]);
  const aspect = useAspect();
  const [hover, setHover] = useState<string | null>(null);
  const aim = storeAim(room, aspect);

  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : ''; return () => { document.body.style.cursor = ''; }; }, [hover]);

  // The GPU gave up (driver reset, sleep/wake…): don't show a black page — hand over to the grid for this visit.
  const lost = (e: Event) => { e.preventDefault(); give3DUp(); onNotice(GAVE_UP_NOTICE); patch({ view: 'grid' }); };

  return (
    <div data-testid="shop" data-reduced-motion={String(reducedMotion())} className="fixed inset-0 z-0 bg-[#1a1411]">
      <Canvas
        frameloop="demand"
        shadows
        dpr={quality.dpr}
        camera={{ position: aim.position, fov: 40, near: 0.1, far: 200 }}
        onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', lost, { once: true })}
      >
        <color attach="background" args={['#1a1411']} />
        <fog attach="fog" args={['#1a1411', 40, 70]} />
        {import.meta.env.DEV && <FrameCounter />}
        <CameraRig aim={aim} interactive minDistance={10} />
        <RoomLights dim={false} quality={quality} />
        <ShopMaterials room={room}>
          <Suspense fallback={null}><Room room={room} quality={quality} /></Suspense>
          {SECTIONS.map((s) => {
            const rect = sections.get(s.id)!;
            const ps = placed.filter((p) => p.bin.section === s.id);
            if (!ps.length) return null;
            return (
              <group key={s.id} onPointerOver={(e) => { e.stopPropagation(); setHover(s.id); }} onPointerOut={() => setHover((h) => (h === s.id ? null : h))}>
                <SectionLight rect={rect} bright={hover === s.id} />
                {ps.map((p) => (
                  <group key={p.key} position={[p.x, 0, p.z]}>
                    <BinBox w={p.w} kind={s.crates ? (p.bin.index % 2 ? 'green' : 'natural') : p.bin.index % 2 ? 'walnut' : 'walnutDark'} />
                  </group>
                ))}
                <Suspense fallback={null}><BrassPlaque position={[rect.x, 0.27, rect.z + rect.d / 2 + 0.03]} label={s.name} width={Math.max(1.4, s.name.length * 0.12 + 0.4)} /></Suspense>
              </group>
            );
          })}
          <Sleeves placed={placed} skip={null} />
          <Suspense fallback={null}><DividerTabs placed={placed} skip={null} /></Suspense>
          <Suspense fallback={null}><FrontCovers placed={placed} skip={null} /></Suspense>
        </ShopMaterials>
      </Canvas>
      <ShopOverlay hint="Drag to walk around · scroll to step closer · click a section" onGrid={() => patch({ view: 'grid' })} />
    </div>
  );
}
