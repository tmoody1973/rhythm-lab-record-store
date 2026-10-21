// "My crates" as a real 3D crate (decision 9: the flat version "isn't impactful"). Full screen: the shop's walnut bin
// on the plank floor with the cratedigger dig, brass tabs to switch crates, and the crate tools. Loaded only when the
// browser can draw 3D; CratesPanel keeps the flat dig as the fallback.
import { Canvas } from '@react-three/fiber';
import { Suspense, useEffect, useRef, useState } from 'react';
import type { PublicAlbum } from '../catalog/schema.ts';
import { encodeShare } from '../crates/share.ts';
import { deleteCrate, removeFromCrate, renameCrate, toggleFavorite } from '../crates/storage.ts';
import type { CratesPanelProps } from '../ui/CratesPanel.tsx';
import { digAim } from './camera.ts';
import { stepSel } from './dig.ts';
import { BW } from './geometry.ts';
import type { Placed, Room } from './layout.ts';
import { BinBox, reducedMotion } from './scene/Bins.tsx';
import { CameraRig } from './scene/CameraRig.tsx';
import { DigBin } from './scene/DigBin.tsx';
import { RoomLights } from './scene/Lights.tsx';
import { ShopMaterials, useDecor, useMats } from './scene/Materials.tsx';
import { Plant } from './scene/Room.tsx';
import { qualityFor } from './quality.ts';
import { give3DUp } from './support.ts';
import { event } from '../analytics.ts';
import { SteadyClock } from './scene/steadyClock.ts';
import { toBins } from './sections.ts';

const PER_BIN = 48;
const FAVORITES = 'favorites';
const STAGE: Room = { width: 24, backZ: -8, frontZ: 8 };
const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName));
const GHOST = 'min-h-11 rounded-full border border-white/30 bg-[#1a1411]/70 px-5 py-2.5 text-sm text-[#f3e6cf] backdrop-blur hover:bg-white/10 disabled:opacity-40';
const SOLID = 'min-h-11 rounded-full bg-[#f3e6cf] px-5 py-2.5 text-sm font-semibold text-[#1a1411] hover:bg-white';

function Floor() {
  const m = useMats();
  const decor = useDecor();
  return (
    <>
      <mesh position={[0, -0.15, 0]} receiveShadow material={m.floor}><boxGeometry args={[14, 0.3, 10]} /></mesh>
      {decor && <Suspense fallback={null}><Plant url={decor.plants.lush} position={[-2.1, 0, -1.2]} scale={1.8} turn={0.6} /></Suspense>}
    </>
  );
}

