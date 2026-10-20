import { describe, expect, test, vi } from 'vitest';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { bandcampFetcher, ensureCover, subsonicFetcher, type ImageFetcher } from '../../pipeline/covers.ts';

const jpeg = () => sharp({ create: { width: 1200, height: 1200, channels: 3, background: '#264653' } }).jpeg().toBuffer();
const dirs = () => {
  const root = mkdtempSync(join(tmpdir(), 'covers-'));
  return { cacheDir: join(root, 'cache'), outDir: join(root, 'out') };
};
const never: ImageFetcher = async () => { throw new Error('fetcher should not be called'); };
const deps = (fetchers: ImageFetcher[], d = dirs()) => ({ fetchers, ...d, onFallback: vi.fn() });

describe('ensureCover', () => {
  test('fetches, converts to 300px and 1000px WebP, and returns site paths plus palette', async () => {
    const d = deps([async () => jpeg()]);
    const r = await ensureCover('album-7', 99, d);
    expect(r.source).toBe('subsonic');
    expect(r.cover?.grid).toBe('/covers/album-7-300.webp');
    expect(r.cover?.large).toBe('/covers/album-7-1000.webp');
    expect(r.cover?.dominant).toMatch(/^#[0-9a-f]{6}$/);
    expect((await sharp(join(d.outDir, 'album-7-300.webp')).metadata()).width).toBe(300);
    expect((await sharp(join(d.outDir, 'album-7-1000.webp')).metadata()).width).toBe(1000);
  });

  test('a second run uses the cache and never calls a fetcher', async () => {
    const d = dirs();
    await ensureCover('album-7', 99, deps([async () => jpeg()], d));
    const r = await ensureCover('album-7', 99, deps([never], d));
    expect(r.source).toBe('cache');
    expect(r.cover?.grid).toBe('/covers/album-7-300.webp');
  });

  test('falls back to the second fetcher when the first has no image', async () => {
    const r = await ensureCover('album-7', 99, deps([async () => null, async () => jpeg()]));
    expect(r.source).toBe('bandcamp');
  });

  test('a fetcher that throws counts as no image and the next one is tried', async () => {
    const d = deps([async () => { throw new Error('getCoverArt: HTTP 500 three times in a row'); }, async () => jpeg()]);
    const r = await ensureCover('album-7', 99, d);
    expect(r.source).toBe('bandcamp');
    expect(d.onFallback).toHaveBeenCalledWith('fetch:ca:99', expect.any(Error));
  });

  test('no image anywhere, or no cover id, gives a null cover and writes nothing', async () => {
    const d = deps([async () => null, async () => null]);
    expect(await ensureCover('album-7', 99, d)).toEqual({ cover: null, source: 'none' });
    expect(existsSync(join(d.outDir, 'album-7-300.webp'))).toBe(false);
    expect(await ensureCover('album-7', null, deps([never]))).toEqual({ cover: null, source: 'none' });
  });
});

describe('fetchers return null unless they got an image', () => {
  const client = (res: Response) => ({ raw: async () => res });
  test('subsonic: HTML or HTTP 500 is not an image', async () => {
    const html = new Response('<html>', { status: 200, headers: { 'content-type': 'text/html' } });
    expect(await subsonicFetcher(client(html))(1)).toBeNull();
    expect(await subsonicFetcher(client(new Response('', { status: 500 })))(1)).toBeNull();
  });
  test('subsonic: asks getCoverArt for ca:<n> at 1200px', async () => {
    const raw = vi.fn(async () => new Response(await jpeg(), { status: 200, headers: { 'content-type': 'image/jpeg' } }));
    expect(await subsonicFetcher({ raw })(42)).toBeInstanceOf(Buffer);
    expect(raw).toHaveBeenCalledWith('getCoverArt', { id: 'ca:42', size: '1200' });
  });
  test('bandcamp: requests the verified image address and rejects non-images', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 404 }));
    expect(await bandcampFetcher(fetchImpl as unknown as typeof fetch)(42)).toBeNull();
    expect(fetchImpl).toHaveBeenCalledWith('https://f4.bcbits.com/img/a42_10.jpg');
  });
});
