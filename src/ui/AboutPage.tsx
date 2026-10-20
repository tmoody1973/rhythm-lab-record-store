import type { ReactNode } from 'react';
import { Wordmark } from './Header.tsx';

// Facts about the show come only from Radio Milwaukee, Madison365 and WXPN (cited in the PR). Tarik reviews this wording.
const LINK = 'rounded-sm text-forest underline decoration-forest/40 underline-offset-4 hover:decoration-forest focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest';

function A({ href, children }: { href: string; children: ReactNode }) {
  return <a href={href} className={LINK}>{children}</a>;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      <div className="mt-5 space-y-4 text-lg leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

const STEPS: ReactNode[] = [
  <>
    <strong className="text-ink">The collection comes straight from Bandcamp.</strong> It's read through Bandcamp's official
    Subsonic service (a standard way for music apps to read a library, which Bandcamp offers to fans) using Tarik's own login.
    Each cover is downloaded once and served from this site.
  </>,
  <>
    <strong className="text-ink">Details are added only when sources agree.</strong> Labels, release years, countries and
    styles come from Apple Music, MusicBrainz and Discogs. A detail is shown only when the services agree on it; otherwise it
    stays blank. Blank beats wrong. Once an artist's country is confirmed, their other records share it.
  </>,
  <>
    <strong className="text-ink">Your picks stay with you.</strong> This is a static site (plain files, with no server or
    accounts behind it). Your hearts and crates are saved only in your own browser, and a share link carries the whole crate
    inside the link itself.
  </>,
  <>
    <strong className="text-ink">Listening goes through Bandcamp.</strong> Records play in Bandcamp's own embedded player, and
    every record links back to Bandcamp, where buying supports the artists.
  </>,
  <>
    <strong className="text-ink">A 3D record shop is next.</strong> A walk-in record-shop view is in progress.
  </>,
];

export function AboutPage() {
  return (
    <>
      <header className="border-b border-line bg-paper/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-3 sm:px-8">
          <Wordmark />
          <a
            href="/"
            className="shrink-0 rounded-full border border-ink/40 bg-card px-4 py-2 text-sm font-medium hover:bg-chip focus-visible:outline-2 focus-visible:outline-forest"
          >
            <span aria-hidden="true">← </span>Back to the shop
          </a>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-8 sm:py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-ink-soft">The record store</p>
        <h1 className="mt-2 font-serif text-5xl font-bold tracking-tight text-ink sm:text-7xl">About</h1>
        <p className="mt-4 text-lg text-ink-soft sm:text-2xl">A radio DJ's record collection, opened up for anyone to dig through.</p>

        <div className="mt-12 space-y-12">
          <Section title="About Rhythm Lab">
            <p>
              Rhythm Lab Radio is a weekly music show hosted by Tarik Moody on 88Nine Radio Milwaukee. It mixes jazz, electronic,
              hip-hop and soul, and all the music in between, and introduces artists who don't fit neatly in one box.
            </p>
            <p>
              Tarik started the show in 2005 on Minnesota Public Radio, and it moved to Milwaukee in 2007. It's syndicated to
              stations including WXPN in Philadelphia and WUNC in Chapel Hill.
            </p>
            <p>
              Show prep means digging through Tarik's Bandcamp collection of about 1,200 purchases. This site opens that crate to
              everyone.
            </p>
            <p className="flex flex-wrap gap-x-6 gap-y-2">
              <A href="https://radiomilwaukee.org/rhythm-lab-radio-syndication">Rhythm Lab Radio on Radio Milwaukee</A>
              <A href="https://bandcamp.com/rhythmlab">Tarik's Bandcamp collection</A>
            </p>
          </Section>

          <Section title="How it works">
            <ol className="space-y-5">
              {STEPS.map((step, i) => (
                <li key={i} className="flex gap-4">
                  <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-sm font-medium text-card">
                    {i + 1}
                  </span>
                  <p className="min-w-0">{step}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="The code">
            <p>
              Open source under the MIT licence. Read it, borrow it, or build your own crate:{' '}
              <A href="https://github.com/tmoody1973/rhythm-lab-record-store">the Rhythm Lab Record Store on GitHub</A>.
            </p>
          </Section>

          <Section title="Inspirations & credits">
            <ul className="space-y-4">
              <li>
                <A href="https://github.com/chrija76/bookshelf">chrija76/bookshelf</A>: a personal library you browse as a 3D room.
                Its code for picking out each cover's colours is ported here (MIT licence).
              </li>
              <li>
                <A href="https://github.com/risq/cratedigger">risq/cratedigger</A>: 3D crate-digging in the browser (MIT licence).
                Its digging motion shapes the shop.
              </li>
              <li>
                <A href="https://polyhaven.com">Poly Haven</A>: free textures and plants for the shop, released as CC0 (public
                domain, free for anyone to use).
              </li>
              <li>
                Record details from Apple Music, <A href="https://musicbrainz.org">MusicBrainz</A> and{' '}
                <A href="https://www.discogs.com">Discogs</A>.
              </li>
              <li>Album art © its owners. Powered by Bandcamp.</li>
            </ul>
          </Section>
        </div>
      </main>
    </>
  );
}
