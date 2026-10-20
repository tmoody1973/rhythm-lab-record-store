import { useCallback, useEffect, useRef, useState } from 'react';
import { parseUrl, toSearch, type UrlState } from './url.ts';

type Patch = (patch: Partial<UrlState>, opts?: { push?: boolean }) => void;

/**
 * URL-backed state. Changing a filter or the sort returns to page 1 unless a page is given.
 * `push: true` (used when opening a record) adds a history entry, so browser Back closes the pop-up.
 * The history call happens here, never inside a setState updater: React may run updaters twice
 * (StrictMode), which pushed duplicate entries and broke Back.
 */
export function useAppState(): [UrlState, Patch] {
  const [state, setState] = useState<UrlState>(() => parseUrl(window.location.search));
  const current = useRef(state);

  useEffect(() => {
    const onPop = () => {
      current.current = parseUrl(window.location.search);
      setState(current.current);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update: Patch = useCallback((patch, opts) => {
    const prev = current.current;
    const filterChanged = ['q', 'genres', 'crate', 'sort'].some((k) => k in patch);
    const next = { ...prev, ...(filterChanged && !('page' in patch) ? { page: 1 } : {}), ...patch };
    current.current = next;
    const url = `${window.location.pathname}${toSearch(next)}`;
    if (opts?.push) window.history.pushState(null, '', url);
    else window.history.replaceState(null, '', url);
    setState(next);
  }, []);

  return [state, update];
}
