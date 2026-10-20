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

/** Bandcamp's embedded player, tinted to the pop-up card (#f3efe8) and forest links (#364c43). */
export function embedUrl(r: Pick<PublicAlbum, 'kind' | 'bandcampId'>): string {
  return `https://bandcamp.com/EmbeddedPlayer/${r.kind}=${r.bandcampId}/size=large/bgcol=f3efe8/linkcol=364c43/tracklist=true/transparent=true/`;
}
