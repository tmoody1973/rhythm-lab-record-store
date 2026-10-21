// Bandcamp's own notes, in Bandcamp's page order: about, credits, tags. Long text shows four lines
// and opens in place; credits start folded so a phone screen isn't a wall of text. Plain text only.
import { useState } from 'react';
import type { About } from '../catalog/about.ts';

// ponytail: length heuristic instead of measuring overflow; a 4-line preview holds ~320 characters on a phone.
const isLong = (s: string) => s.length > 320 || s.split('\n').length > 4;

export function AlbumAbout({ about }: { about: About }) {
  const [open, setOpen] = useState(false);
  const { description, credits, tags, url } = about;
  const long = description ? isLong(description) : false;

  return (
    <section aria-labelledby="album-about" className="mt-6 max-w-[65ch]">
      <h3 id="album-about" className="text-xs uppercase tracking-[0.25em] text-ink-soft">About this record</h3>
      {description && (
        <>
          <p className={`mt-3 whitespace-pre-line font-serif text-[1.0625rem] leading-relaxed sm:text-lg ${long && !open ? 'line-clamp-4' : ''}`}>
            {description}
          </p>
          {long && (
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpen(!open)}
              className="mt-2 min-h-11 text-sm font-medium text-forest underline underline-offset-4 hover:text-forest-ink focus-visible:outline-2 focus-visible:outline-forest"
            >
              {open ? 'Show less' : 'Read more'}
            </button>
          )}
        </>
      )}
      {credits && (
        <details className="mt-4 border-t border-line pt-3">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium">Credits</summary>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{credits}</p>
        </details>
      )}
      {tags && tags.length > 0 && (
        <ul aria-label="Bandcamp tags" className="mt-4 flex flex-wrap gap-2">
          {tags.map((t) => <li key={t} className="rounded-full border border-line bg-chip px-3 py-1 text-sm">{t}</li>)}
        </ul>
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-ink-soft underline-offset-4 hover:underline">
          From the Bandcamp page <span aria-hidden="true">↗</span>
        </a>
      )}
    </section>
  );
}
