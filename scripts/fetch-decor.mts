// npm run decor — downloads the shop's CC0 decor from Poly Haven (polyhaven.com, public domain), slims it for the
// web, and writes it to public/decor/ with a manifest. Like the covers, it's generated locally and not committed.
// Raw downloads are cached in data/.cache/decor/ so re-runs don't fetch again. Budget: public/decor ≤ 3 MB.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { DECOR_FILES, type DecorManifest } from '../src/shop/decor.ts';

const OUT = 'public/decor';
const CACHE = 'data/.cache/decor';
const API = 'https://api.polyhaven.com/files/';
const TEXTURES = ['brick_wall_02', 'dark_wooden_planks', 'black_walnut_veneer_01'];
// The lush plant is ~70k polygons as scanned; keep ~30% of it. The small one is already light.
const PLANTS: { id: string; ratio: number | null }[] = [{ id: 'potted_plant_02', ratio: 0.3 }, { id: 'potted_plant_04', ratio: null }];
type FileRef = { url: string };

async function cached(url: string, path: string): Promise<string> {
  if (!existsSync(path)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} for ${url}`);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}
const files = async (id: string) => (await fetch(API + id)).json() as Promise<Record<string, any>>;
function gltf(...args: string[]) {
  const r = spawnSync('node_modules/.bin/gltf-transform', args, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`gltf-transform ${args[0]} failed`);
}

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

for (const id of TEXTURES) {
  const f = await files(id);
  for (const [kind, ref] of [['diff', f.Diffuse['1k'].jpg], ['nor', f.nor_gl['1k'].jpg]] as const) {
    const raw = await cached((ref as FileRef).url, join(CACHE, `${id}_${kind}.jpg`));
    await sharp(raw).resize(1024, 1024, { fit: 'inside' }).webp({ quality: 80 }).toFile(join(OUT, `${id}_${kind}.webp`));
  }
}

for (const { id, ratio } of PLANTS) {
  const g = (await files(id)).gltf['1k'].gltf as FileRef & { include: Record<string, FileRef> };
  const src = await cached(g.url, join(CACHE, id, `${id}.gltf`));
  for (const [rel, f] of Object.entries(g.include)) await cached(f.url, join(CACHE, id, rel));
  const tmp = join(CACHE, `${id}.tmp.glb`);
  if (ratio) gltf('simplify', src, tmp, '--ratio', String(ratio), '--error', '0.001');
  else gltf('copy', src, tmp);
  gltf('resize', tmp, tmp, '--width', '512', '--height', '512');
  gltf('webp', tmp, join(OUT, `${id}.glb`));
}

const manifest: DecorManifest = { version: 1, files: [...DECOR_FILES] };
for (const f of manifest.files) if (!existsSync(join(OUT, f))) throw new Error(`missing ${f}`);
await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest));

const sizes = await Promise.all((await readdir(OUT)).map(async (f) => (await stat(join(OUT, f))).size));
console.log(`decor ready in ${OUT}: ${(sizes.reduce((a, b) => a + b, 0) / 1e6).toFixed(2)} MB`);
