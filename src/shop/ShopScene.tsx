// The 3D record shop: the site's front door (decision 11). Pure modules decide what goes where (sections, layout,
// camera, quality); this file draws it and wires the HTML controls. Lazy-loaded from Collection.
import { addTail, Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Vector3 } from 'three';
import type { PublicAlbum } from '../catalog/schema.ts';
import type { UrlState } from '../state/url.ts';
import { digAim, fogFor, orbitLimits, sectionAim, storeAim } from './camera.ts';
import { stepSel } from './dig.ts';
import { BW } from './geometry.ts';
import { layoutShop, type Placed, type Rect } from './layout.ts';
import { qualityFor } from './quality.ts';
import { RoomLights } from './scene/Lights.tsx';
import { BinBox, BrassPlaque, DividerTabs, FrontCovers, reducedMotion, SectionLight, Sleeves } from './scene/Bins.tsx';
import { CameraRig } from './scene/CameraRig.tsx';
import { SteadyClock } from './scene/steadyClock.ts';
import { DigBin } from './scene/DigBin.tsx';
import { ShopMaterials } from './scene/Materials.tsx';
import { Room, StaffPicksWall } from './scene/Room.tsx';
import { binsBySection, SECTIONS, toBins, type Bin } from './sections.ts';
import { STAFF_PICKS } from './staffPicks.ts';
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

/** Development builds expose frames drawn, camera position and GPU textures, so tests can check idle, recentring and memory. */
type ProbeWindow = { __rlFrames?: number; __rlCamera?: number[]; __rlTextures?: number; __rlDeltas?: number[]; __rlIdle?: boolean; __rlScreenOf?: (name: string) => number[] | null };
function DevProbe() {
  useEffect(() => addTail(() => { (window as unknown as ProbeWindow).__rlIdle = true; }), []); // R3F's "the loop stopped"
  useFrame(({ camera, gl, scene, size }, delta) => {
    const w = window as unknown as ProbeWindow;
    w.__rlIdle = false;
    w.__rlFrames = (w.__rlFrames ?? 0) + 1;
    w.__rlDeltas = [...(w.__rlDeltas ?? []).slice(-199), delta];
    w.__rlCamera = camera.position.toArray();
    w.__rlTextures = gl.info.memory.textures;
    w.__rlScreenOf = (name) => { // where a named object (a dug record's id) is on screen, in CSS px
      const o = scene.getObjectByName(name);
      if (!o) return null;
      const v = o.getWorldPosition(new Vector3()).project(camera);
      return [(v.x + 1) / 2 * size.width, (1 - v.y) / 2 * size.height];
    };
  });
  return null;
}
const interactive = (t: EventTarget | null) => t instanceof Element && !!t.closest('a,button,input,select,textarea,summary,[role="button"]');

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

/** Somewhere you can step into and dig: one of the eight sections, or Tarik's staff picks. */
type Area = { id: string; name: string; rect: Rect; bins: Bin[]; placed: Placed[] };

