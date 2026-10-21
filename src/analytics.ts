// Vercel Web Analytics custom events (docs/decisions/009-analytics-events.md). Every event is listed here
// with its exact properties: at most two (the Pro plan's limit) and never anything a visitor typed.
// Page views only fire when the path changes, and the shop lives on "/", so these events are how
// record opens, digging and sharing show up at all.
import { track, type BeforeSend } from '@vercel/analytics';

type Events = {
  'Record Opened': { record: string; from: 'shop' | 'grid' | 'crates' | 'shared' | 'link' };
  'Bandcamp Clicked': { record: string; link: 'open-button' | 'player-fallback' | 'notes' };
  'Section Entered': { section: string };
  'View Switched': { to: 'store' | 'grid' };
  '3D Unavailable': { reason: 'unsupported' | 'crashed' };
  'Crate Action': { action: 'favorite' | 'add-to-crate' | 'new-crate'; record: string };
  'Shared Crate': { action: 'opened' | 'saved'; records: number };
  'Share Link Copied': { records: number };
  'Notes Expanded': { part: 'read-more' | 'credits' };
  Search: { results: 'some' | 'none' };
};

export function event<K extends keyof Events>(name: K, props: Events[K]): void {
  track(name, props);
}

/** One 3D Unavailable per browser session: a crash makes later loads look "unsupported" (support.ts). */
export function report3DTrouble(reason: Events['3D Unavailable']['reason']): void {
  try {
    if (window.sessionStorage.getItem('rl-3d-reported') !== null) return;
    window.sessionStorage.setItem('rl-3d-reported', reason);
  } catch {
    // Storage blocked: count it anyway; this visitor may be counted again on reload.
  }
  event('3D Unavailable', { reason });
}

/** "Makaya McCraven — Universal Beings", within Vercel's 255-character limit per value. */
export const recordLabel = (r: { artist: string; title: string }) => `${r.artist} — ${r.title}`.slice(0, 255);

/** The URL Vercel sees: path only. The query holds search text and shared crates (up to 16 KB). */
export function scrubUrl(href: string): string {
  const u = new URL(href);
  return `${u.origin}${u.pathname}`;
}

export const beforeSend: BeforeSend = (e) => ({ ...e, url: scrubUrl(e.url) });
