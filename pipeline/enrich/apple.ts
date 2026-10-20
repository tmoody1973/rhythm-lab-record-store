// Apple Music API source. Developer token: ES256 JWT { alg, kid } / { iss, iat, exp }, signed with the
// MusicKit .p8 key (developer.apple.com/documentation/applemusicapi/generating-developer-tokens).
import { createPrivateKey, sign } from 'node:crypto';
import type { PublicAlbum } from '../../src/catalog/schema.ts';
import type { SourceFetcher } from './http.ts';
import { ranked, type Candidate } from './match.ts';

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function appleToken(teamId: string, keyId: string, pem: string, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: keyId }));
  const claims = b64url(JSON.stringify({ iss: teamId, iat: nowSec, exp: nowSec + 3600 }));
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), { key: createPrivateKey(pem), dsaEncoding: 'ieee-p1363' });
  return `${header}.${claims}.${b64url(signature)}`;
}

export const APPLE_BASE = 'https://api.music.apple.com/v1';

/** Albums only: singles are albums named "X - Single", and song results carry no label. */
export function appleSource(fetcher: SourceFetcher) {
  return {
    name: 'apple' as const,
    async check(): Promise<void> {
      await fetcher.getJson(`${APPLE_BASE}/test`); // throws AuthError on 401/403
    },
    async candidates(r: PublicAlbum): Promise<Candidate[]> {
      const term = encodeURIComponent(`${r.artist} ${r.title}`);
      const res = await fetcher.getJson(`${APPLE_BASE}/catalog/us/search?types=albums&limit=5&term=${term}`);
      const data = (res.body as any)?.results?.albums?.data ?? [];
      return ranked(r, data.map((d: any): Candidate => ({
        source: 'apple',
        artist: String(d.attributes?.artistName ?? ''),
        title: String(d.attributes?.name ?? ''),
        trackCount: typeof d.attributes?.trackCount === 'number' ? d.attributes.trackCount : null,
        fields: { label: d.attributes?.recordLabel || undefined, releaseDate: d.attributes?.releaseDate || undefined },
      })));
    },
  };
}
