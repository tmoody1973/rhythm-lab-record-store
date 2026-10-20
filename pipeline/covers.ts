// Self-hosted covers: fetch once (Subsonic first, Bandcamp's public image server as fallback),
// keep the original in the cache, write 300px and 1000px WebP for the site, cache the palette.
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import type { Cover } from '../src/catalog/schema.ts';
import { paletteOrFallback, type Palette } from './palette.ts';

export type ImageFetcher = (coverId: number) => Promise<Buffer | null>;
type CoverSource = 'cache' | 'subsonic' | 'bandcamp' | 'none';
// Fetcher position → source label in the summary (catalog.ts passes [subsonic, bandcamp]).
const FETCHER_SOURCES = ['subsonic', 'bandcamp'] as const;
const SIZES = [300, 1000] as const;

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

type Deps = { fetchers: ImageFetcher[]; cacheDir: string; outDir: string; onFallback: (key: string, err: Error) => void };

export async function ensureCover(
  albumId: number, coverId: number | null, deps: Deps,
): Promise<{ cover: Cover | null; source: CoverSource }> {
  if (coverId === null) return { cover: null, source: 'none' };
  const original = join(deps.cacheDir, `${coverId}.jpg`);
  const paletteFile = join(deps.cacheDir, `${coverId}.palette.json`);
  const outputs = SIZES.map((s) => join(deps.outDir, `${albumId}-${s}.webp`));

  let image: Buffer | null = null;
  let source: CoverSource = 'cache';
  if (existsSync(original)) image = await readFile(original);
  else {
    for (const [i, fetcher] of deps.fetchers.entries()) {
      image = await fetcher(coverId);
      if (image) {
        source = FETCHER_SOURCES[i] ?? 'bandcamp';
        break;
      }
    }
    if (!image) return { cover: null, source: 'none' };
    await mkdir(deps.cacheDir, { recursive: true });
    await writeFile(original, image);
  }

  await mkdir(deps.outDir, { recursive: true });
  for (const [i, size] of SIZES.entries()) {
    if (!existsSync(outputs[i]!)) await sharp(image).resize(size, size, { fit: 'cover' }).webp({ quality: 80 }).toFile(outputs[i]!);
  }

  let palette: Palette;
  if (existsSync(paletteFile)) palette = JSON.parse(await readFile(paletteFile, 'utf8'));
  else {
    palette = await paletteOrFallback(`ca:${coverId}`, image, deps.onFallback);
    await writeFile(paletteFile, JSON.stringify(palette));
  }

  return {
    cover: { grid: `/covers/${albumId}-300.webp`, large: `/covers/${albumId}-1000.webp`, ...palette },
    source,
  };
}
