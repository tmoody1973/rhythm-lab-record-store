import { useCallback, useEffect, useState } from 'react';
import { parseUrl, toSearch, type UrlState } from './url.ts';

type Patch = (patch: Partial<UrlState>, opts?: { push?: boolean }) => void;

/**
 * URL-backed state. Changing a filter or the sort returns to page 1 unless a page is given.
 * `push: true` (used when opening a record) adds a history entry, so browser Back closes the pop-up.
 */
export function useAppState(): [UrlState, Patch] {
  const [state, setState] = useState<UrlState>(() => parseUrl(window.location.search));

  useEffect(() => {
    const onPop = () => setState(parseUrl(window.location.search));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const update: Patch = useCallback((patch, opts) => {
    setState((prev) => {
      const filterChanged = ['q', 'genres', 'crate', 'sort'].some((k) => k in patch);
      const next = { ...prev, ...(filterChanged && !('page' in patch) ? { page: 1 } : {}), ...patch };
      const url = `${window.location.pathname}${toSearch(next)}`;
      if (opts?.push) window.history.pushState(null, '', url);
      else window.history.replaceState(null, '', url);
      return next;
    });
  }, []);

  return [state, update];
}
