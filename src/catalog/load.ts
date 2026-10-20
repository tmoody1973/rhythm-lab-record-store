import { useEffect, useState } from 'react';
import { CatalogSchema, type Catalog } from './schema.ts';

export type LoadFailure = 'missing' | 'invalid' | 'network';
export type LoadResult = { ok: true; catalog: Catalog } | { ok: false; reason: LoadFailure };

/** Fetches and validates /catalog.json (written by `npm run catalog`). Never throws. */
export async function loadCatalog(fetchImpl: typeof fetch = fetch): Promise<LoadResult> {
  let res: Response;
  try {
    res = await fetchImpl('/catalog.json');
  } catch {
    return { ok: false, reason: 'network' };
  }
  if (res.status === 404) return { ok: false, reason: 'missing' };
  // Dev servers and SPA hosts answer a missing file with the app's index.html (status 200).
  if (res.headers.get('content-type')?.includes('text/html')) return { ok: false, reason: 'missing' };
  if (!res.ok) return { ok: false, reason: 'network' };
  try {
    const parsed = CatalogSchema.safeParse(JSON.parse(await res.text()));
    return parsed.success ? { ok: true, catalog: parsed.data } : { ok: false, reason: 'invalid' };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}

export type CatalogState = { status: 'loading' } | { status: 'ready'; catalog: Catalog } | { status: 'error'; reason: LoadFailure };

export function useCatalog(): CatalogState {
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  useEffect(() => {
    let live = true;
    loadCatalog().then((r) => live && setState(r.ok ? { status: 'ready', catalog: r.catalog } : { status: 'error', reason: r.reason }));
    return () => { live = false; };
  }, []);
  return state;
}
