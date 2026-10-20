// The HTML layer over the shop: everything you can do in 3D has a button here too (spec: accessibility).
import { useEffect, useState, type ReactNode } from 'react';

type Props = { hint: ReactNode; onGrid: () => void; top?: ReactNode; footer?: ReactNode };

/** The site header's height (taller on phones, where search wraps), so the shop's controls sit just below it. */
function useHeaderBottom(): number {
  const [bottom, setBottom] = useState(96);
  useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    const measure = () => setBottom(header.getBoundingClientRect().bottom);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);
  return bottom;
}

export function ShopOverlay({ hint, onGrid, top, footer }: Props) {
  const headerBottom = useHeaderBottom();
  return (
    <>
      {top && <div className="pointer-events-none fixed inset-x-0 z-10 flex flex-col items-center gap-3 px-4 [&>*]:pointer-events-auto" style={{ top: headerBottom + 12 }}>{top}</div>}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 sm:p-6">
        {footer && <div className="pointer-events-auto">{footer}</div>}
        <div className="flex w-full items-end justify-between gap-4 text-xs text-[#f3e6cf]/75">
          <span>{hint}</span>
          <div className="pointer-events-auto flex rounded-full border border-ink/25 bg-card p-1" role="group" aria-label="View">
            <button type="button" aria-pressed="true" className="rounded-full bg-forest px-4 py-1.5 text-sm text-card">Store</button>
            <button type="button" aria-pressed="false" onClick={onGrid} className="rounded-full px-4 py-1.5 text-sm text-ink hover:bg-chip">Grid</button>
          </div>
        </div>
      </div>
    </>
  );
}
