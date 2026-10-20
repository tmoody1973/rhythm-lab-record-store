// The 3D record shop: the site's front door (decision 11). Pure modules decide what goes where (sections, layout,
// camera, quality); this file draws it and wires the HTML controls. Lazy-loaded from Collection.
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import type { UrlState } from '../state/url.ts';
import { digAim, sectionAim, storeAim } from './camera.ts';
import { stepSel } from './dig.ts';
import { layoutShop } from './layout.ts';
import { qualityFor } from './quality.ts';
import { RoomLights } from './scene/Lights.tsx';
import { BinBox, BrassPlaque, DividerTabs, FrontCovers, reducedMotion, SectionLight, Sleeves } from './scene/Bins.tsx';
import { CameraRig } from './scene/CameraRig.tsx';
import { ShopMaterials } from './scene/Materials.tsx';
import { Room } from './scene/Room.tsx';
import { binsBySection, SECTIONS, type SectionId } from './sections.ts';
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

const PILL = 'whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm hover:bg-white/10 aria-pressed:bg-[#f3e6cf] aria-pressed:text-[#1a1411]';
const GHOST = 'min-h-11 rounded-full border border-white/30 bg-[#1a1411]/70 px-5 py-2.5 text-sm text-[#f3e6cf] backdrop-blur hover:bg-white/10 disabled:opacity-40';
const SOLID = 'min-h-11 rounded-full bg-[#f3e6cf] px-5 py-2.5 text-sm font-semibold text-[#1a1411] hover:bg-white';

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

const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
const DRAG_PX = 6; // pointer moves beyond this are orbit drags, not clicks

export default function ShopScene({ albums, state, patch, onNotice }: ShopSceneProps) {
  const quality = useMemo(() => qualityFor(window.innerWidth, (navigator as Navigator & { deviceMemory?: number }).deviceMemory), []);
  const bins = useMemo(() => binsBySection(albums), [albums]);
  const { room, placed, sections } = useMemo(() => layoutShop(bins), [bins]);
  const aspect = useAspect();
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState(-1);
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);

  // Where we are comes from the link (section, bin); links that point nowhere are cleaned up, not obeyed.
  const section = SECTIONS.find((s) => s.id === state.section && (bins.get(s.id)?.length ?? 0) > 0) ?? null;
  const bin = section && state.bin !== null ? placed.find((p) => p.key === `${section.id}:${state.bin}`) ?? null : null;
  useEffect(() => {
    if (state.section && !section) patch({ section: null, bin: null });
    else if (state.bin !== null && section && !bin) patch({ bin: null });
  }, [state.section, state.bin, section, bin, patch]);
  useEffect(() => { setSel(-1); setShown(false); }, [bin?.key]);

  const go = (sectionId: string | null, binIndex: number | null) => { setHover(null); patch({ section: sectionId, bin: binIndex }, { push: true }); };
  const clicked = (e: ThreeEvent<MouseEvent>) => { if (e.delta > DRAG_PX) return false; e.stopPropagation(); return true; };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || typing(e.target) || document.querySelector('dialog[open]')) return;
      if (shown) setShown(false);
      else if (bin) patch({ bin: null });
      else if (section) patch({ section: null, bin: null });
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [shown, bin, section, patch]);

  const aim = bin ? digAim(bin, sel, shown, aspect) : section ? sectionAim(sections.get(section.id)!, aspect) : storeAim(room, aspect);
  const count = (id: SectionId) => (bins.get(id) ?? []).reduce((n, b) => n + b.records.length, 0);
  const hint = bin ? 'Scroll, drag or use the arrow keys to dig · Esc steps back' : section ? 'Pick a bin · drag to look around · Esc steps back' : 'Drag to walk around · scroll to step closer · click a section';

  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : ''; return () => { document.body.style.cursor = ''; }; }, [hover]);

  // The GPU gave up (driver reset, sleep/wake…): don't show a black page — hand over to the grid for this visit.
  const lost = (e: Event) => { e.preventDefault(); give3DUp(); onNotice(GAVE_UP_NOTICE); patch({ view: 'grid' }); };

  return (
    <div data-testid="shop" data-ready={ready} data-reduced-motion={String(reducedMotion())} className="fixed inset-0 z-0 bg-[#1a1411]">
      <Canvas
        frameloop="demand"
        shadows
        dpr={quality.dpr}
        camera={{ position: aim.position, fov: 40, near: 0.1, far: 200 }}
        onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', lost, { once: true }); setReady(true); }}
      >
        <color attach="background" args={['#1a1411']} />
        <fog attach="fog" args={['#1a1411', 40, 70]} />
        {import.meta.env.DEV && <FrameCounter />}
        <CameraRig aim={aim} interactive={!bin} minDistance={section ? 3 : 10} />
        <RoomLights dim={false} quality={quality} />
        <ShopMaterials room={room}>
          <Suspense fallback={null}><Room room={room} quality={quality} /></Suspense>
          {SECTIONS.map((s) => {
            const rect = sections.get(s.id)!;
            const ps = placed.filter((p) => p.bin.section === s.id);
            if (!ps.length) return null;
            return (
              <group
                key={s.id}
                onPointerOver={(e) => { e.stopPropagation(); if (!section) setHover(s.id); }}
                onPointerOut={() => setHover((h) => (h === s.id ? null : h))}
                onClick={(e) => { if (!section && clicked(e)) go(s.id, null); }}
              >
                <SectionLight rect={rect} bright={hover === s.id || section?.id === s.id} />
                {ps.map((p) => (
                  <group key={p.key} position={[p.x, 0, p.z]} onClick={(e) => { if (section && clicked(e)) go(s.id, p.bin.index); }}>
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
      <ShopOverlay
        hint={hint}
        onGrid={() => patch({ view: 'grid' })}
        top={
          <>
            <nav aria-label="Shop sections" className="max-w-full">
              <ul className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-[#1a1411]/70 p-1 text-[#f3e6cf] backdrop-blur">
                <li><button type="button" aria-pressed={!section} onClick={() => go(null, null)} className={PILL}>Whole shop</button></li>
                {SECTIONS.filter((s) => count(s.id) > 0).map((s) => (
                  <li key={s.id}>
                    <button type="button" aria-pressed={section?.id === s.id} onClick={() => go(s.id, null)} onMouseEnter={() => !section && setHover(s.id)} onMouseLeave={() => setHover(null)} className={PILL}>
                      {s.name} <span className="opacity-60">{count(s.id)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            {section && (
              <nav aria-label="Bins" className="flex flex-wrap justify-center gap-2">
                {bins.get(section.id)!.map((b) => (
                  <button key={b.index} type="button" aria-pressed={bin?.bin.index === b.index} onClick={() => go(section.id, b.index)}
                    className="rounded-full border border-white/20 bg-[#1a1411]/70 px-3 py-1 text-xs text-[#f3e6cf] backdrop-blur hover:bg-white/10 aria-pressed:bg-[#cdb27a] aria-pressed:text-[#1a1411]">
                    {b.label} · {b.records.length}
                  </button>
                ))}
              </nav>
            )}
          </>
        }
        footer={bin && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setSel((v) => stepSel(v, -1, bin.bin.records.length))} className={GHOST}>Previous</button>
            <button type="button" onClick={() => { setSel((v) => Math.max(0, v)); setShown((v) => !v); }} className={SOLID}>Show</button>
            <button type="button" onClick={() => setSel((v) => stepSel(v, 1, bin.bin.records.length))} className={GHOST}>Next</button>
          </div>
        )}
      />
    </div>
  );
}
