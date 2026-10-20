// SPIKE (throwaway): the shop's eight sections. Every record lands in exactly one, so together they hold all of it.
// Genre groupings proposed by Claude from the real counts (2026-10-20); Tarik hasn't signed them off yet.
import type { PublicAlbum } from '../catalog/schema.ts';

export type Section = {
  id: string;
  name: string;
  genres: string[]; // Bandcamp genre strings, lower case
  /** Floor rectangle: centre x/z and size, in metres-ish. Back wall is at z = -8, left wall at x = -12. */
  x: number; z: number; w: number; d: number;
  crates?: boolean; // milk crates by the door instead of walnut bins
};

export const SECTIONS: Section[] = [
  // Layout follows the gpt-image-2 mockup (2026-10-20): Electronic along the brick back wall, two big islands,
  // two medium ones in front, a front row of small sections, Fresh Crates by the door.
  { id: 'electronic', name: 'Electronic', genres: ['electronic', 'ambient'], x: -1.6, z: -6.4, w: 17.2, d: 1.4 },
  { id: 'soul-funk', name: 'Soul & Funk', genres: ['r&b soul', 'funk', 'blues'], x: -5, z: -2.4, w: 7.2, d: 2.8 },
  { id: 'hip-hop', name: 'Hip-Hop', genres: ['hip hop rap'], x: 3.6, z: -2.4, w: 7.2, d: 2.8 },
  { id: 'jazz', name: 'Jazz', genres: ['jazz'], x: -5, z: 1.9, w: 7.2, d: 2.8 },
  { id: 'rock-pop-alt', name: 'Rock, Pop & Alt', genres: ['alternative', 'pop', 'rock', 'folk', 'punk', 'acoustic'], x: 3.6, z: 1.9, w: 7.2, d: 1.4 },
  { id: 'global', name: 'Global Sounds', genres: ['world', 'latin', 'reggae', 'devotional'], x: -6.2, z: 5.8, w: 4.8, d: 1.4 },
  { id: 'left-field', name: 'Left Field', genres: ['experimental', 'soundtrack', 'classical', 'kids'], x: -0.6, z: 5.8, w: 4.8, d: 1.4 },
  { id: 'fresh', name: 'Fresh Crates', genres: [], x: 6.6, z: 5.9, w: 4.8, d: 2.6, crates: true }, // crates hold 24
];

/** Unknown genres go to Left Field; records with no genre go to Fresh Crates (the unsorted bin by the door). */
export function sectionOf(r: PublicAlbum): string {
  if (!r.genre) return 'fresh';
  const g = r.genre.trim().toLowerCase();
  return SECTIONS.find((s) => s.genres.includes(g))?.id ?? 'left-field';
}

export const PER_BIN = 48;
export type Bin = { section: string; index: number; records: PublicAlbum[]; label: string };

const initial = (r: PublicAlbum) => (/^[a-z]/i.test(r.artist) ? r.artist[0]!.toUpperCase() : '#');

/** Each section's records, A–Z by artist, cut into bins of PER_BIN with a divider label like "A–C". */
export function binsBySection(albums: PublicAlbum[]): Map<string, Bin[]> {
  const out = new Map<string, Bin[]>(SECTIONS.map((s) => [s.id, []]));
  for (const s of SECTIONS) {
    const rs = albums.filter((r) => sectionOf(r) === s.id).sort((a, b) => a.artist.localeCompare(b.artist, 'en', { sensitivity: 'base' }));
    const per = s.crates ? PER_BIN / 2 : PER_BIN; // a milk crate has one compartment
    for (let i = 0; i < rs.length; i += per) {
      const chunk = rs.slice(i, i + per);
      const [a, b] = [initial(chunk[0]!), initial(chunk.at(-1)!)];
      out.get(s.id)!.push({ section: s.id, index: i / per, records: chunk, label: a === b ? a : `${a}–${b}` });
    }
  }
  return out;
}
