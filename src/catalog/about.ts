// Album notes from each record's public Bandcamp page (public/about/<compact id>.json), written by
// `npm run about` and loaded by the pop-up for one record at a time. Plain text only, never HTML.
import { useEffect, useState } from 'react';
import { z } from 'zod';
import { BANDCAMP_URL } from './enrichment.ts';
import { toCompact } from './ids.ts';

export const MAX_TEXT = 20_000;
export const MAX_TAGS = 30;

export const AboutSchema = z.object({
  url: z.string().regex(BANDCAMP_URL).optional(),
  description: z.string().min(1).max(MAX_TEXT).optional(),
  credits: z.string().min(1).max(MAX_TEXT).optional(),
  tags: z.array(z.string().min(1).max(100)).max(MAX_TAGS).optional(),
});
export type About = z.infer<typeof AboutSchema>;

/** Missing, invalid or empty → null; never an error for visitors. */
export async function loadAbout(recordId: string, fetchImpl: typeof fetch = fetch): Promise<About | null> {
  const compact = toCompact(recordId);
  if (!compact) return null;
  try {
    const res = await fetchImpl(`/about/${compact}.json`);
    if (!res.ok || res.headers.get('content-type')?.includes('text/html')) return null;
    const parsed = AboutSchema.safeParse(JSON.parse(await res.text()));
    const a = parsed.success ? parsed.data : null;
    return a && (a.description || a.credits || a.tags?.length) ? a : null;
  } catch {
    return null;
  }
}

export function useAbout(recordId: string): About | null {
  const [about, setAbout] = useState<About | null>(null);
  useEffect(() => {
    let live = true;
    setAbout(null);
    loadAbout(recordId).then((a) => live && setAbout(a));
    return () => { live = false; };
  }, [recordId]);
  return about;
}
