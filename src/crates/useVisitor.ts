import { useCallback, useEffect, useRef, useState } from 'react';
import { loadVisitorData, saveVisitorData, type VisitorData } from './storage.ts';

export type VisitorNotice = 'unavailable' | 'reset' | null;

/** Visitor data in React state, saved to localStorage after each change (in an effect, never in an updater). */
export function useVisitor(): { data: VisitorData; update: (f: (d: VisitorData) => VisitorData) => void; notice: VisitorNotice; dismiss: () => void } {
  const [initial] = useState(() => loadVisitorData());
  const [data, setData] = useState(initial.data);
  const [notice, setNotice] = useState<VisitorNotice>(initial.notice);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!saveVisitorData(data)) setNotice('unavailable');
  }, [data]);

  const update = useCallback((f: (d: VisitorData) => VisitorData) => setData((d) => f(d)), []);
  return { data, update, notice, dismiss: () => setNotice(null) };
}
