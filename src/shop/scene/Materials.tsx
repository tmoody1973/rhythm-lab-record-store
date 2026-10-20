// Shared materials for the room and bins. They start as flat colours so the shop is usable at once, then the CC0
// brick, plank and walnut textures are applied when (and only if) `npm run decor` produced them.
import { useTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { createContext, Suspense, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import { DecorManifestSchema, decorUrls, type DecorUrls } from '../decor.ts';
import type { Room } from '../layout.ts';

export type Mats = Record<'brick' | 'floor' | 'walnut' | 'walnutDark' | 'green' | 'natural' | 'plaster' | 'trim', THREE.MeshStandardMaterial>;
type Shop = { mats: Mats; decor: DecorUrls | null };

const ShopContext = createContext<Shop | null>(null);
export const useMats = () => useContext(ShopContext)!.mats;
export const useDecor = () => useContext(ShopContext)!.decor;

const flat = (color: string, roughness = 0.8) => new THREE.MeshStandardMaterial({ color, roughness });

/** Fetches public/decor/manifest.json once; a missing or invalid manifest means flat colours. */
function useDecorManifest(): DecorUrls | null {
  const [urls, setUrls] = useState<DecorUrls | null>(null);
  useEffect(() => {
    let live = true;
    fetch('/decor/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { const m = DecorManifestSchema.safeParse(j); if (live) setUrls(decorUrls(m.success ? m.data : null)); })
      .catch(() => {});
    return () => { live = false; };
  }, []);
  return urls;
}

function tiled(t: THREE.Texture, x: number, y: number, srgb: boolean) {
  const c = t.clone();
  c.wrapS = c.wrapT = THREE.RepeatWrapping;
  c.repeat.set(x, y);
  if (srgb) c.colorSpace = THREE.SRGBColorSpace;
  c.needsUpdate = true;
  return c;
}

function ApplyTextures({ urls, mats, room }: { urls: DecorUrls; mats: Mats; room: Room }) {
  const t = useTexture([urls.brick.map, urls.brick.normal, urls.floor.map, urls.floor.normal, urls.walnut.map, urls.walnut.normal]);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const [brick, brickN, planks, planksN, walnut, walnutN] = t as THREE.Texture[];
    const depth = (room.frontZ - room.backZ) / 16;
    const set = (m: THREE.MeshStandardMaterial, color: string, map: THREE.Texture, normal?: THREE.Texture) => {
      m.map = map; m.normalMap = normal ?? null; m.color.set(color); m.needsUpdate = true;
    };
    set(mats.brick, '#b9907a', tiled(brick!, 9, 1.4, true), tiled(brickN!, 9, 1.4, false));
    set(mats.floor, '#8a6a52', tiled(planks!, 5, 3.5 * depth, true), tiled(planksN!, 5, 3.5 * depth, false));
    set(mats.walnut, '#a77b5a', tiled(walnut!, 1, 1, true), tiled(walnutN!, 1, 1, false));
    set(mats.walnutDark, '#6e4d36', tiled(walnut!, 1, 1, true));
    invalidate();
  }, [t, mats, room, invalidate]);
  return null;
}

export function ShopMaterials({ room, children }: { room: Room; children: ReactNode }) {
  const decor = useDecorManifest();
  const mats = useMemo<Mats>(() => ({
    brick: flat('#6b2e22', 0.95), floor: flat('#2e1d12', 0.85), walnut: flat('#4a2c18', 0.7), walnutDark: flat('#2b190d', 0.7),
    green: flat('#2f5d3f'), natural: flat('#9b7748'), plaster: flat('#2c3a31', 0.9), trim: flat('#3a2a20', 0.9),
  }), []);
  return (
    <ShopContext.Provider value={{ mats, decor }}>
      {decor && <Suspense fallback={null}><ApplyTextures urls={decor} mats={mats} room={room} /></Suspense>}
      {children}
    </ShopContext.Provider>
  );
}