export default function CrateStage({ data, update, byId, place, onPlace, onOpenRecord, onClose, onLost }: CratesPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const mouse = useRef({ x: 0.5, y: 0.5 });
  const drag = useRef<{ y: number; moved: boolean } | null>(null);
  const lastWheel = useRef(0);
  const [shown, setShown] = useState(false);
  const [ready, setReady] = useState(false);
  // Closing My crates force-loses this canvas's context too; only a loss while open means the GPU gave up.
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const lost = (e: Event) => { if (!alive.current) return; e.preventDefault(); give3DUp(); onLost?.(); };
  const [renaming, setRenaming] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [aspect, setAspect] = useState(() => window.innerWidth / window.innerHeight);
  const quality = qualityFor(window.innerWidth);

  // Records the catalog no longer has are skipped and not counted.
  const real = (ids: string[]) => ids.map((id) => byId.get(id)).filter((r): r is PublicAlbum => !!r);
  const crates = [{ id: FAVORITES, name: 'Favorites', records: data.favorites }, ...data.crates];
  const current = crates.find((c) => c.id === place.crate) ?? crates.find((c) => real(c.records).length) ?? crates[0]!;
  const records = real(current.records);
  const index = records.length ? Math.min(place.crate === current.id ? place.index : 0, records.length - 1) : -1;
  const page = Math.max(0, Math.floor(index / PER_BIN));
  const pages = Math.max(1, Math.ceil(records.length / PER_BIN));
  const sel = index < 0 ? -1 : index % PER_BIN;
  const binRecords = records.slice(page * PER_BIN, (page + 1) * PER_BIN);
  const bin: Placed = { key: `${current.id}:${page}`, x: 0, z: 0, w: BW, bin: toBins(current.id, binRecords, PER_BIN)[0] ?? { section: current.id, index: 0, label: '', records: [] } };
  const record = index >= 0 ? records[index]! : null;
  const go = (i: number) => { setShown(false); onPlace({ crate: current.id, index: stepSel(index, i - index, records.length) }); };

  useEffect(() => {
    const d = dialog.current!;
    if (!d.open) d.showModal?.();
    const cancel = (e: Event) => { e.preventDefault(); if (shown) setShown(false); else onClose(); };
    d.addEventListener('cancel', cancel);
    return () => d.removeEventListener('cancel', cancel);
  }, [onClose, shown]);

  useEffect(() => {
    const on = () => setAspect(window.innerWidth / window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (typing(e.target) || e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || !record) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); go(index - 1); }
      if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); setShown((s) => !s); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  });

  useEffect(() => {
    const el = box.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      if (performance.now() - lastWheel.current < 90 || Math.abs(e.deltaY) < 2) return;
      lastWheel.current = performance.now();
      go(index + (e.deltaY > 0 ? 1 : -1));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  });

  const remove = () => {
    if (!record) return;
    setShown(false);
    update((d) => (current.id === FAVORITES ? toggleFavorite(d, record.id) : removeFromCrate(d, current.id, record.id)));
  };
  const shareUrl = `${window.location.origin}/?shared=${encodeShare({ name: current.name, records: current.records })}`;
  const copy = async () => {
    event('Share Link Copied', { records: current.records.length });
    try { await navigator.clipboard.writeText(shareUrl); setCopied(current.id); } catch { setCopied(`${current.id}:manual`); }
  };

  return (
    <dialog ref={dialog} aria-labelledby="crates-title" className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-[#1a1411] p-0 text-[#f3e6cf] backdrop:bg-black/60">
      <div
        ref={box}
        data-ready={ready}
        data-reduced-motion={String(reducedMotion())}
        className="absolute inset-0"
        style={{ touchAction: 'none' }}
        onPointerMove={(e) => {
          mouse.current = { x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight };
          if (drag.current && e.buttons === 0 && e.pointerType === 'mouse') drag.current = null; // released elsewhere
          if (drag.current) {
            const dy = e.clientY - drag.current.y;
            if (Math.abs(dy) >= 26) { go(index + (dy < 0 ? 1 : -1)); drag.current = { y: e.clientY, moved: true }; }
          }
        }}
        /* No pointer capture: it retargets the click to this div, so R3F never sees it and records can't be picked. */
        onPointerDown={(e) => { if (e.target instanceof HTMLCanvasElement) { drag.current = { y: e.clientY, moved: false }; } }}
        onPointerUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
        onPointerCancel={() => { drag.current = null; }}
      >
        <Canvas frameloop="demand" shadows dpr={quality.dpr} camera={{ position: [1.2, 2.1, 2.8], fov: 40, near: 0.05, far: 60 }} onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', lost, { once: true }); setReady(true); }}>
          <SteadyClock />
          <color attach="background" args={['#1a1411']} />
          <fog attach="fog" args={['#1a1411', 6, 16]} />
          <CameraRig aim={digAim(bin, sel, shown, aspect)} interactive={false} minDistance={0.5} />
          <RoomLights dim={shown} quality={quality} />
          <spotLight position={[0.5, 5, 1.5]} angle={0.55} penumbra={0.8} decay={1.4} intensity={60} color="#ffc27a" castShadow />
          <ShopMaterials room={STAGE}>
            <Floor />
            {binRecords.length ? (
              <DigBin
                p={bin}
                sel={sel}
                shown={shown}
                mouse={mouse}
                textured
                onPick={(i) => { if (drag.current?.moved) return; if (i === sel) setShown((s) => !s); else go(page * PER_BIN + i); }}
              />
            ) : <BinBox w={BW} kind="walnut" />}
          </ShopMaterials>
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-3 p-4 sm:p-6 [&_button]:pointer-events-auto [&_input]:pointer-events-auto">
        <div className="flex w-full items-start justify-between">
          <div>
            <h2 id="crates-title" className="font-serif text-3xl font-bold">My crates</h2>
            <p className="text-sm text-[#f3e6cf]/70">Saved in this browser only.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-11 w-11 place-items-center rounded-full border border-white/30 bg-[#1a1411]/70 backdrop-blur hover:bg-white/10"><span aria-hidden="true">×</span></button>
        </div>
        <nav aria-label="Your crates" className="max-w-full">
          <ul className="flex max-w-full gap-1 overflow-x-auto rounded-full border border-white/15 bg-[#1a1411]/70 p-1 backdrop-blur">
            {crates.map((c) => (
              <li key={c.id}>
                <button type="button" aria-pressed={c.id === current.id} onClick={() => { setRenaming(false); setShown(false); onPlace({ crate: c.id, index: 0 }); }}
                  className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm hover:bg-white/10 aria-pressed:bg-[#cdb27a] aria-pressed:text-[#1a1411]">
                  {c.name} <span className="opacity-60">{real(c.records).length}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        {current.id !== FAVORITES && (
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            {renaming ? (
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); setRenaming(false); }}>
                <input aria-label={`Rename ${current.name}`} defaultValue={current.name} maxLength={60} autoFocus onChange={(e) => update((d) => renameCrate(d, current.id, e.target.value))} className="rounded-full border border-white/30 bg-[#1a1411] px-3 py-1 text-[#f3e6cf]" />
                <button type="submit" className="underline-offset-4 hover:underline">Done</button>
              </form>
            ) : (
              <>
                <button type="button" onClick={copy} className="underline-offset-4 hover:underline">{copied === current.id ? 'Link copied' : 'Copy share link'}</button>
                <button type="button" onClick={() => setRenaming(true)} className="opacity-80 hover:opacity-100">Rename</button>
                <button type="button" onClick={() => update((d) => deleteCrate(d, current.id))} className="opacity-80 hover:opacity-100">Delete</button>
              </>
            )}
            {copied === `${current.id}:manual` && <input readOnly value={shareUrl} aria-label="Share link" className="w-full rounded border border-white/20 bg-[#1a1411] px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />}
          </div>
        )}
      </div>

      {!records.length && (
        <p className="pointer-events-none absolute inset-x-0 top-1/2 px-6 text-center font-serif text-2xl [text-shadow:0_2px_12px_rgb(0_0_0/0.8)]">
          {current.id === FAVORITES ? 'Nothing in here yet. Open a record and tap the heart.' : 'Nothing in here yet. Open a record and tap Add to crate.'}
        </p>
      )}

      {record && (
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 sm:p-6">
          <div className="pointer-events-none text-center [text-shadow:0_2px_12px_rgb(0_0_0/0.8)]">
            <p className={shown ? 'text-lg' : 'text-sm opacity-80'}>{record.artist}</p>
            <p className={`font-serif font-bold ${shown ? 'text-4xl' : 'text-2xl'}`}>{record.title}</p>
            <p className="mt-1 text-xs opacity-70">{index + 1} of {records.length}{pages > 1 ? ` · bin ${page + 1} of ${pages}` : ''}</p>
          </div>
          <p role="status" className="sr-only">{`${record.title} by ${record.artist}, ${index + 1} of ${records.length}`}</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {shown ? (
              <>
                <button type="button" onClick={() => onOpenRecord(record)} className={SOLID}>Open album</button>
                <button type="button" onClick={() => setShown(false)} className={GHOST}>Put back</button>
                <button type="button" onClick={remove} className={GHOST}>Remove</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => go(index - 1)} disabled={index === 0} className={GHOST}>Back</button>
                <button type="button" onClick={() => setShown(true)} className={SOLID}>Show</button>
                <button type="button" onClick={() => go(index + 1)} disabled={index >= records.length - 1} className={GHOST}>Flip</button>
              </>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}
