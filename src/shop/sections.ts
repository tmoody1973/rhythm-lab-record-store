// The shop's eight sections (approved by Tarik, decision 13 in docs/superpowers/specs/2026-10-20-record-shop-design.md).
// Every record lands in exactly one; within a section, records run A–Z by artist in bins of 48 (milk crates: 24).
import type { PublicAlbum } from '../catalog/schema.ts';

export type SectionId = 'electronic' | 'soul-funk' | 'hip-hop' | 'jazz' | 'rock-pop-alt' | 'global' | 'left-field' | 'fresh';
export type Section = { id: SectionId; name: string; genres: string[]; width: number; x: number; aisle: 0 | 1 | 2 | 3; crates?: true };

/** Width and x are the floor space each section gets (from the spike); aisles run from the back wall forward. */
export const SECTIONS: readonly Section[] = [
  { id: 'electronic', name: 'Electronic', genres: ['electronic', 'ambient'], width: 17.2, x: -1.6, aisle: 0 },
  { id: 'soul-funk', name: 'Soul & Funk', genres: ['r&b soul', 'funk', 'blues'], width: 7.2, x: -5, aisle: 1 },
  { id: 'hip-hop', name: 'Hip-Hop', genres: ['hip hop rap'], width: 7.2, x: 3.6, aisle: 1 },
  { id: 'jazz', name: 'Jazz', genres: ['jazz'], width: 7.2, x: -5, aisle: 2 },
  { id: 'rock-pop-alt', name: 'Rock, Pop & Alt', genres: ['alternative', 'pop', 'rock', 'folk', 'punk', 'acoustic'], width: 7.2, x: 3.6, aisle: 2 },
  { id: 'global', name: 'Global Sounds', genres: ['world', 'latin', 'reggae', 'devotional'], width: 4.8, x: -6.2, aisle: 3 },
  { id: 'left-field', name: 'Left Field', genres: ['experimental', 'soundtrack', 'classical', 'kids'], width: 4.8, x: -0.6, aisle: 3 },
  { id: 'fresh', name: 'Fresh Crates', genres: [], width: 4.8, x: 6.6, aisle: 3, crates: true },
];

/** No genre → Fresh Crates (the unsorted bin by the door); a genre no section lists → Left Field. */
export function sectionOf(r: PublicAlbum): SectionId {
  if (!r.genre) return 'fresh';
  const g = r.genre.trim().toLowerCase();
  return SECTIONS.find((s) => s.genres.includes(g))?.id ?? 'left-field';
}

export const PER_BIN = 48;
export type Bin = { section: string; index: number; label: string; records: PublicAlbum[] };

/** The letter an artist files under: accents folded (Ólafur → O), anything else is '#'. */
export function initialOf(artist: string): string {
  const s = artist.normalize('NFD').replace(/\p{M}/gu, '');
  return /^[a-z]/i.test(s) ? s[0]!.toUpperCase() : '#';
}
const initial = (r: PublicAlbum) => initialOf(r.artist);
const byArtist = (a: PublicAlbum, b: PublicAlbum) => a.artist.localeCompare(b.artist, 'en', { sensitivity: 'base' });

/** Records cut into bins of `per`, labelled by their first and last artist initials ("A–E"). */
export function toBins(section: string, records: PublicAlbum[], per = PER_BIN): Bin[] {
  const bins: Bin[] = [];
  for (let i = 0; i < records.length; i += per) {
    const chunk = records.slice(i, i + per);
    const [a, b] = [initial(chunk[0]!), initial(chunk.at(-1)!)];
    bins.push({ section, index: i / per, label: a === b ? a : `${a}–${b}`, records: chunk });
  }
  return bins;
}

export function binsBySection(albums: PublicAlbum[]): Map<SectionId, Bin[]> {
  return new Map(SECTIONS.map((s) => [s.id, toBins(s.id, albums.filter((r) => sectionOf(r) === s.id).sort(byArtist), s.crates ? PER_BIN / 2 : PER_BIN)]));
}
