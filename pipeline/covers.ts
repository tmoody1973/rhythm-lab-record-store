// Self-hosted covers: fetch once (Subsonic first, Bandcamp's public image server as fallback),
// keep the original in the cache, write 300px and 1000px WebP for the site, cache the palette.
// An image is only cached once it decodes, and every file is written atomically, so a bad
// download or a Ctrl-C can never leave a file that breaks later runs or gets served half-written.
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Cover } from '../src/catalog/schema.ts';
import { paletteOrFallback, type Palette } from './palette.ts';

export type ImageFetcher = (coverId: number) => Promise<Buffer | null>;
type CoverSource = 'cache' | 'subsonic' | 'bandcamp' | 'none';
// Fetcher position → source label in the summary (catalog.ts passes [subsonic, bandcamp]).
const FETCHER_SOURCES = ['subsonic', 'bandcamp'] as const;
const SIZES = [300, 1000] as const;
const NONE = { cover: null, source: 'none' } as const;

async function imageOrNull(res: Response): Promise<Buffer | null> {
  if (res.status !== 200 || !res.headers.get('content-type')?.startsWith('image/')) return null;
  return Buffer.from(await res.arrayBuffer());
}

export function subsonicFetcher(client: { raw: (endpoint: string, params: Record<string, string>) => Promise<Response> }): ImageFetcher {
  return async (coverId) => imageOrNull(await client.raw('getCoverArt', { id: `ca:${coverId}`, size: '1200' }));
}

export function bandcampFetcher(fetchImpl: typeof fetch = fetch): ImageFetcher {
  return async (coverId) => imageOrNull(await fetchImpl(`https://f4.bcbits.com/img/a${coverId}_10.jpg`));
}

async function writeAtomic(path: string, data: Buffer | string): Promise<void> {
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, data);
  await rename(tmp, path);
}

type Deps = { fetchers: ImageFetcher[]; cacheDir: string; outDir: string; onFallback: (key: string, err: Error) => void };

export async function ensureCover(
  fileKey: string, coverId: number | null, deps: Deps,
): Promise<{ cover: Cover | null; source: CoverSource }> {
  if (coverId === null) return NONE;
  const original = join(deps.cacheDir, `${coverId}.jpg`);
  const paletteFile = join(deps.cacheDir, `${coverId}.palette.json`);
  // The cover id is in the name: new artwork gets new files, so browsers never keep the old image.
  const base = `${fileKey}-ca${coverId}`;
  const outputs = SIZES.map((s) => join(deps.outDir, `${base}-${s}.webp`));
  const toCover = (p: Palette): Cover => ({ grid: `/covers/${base}-300.webp`, large: `/covers/${base}-1000.webp`, ...p });

  if (outputs.every((f) => existsSync(f)) && existsSync(paletteFile)) {
    return { cover: toCover(JSON.parse(await readFile(paletteFile, 'utf8'))), source: 'cache' };
  }

  const candidates: [CoverSource, () => Promise<Buffer | null>][] = [];
  if (existsSync(original)) candidates.push(['cache', () => readFile(original)]);
  deps.fetchers.forEach((f, i) => candidates.push([FETCHER_SOURCES[i] ?? 'bandcamp', () => f(coverId)]));

  for (const [source, get] of candidates) {
    let image: Buffer | null;
    try {
      image = await get();
    } catch (e) {
      deps.onFallback(`fetch:ca:${coverId}`, e as Error); // e.g. Subsonic 5xx: try the next source.
      continue;
    }
    if (!image) continue;

    let rendered: Buffer[];
    try {
      rendered = await Promise.all(SIZES.map((s) => sharp(image).resize(s, s, { fit: 'cover' }).webp({ quality: 80 }).toBuffer()));
    } catch (e) {
      deps.onFallback(`decode:ca:${coverId}`, e as Error); // Corrupt or truncated: never cache it.
      if (source === 'cache') await rm(original, { force: true });
      continue;
    }

    await mkdir(deps.cacheDir, { recursive: true });
    await mkdir(deps.outDir, { recursive: true });
    if (source !== 'cache') await writeAtomic(original, image);
    for (const [i, file] of outputs.entries()) await writeAtomic(file, rendered[i]!);
    const palette = await paletteOrFallback(`ca:${coverId}`, image, deps.onFallback);
    await writeAtomic(paletteFile, JSON.stringify(palette));
    return { cover: toCover(palette), source };
  }
  return NONE;
}
