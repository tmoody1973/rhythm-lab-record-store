// The one place record ids are converted. Catalog ids: bandcamp:album:<n> / bandcamp:track:<n>.
// Compact ids (URLs, share links): a<n> / t<n>. Album and track numbers are separate spaces.
import type { PublicAlbum } from './schema.ts';

export function toCompact(id: string): string | null {
  const m = /^bandcamp:(album|track):(\d+)$/.exec(id);
  return m ? `${m[1] === 'album' ? 'a' : 't'}${m[2]}` : null;
}

export function fromCompact(c: string): string | null {
  const m = /^([at])(\d+)$/.exec(c);
  return m ? `bandcamp:${m[1] === 'a' ? 'album' : 'track'}:${m[2]}` : null;
}

/**
 * Bandcamp's embedded player, tinted to the pop-up card (#f3efe8) and forest links (#364c43).
 * Small artwork because the pop-up already shows the cover; a tracklist only for albums.
 */
export function embedUrl(r: Pick<PublicAlbum, 'kind' | 'bandcampId'>): string {
  return `https://bandcamp.com/EmbeddedPlayer/${r.kind}=${r.bandcampId}/size=large/bgcol=f3efe8/linkcol=364c43/artwork=small/tracklist=${r.kind === 'album'}/transparent=true/`;
}

/** Height Bandcamp's large player needs: header plus one row per track (capped; the player scrolls beyond). */
export function embedHeight(r: Pick<PublicAlbum, 'kind' | 'songCount'>): number {
  return r.kind === 'track' ? 120 : Math.min(142 + 33 * Math.max(1, r.songCount), 472);
}
