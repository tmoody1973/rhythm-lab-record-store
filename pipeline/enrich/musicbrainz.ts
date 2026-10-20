// MusicBrainz source: release search, then (for the best match only) release and artist lookups.
// Rate limit: ≤ 1 request/second per IP, enforced by the fetcher (docs: musicbrainz.org/doc/MusicBrainz_API/Rate_Limiting).
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import type { SourceFetcher } from './http.ts';
import { ranked, type Candidate } from './match.ts';

const WS = 'https://musicbrainz.org/ws/2';
const quote = (s: string) => `"${s.replace(/["\\]/g, '\\$&')}"`;
const credit = (ac: any[] | undefined) => (ac ?? []).map((c) => `${c.name ?? ''}${c.joinphrase ?? ''}`).join('').trim();

export function musicbrainzSource(fetcher: SourceFetcher) {
  return {
    name: 'musicbrainz' as const,
    async candidates(r: PublicAlbum): Promise<Candidate[]> {
      const query = encodeURIComponent(`release:${quote(r.title)} AND artist:${quote(r.artist)}`);
      const found = (await fetcher.getJson(`${WS}/release?fmt=json&limit=3&query=${query}`)).body as any;
      const light = (found?.releases ?? []).map((x: any) => ({
        id: x.id as string,
        c: { source: 'musicbrainz', artist: credit(x['artist-credit']), title: String(x.title ?? ''), trackCount: x['track-count'] ?? null, fields: { releaseDate: x.date || undefined } } as Candidate,
      }));
      const [best] = ranked(r, light.map((l: any) => l.c));
      if (!best) return [];
      const id = light.find((l: any) => l.c === best)!.id;

      const rel = (await fetcher.getJson(`${WS}/release/${id}?fmt=json&inc=labels+url-rels+artist-credits`)).body as any;
      const info = (rel?.['label-info'] ?? []) as any[];
      const bandcamp = ((rel?.relations ?? []) as any[]).map((x) => String(x.url?.resource ?? '')).find((u) => /\.bandcamp\.com\//.test(u));
      const artistId = rel?.['artist-credit']?.[0]?.artist?.id;
      const artist = artistId ? ((await fetcher.getJson(`${WS}/artist/${artistId}?fmt=json`)).body as any) : null;

      return [{
        ...best,
        fields: {
          label: info.find((i) => i.label?.name)?.label?.name,
          catalogNumber: info.find((i) => i['catalog-number'])?.['catalog-number'],
          releaseDate: rel?.date || best.fields.releaseDate,
          bandcampUrl: bandcamp?.replace(/^http:/, 'https:'),
          artistCountry: artist?.country || undefined,
          artistArea: artist?.area?.name || undefined,
        },
      }];
    },
  };
}
