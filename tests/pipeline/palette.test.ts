import { describe, expect, test, vi } from 'vitest';
import sharp from 'sharp';
import { contrast, extractPalette, fallbackPalette, paletteOrFallback } from '../../pipeline/palette.ts';

const solid = (hex: string) =>
  sharp({ create: { width: 60, height: 90, channels: 3, background: hex } }).jpeg().toBuffer();

const near = (hex: string, target: string, tol = 16) => {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  return ch(hex).every((v, i) => Math.abs(v - ch(target)[i]!) <= tol);
};

describe('extractPalette', () => {
  test('a solid cover is its own dominant colour', async () => {
    const p = await extractPalette(await solid('#1f3a5f'));
    expect(near(p.dominant, '#1f3a5f')).toBe(true);
    expect(contrast(p.text, p.dominant)).toBeGreaterThanOrEqual(4.5);
  });

  test('a white-bordered cover keeps white as dominant (border counts double)', async () => {
    const centre = await sharp({ create: { width: 30, height: 50, channels: 3, background: '#c4572e' } }).png().toBuffer();
    const img = await sharp({ create: { width: 60, height: 90, channels: 3, background: '#ffffff' } })
      .composite([{ input: centre, left: 15, top: 20 }]).jpeg().toBuffer();
    const p = await extractPalette(img);
    expect(near(p.dominant, '#ffffff', 24)).toBe(true);
    expect(contrast(p.text, p.dominant)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('fallbacks', () => {
  test('an undecodable image gives the deterministic fallback and reports it', async () => {
    const onFallback = vi.fn();
    const p = await paletteOrFallback('a:1', Buffer.from('not an image'), onFallback);
    expect(p).toEqual(fallbackPalette('a:1'));
    expect(onFallback).toHaveBeenCalledOnce();
    expect(fallbackPalette('a:1')).toEqual(fallbackPalette('a:1'));
  });
});