export default function ShopScene({ albums, state, patch, onOpenRecord, onNotice, staffPicks }: ShopSceneProps) {
  const quality = useMemo(() => qualityFor(window.innerWidth, (navigator as Navigator & { deviceMemory?: number }).deviceMemory), []);
  const bins = useMemo(() => binsBySection(albums), [albums]);
  const { room, placed, sections } = useMemo(() => layoutShop(bins), [bins]);
  const aspect = useAspect();
  const [hover, setHover] = useState<string | null>(null);
  const [sel, setSel] = useState(-1);
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);
  const [recenter, setRecenter] = useState(0);
  // R3F force-loses the context when the shop unmounts (e.g. switching to the grid); that isn't the GPU giving up.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Where we are comes from the link (section, bin); links that point nowhere are cleaned up, not obeyed.
  const areas = useMemo<Area[]>(() => {
    const list = SECTIONS.map((s) => ({ id: s.id, name: s.name, rect: sections.get(s.id)!, bins: bins.get(s.id) ?? [], placed: placed.filter((p) => p.bin.section === s.id) }));
    if (!staffPicks.length) return list;
    // Staff picks are dug from a crate on the rug in front of their wall.
    const cz = (room.backZ + room.frontZ) / 2;
    // Tarik's order, not A–Z, so bins are labelled by position ("1–48"), not by initials.
    const sb = toBins(STAFF_PICKS, staffPicks).map((b) => ({ ...b, label: `${b.index * 48 + 1}–${b.index * 48 + b.records.length}` }));
    return [{ id: STAFF_PICKS, name: 'Staff picks', rect: { x: -10.2, z: cz, w: 3, d: 2 }, bins: sb, placed: sb.map((b) => ({ key: `${STAFF_PICKS}:${b.index}`, bin: b, x: -10.2, z: cz, w: BW })) }, ...list];
  }, [bins, placed, sections, room, staffPicks]);
  const section = areas.find((a) => a.id === state.section && a.bins.length > 0) ?? null;
  const bin = section && state.bin !== null ? section.placed.find((p) => p.bin.index === state.bin) ?? null : null;
  useEffect(() => {
    if (state.section && !section) patch({ section: null, bin: null });
    else if (state.bin !== null && section && !bin) patch({ bin: null });
  }, [state.section, state.bin, section, bin, patch]);
  useEffect(() => { setSel(-1); setShown(false); }, [bin?.key]);

  const go = (sectionId: string | null, binIndex: number | null) => {
    setHover(null);
    if (sectionId === null && !section) { setRecenter((n) => n + 1); return; } // already in the whole shop: just re-centre
    patch({ section: sectionId, bin: binIndex }, { push: true });
  };
  const clicked = (e: ThreeEvent<MouseEvent>) => { if (e.delta > DRAG_PX) return false; e.stopPropagation(); return true; };

  // Digging (cratedigger): wheel, vertical drag, arrows or buttons move the standing record; Show lifts it.
  const n = bin?.bin.records.length ?? 0;
  const current = bin && sel >= 0 ? bin.bin.records[sel]! : null;
  const step = (d: 1 | -1) => { if (shown) setShown(false); else setSel((v) => stepSel(v, d, n)); };
  const toggleShow = () => { setSel((v) => (v < 0 ? stepSel(v, 1, n) : v)); setShown((v) => !v); };
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const lastWheel = useRef(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || document.querySelector('dialog[open]') || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey) return;
      if (e.key === 'Escape') {
        if (shown) setShown(false);
        else if (bin) patch({ bin: null });
        else if (section) patch({ section: null, bin: null });
        return;
      }
      if (!bin) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); step(1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); step(-1); }
      if ((e.key === 'Enter' || e.key === ' ') && !interactive(e.target)) { e.preventDefault(); toggleShow(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });
  useEffect(() => {
    const el = root.current!;
    const wheel = (e: WheelEvent) => {
      if (!bin) return; // elsewhere the wheel moves the camera
      e.preventDefault();
      if (performance.now() - lastWheel.current < 90 || Math.abs(e.deltaY) < 2) return;
      lastWheel.current = performance.now();
      step(e.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const aim = bin ? digAim(bin, sel, shown, aspect) : section ? sectionAim(section.rect, aspect) : storeAim(room, aspect);
  const count = (a: Area) => a.bins.reduce((n, b) => n + b.records.length, 0);
  const hint = current ? <span data-testid="dig-caption" className="hidden sm:inline">{current.title} — {current.artist} · {sel + 1} of {n}</span> : bin ? 'Scroll, drag or use the arrow keys to dig · Esc steps back' : section ? 'Pick a bin · drag to look around · Esc steps back' : 'Drag to walk around · scroll to step closer · click a section';

  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : ''; return () => { document.body.style.cursor = ''; }; }, [hover]);
  if (import.meta.env.DEV) (window as unknown as { __rlAim?: number[] }).__rlAim = aim.position; // tests compare the camera to its aim

  // The GPU gave up (driver reset, sleep/wake…): don't show a black page — hand over to the grid for this visit.
  const lost = (e: Event) => { if (!alive.current) return; e.preventDefault(); give3DUp(); onNotice(GAVE_UP_NOTICE); patch({ view: 'grid' }); };

  return (
    <div
      ref={root}
      data-testid="shop"
      data-ready={ready}
      data-reduced-motion={String(reducedMotion())}
      className="fixed inset-0 z-0 bg-[#1a1411]"
      style={{ touchAction: bin ? 'none' : undefined }}
      onPointerMove={(e) => {
        mouse.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
        if (drag.current && e.buttons === 0 && e.pointerType === 'mouse') drag.current = null; // released elsewhere
        if (drag.current && bin) {
          const dy = e.clientY - drag.current.y;
          if (Math.abs(dy) >= 26) { step(dy < 0 ? 1 : -1); drag.current = { y: e.clientY, moved: true }; }
        }
      }}
      /* No pointer capture: it retargets the click to this div, so R3F never sees it and records can't be picked. */
      onPointerDown={(e) => { if (bin && e.target instanceof HTMLCanvasElement) { drag.current = { y: e.clientY, moved: false }; } }}
      onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
      onPointerCancel={() => { drag.current = null; }}
    >
      <Canvas
        frameloop="demand"
        shadows
        dpr={quality.dpr}
        camera={{ position: aim.position, fov: 40, near: 0.1, far: 200 }}
        onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', lost, { once: true }); setReady(true); }}
      >
        <SteadyClock />
        <color attach="background" args={['#1a1411']} />
        <fog attach="fog" args={['#1a1411', ...fogFor(aim)]} />
        {import.meta.env.DEV && <DevProbe />}
        <CameraRig aim={aim} interactive={!bin} recenter={recenter} {...orbitLimits(aim, section ? 'section' : 'store')} />
        <RoomLights dim={shown} quality={quality} />
        <ShopMaterials room={room}>
          <Suspense fallback={null}><Room room={room} quality={quality} staffPicksWall={<StaffPicksWall records={staffPicks.slice(0, 12)} onPick={() => go(STAFF_PICKS, 0)} />} /></Suspense>
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
                {ps.filter((p) => p.key !== bin?.key).map((p) => (
                  <group key={p.key} position={[p.x, 0, p.z]} onClick={(e) => { if (section && clicked(e)) go(s.id, p.bin.index); }}>
                    <BinBox w={p.w} kind={s.crates ? (p.bin.index % 2 ? 'green' : 'natural') : p.bin.index % 2 ? 'walnut' : 'walnutDark'} />
                  </group>
                ))}
                <Suspense fallback={null}><BrassPlaque position={[rect.x, 0.27, rect.z + rect.d / 2 + 0.03]} label={s.name} width={Math.max(1.4, s.name.length * 0.12 + 0.4)} /></Suspense>
              </group>
            );
          })}
          <Sleeves placed={placed} skip={bin?.key ?? null} />
          <Suspense fallback={null}><DividerTabs placed={placed} skip={bin?.key ?? null} /></Suspense>
          <Suspense fallback={null}><FrontCovers placed={placed} skip={bin?.key ?? null} /></Suspense>
          {bin && (
            <DigBin
              p={bin}
              sel={sel}
              shown={shown}
              mouse={mouse}
              textured
              onPick={(i) => { if (drag.current?.moved) return; if (i === sel) setShown((v) => !v); else { setSel(i); setShown(false); } }}
            />
          )}
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
                {areas.filter((a) => count(a) > 0).map((a) => (
                  <li key={a.id}>
                    <button type="button" aria-pressed={section?.id === a.id} onClick={() => go(a.id, null)} onMouseEnter={() => !section && setHover(a.id)} onMouseLeave={() => setHover(null)} className={PILL}>
                      {a.name} <span className="opacity-60">{count(a)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
            {section && (
              <nav aria-label="Bins" className="flex flex-wrap justify-center gap-2">
                {section.bins.map((b) => (
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
          <div className="flex flex-col items-center gap-3">
            {shown && current && (
              <div className="pointer-events-none text-center text-[#f3e6cf] [text-shadow:0_2px_12px_rgb(0_0_0/0.8)]">
                <p className="text-lg">{current.artist}</p>
                <p data-testid="shown-title" className="line-clamp-2 font-serif text-2xl font-bold sm:text-4xl">{current.title}</p>
              </div>
            )}
            <p role="status" className="sr-only">{current ? `${current.title} by ${current.artist}, ${sel + 1} of ${n}` : ''}</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {shown && current ? (
                <>
                  <button type="button" onClick={() => onOpenRecord(current)} className={SOLID}>Open album</button>
                  <button type="button" onClick={() => setShown(false)} className={GHOST}>Put back</button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => step(-1)} className={GHOST}>Previous</button>
                  <button type="button" onClick={toggleShow} className={SOLID}>Show</button>
                  <button type="button" onClick={() => step(1)} className={GHOST}>Next</button>
                </>
              )}
            </div>
          </div>
        )}
      />
    </div>
  );
}
