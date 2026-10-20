// npm run decor — downloads the shop's CC0 decor from Poly Haven (polyhaven.com, public domain) into public/decor/.
// Like the covers, these are generated locally and not committed. Re-running skips files already present.
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const OUT = 'public/decor';
const MODELS = ['potted_plant_02', 'potted_plant_04'];
const TEXTURES = ['brick_wall_02', 'dark_wooden_planks', 'black_walnut_veneer_01'];
const API = 'https://api.polyhaven.com/files/';
type FileRef = { url: string; size: number };

async function save(url: string, path: string) {
  if (existsSync(path)) return;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
  console.log('saved', path);
}
const files = async (id: string) => (await fetch(API + id)).json() as Promise<Record<string, any>>;

for (const id of MODELS) {
  const g = (await files(id)).gltf['1k'].gltf as FileRef & { include: Record<string, FileRef> };
  await save(g.url, join(OUT, id, `${id}.gltf`));
  for (const [rel, f] of Object.entries(g.include)) await save(f.url, join(OUT, id, rel));
}
for (const id of TEXTURES) {
  const f = await files(id);
  await save(f.Diffuse['1k'].jpg.url, join(OUT, `${id}_diff.jpg`));
  await save(f.nor_gl['1k'].jpg.url, join(OUT, `${id}_nor.jpg`));
}
console.log('decor ready in', OUT);
