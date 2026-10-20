// Discogs source: master search → master → main release (the original edition, not a reissue),
// falling back to a release search for small releases that have no master.
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import type { SourceFetcher } from './http.ts';
import { ranked, type Candidate } from './match.ts';

const API = 'https://api.discogs.com';
const tracks = (list: any[] | undefined) => (list ?? []).filter((t) => t.type_ === 'track').length || null;
/** Discogs dates can be "2018-00-00" or "2018-10-00"; keep only the known precision. */
const date = (s: unknown) => (typeof s === 'string' ? s.replace(/-00$/, '').replace(/-00$/, '') || undefined : undefined);
/** Search titles are "Artist - Title"; Discogs numbers same-name artists like "Name (2)". */
function split(title: string): { artist: string; title: string } {
  const i = title.indexOf(' - ');
  const artist = i < 0 ? '' : title.slice(0, i);
  return { artist: artist.replace(/\s*\(\d+\)$/, '').replace(/\*$/, ''), title: i < 0 ? title : title.slice(i + 3) };
}

function releaseFields(rel: any) {
  const label = rel?.labels?.[0];
  return {
    label: label?.name ? String(label.name).replace(/\s*\(\d+\)$/, '') : undefined, // "Brainfeeder (2)" → "Brainfeeder"
    catalogNumber: label?.catno && label.catno.toLowerCase() !== 'none' ? label.catno : undefined,
    releaseDate: date(rel?.released) ?? (rel?.year ? String(rel.year) : undefined),
    styles: rel?.styles?.length ? rel.styles : undefined,
  };
}

export function discogsSource(fetcher: SourceFetcher) {
  const search = async (r: PublicAlbum, type: 'master' | 'release') => {
    const q = `type=${type}&per_page=5&artist=${encodeURIComponent(r.artist)}&release_title=${encodeURIComponent(r.title)}`;
    const results = ((await fetcher.getJson(`${API}/database/search?${q}`)).body as any)?.results ?? [];
    const cands = results.map((x: any) => ({ id: x.id, c: { source: 'discogs', ...split(String(x.title ?? '')), trackCount: null, fields: {} } as Candidate }));
    const [best] = ranked(r, cands.map((x: any) => x.c));
    return best ? cands.find((x: any) => x.c === best)!.id : null;
  };

  return {
    name: 'discogs' as const,
    async candidates(r: PublicAlbum): Promise<Candidate[]> {
      const masterId = await search(r, 'master');
      if (masterId) {
        const master = (await fetcher.getJson(`${API}/masters/${masterId}`)).body as any;
        const main = master?.main_release ? ((await fetcher.getJson(`${API}/releases/${master.main_release}`)).body as any) : null;
        const fields = releaseFields(main);
        return [{
          source: 'discogs', artist: String(master?.artists?.[0]?.name ?? r.artist).replace(/\s*\(\d+\)$/, ''), title: String(master?.title ?? ''),
          trackCount: tracks(master?.tracklist) ?? tracks(main?.tracklist),
          fields: { ...fields, styles: master?.styles?.length ? master.styles : fields.styles },
        }];
      }
      const releaseId = await search(r, 'release');
      if (!releaseId) return [];
      const rel = (await fetcher.getJson(`${API}/releases/${releaseId}`)).body as any;
      return [{
        source: 'discogs', artist: String(rel?.artists?.[0]?.name ?? '').replace(/\s*\(\d+\)$/, ''), title: String(rel?.title ?? ''),
        trackCount: tracks(rel?.tracklist), fields: releaseFields(rel),
      }];
    },
  };
}
