// Visitor hearts and crates, kept only in the visitor's own browser (localStorage). Never sent anywhere.
// Every updater returns a new object; nothing mutates its input.
import { z } from 'zod';
import { cleanName, MAX_NAME } from './share.ts';

const KEY = 'rl-record-store:visitor';
const RecordId = z.string().regex(/^bandcamp:(album|track):\d+$/);

const VisitorSchema = z.object({
  schemaVersion: z.literal(1),
  favorites: z.array(RecordId),
  crates: z.array(z.object({ id: z.string().min(1), name: z.string().max(MAX_NAME), records: z.array(RecordId) })),
});
export type VisitorData = z.infer<typeof VisitorSchema>;
export type VisitorCrate = VisitorData['crates'][number];
export const EMPTY_VISITOR: VisitorData = Object.freeze({ schemaVersion: 1, favorites: [], crates: [] }) as VisitorData;

/** Accessing localStorage itself can throw (blocked cookies, some private modes). */
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadVisitorData(storage: Storage | null = browserStorage()): { data: VisitorData; notice: 'unavailable' | 'reset' | null } {
  if (!storage) return { data: EMPTY_VISITOR, notice: 'unavailable' };
  let raw: string | null;
  try {
    raw = storage.getItem(KEY);
  } catch {
    return { data: EMPTY_VISITOR, notice: 'unavailable' };
  }
  if (raw === null) return { data: EMPTY_VISITOR, notice: null };
  try {
    const parsed = VisitorSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { data: parsed.data, notice: null } : { data: EMPTY_VISITOR, notice: 'reset' };
  } catch {
    return { data: EMPTY_VISITOR, notice: 'reset' };
  }
}

/** Returns false when the browser refuses (blocked, full); the caller tells the visitor. */
export function saveVisitorData(data: VisitorData, storage: Storage | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'crate';
const mapCrate = (d: VisitorData, id: string, f: (c: VisitorCrate) => VisitorCrate): VisitorData =>
  ({ ...d, crates: d.crates.map((c) => (c.id === id ? f(c) : c)) });

export function toggleFavorite(d: VisitorData, recordId: string): VisitorData {
  return { ...d, favorites: d.favorites.includes(recordId) ? d.favorites.filter((f) => f !== recordId) : [...d.favorites, recordId] };
}

export function createCrate(d: VisitorData, name: string): VisitorData {
  const clean = cleanName(name) || 'My crate';
  const base = slug(clean);
  const taken = new Set(d.crates.map((c) => c.id));
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return { ...d, crates: [...d.crates, { id, name: clean, records: [] }] };
}

export const renameCrate = (d: VisitorData, id: string, name: string): VisitorData =>
  mapCrate(d, id, (c) => ({ ...c, name: cleanName(name) || c.name }));
export const deleteCrate = (d: VisitorData, id: string): VisitorData => ({ ...d, crates: d.crates.filter((c) => c.id !== id) });
export const addToCrate = (d: VisitorData, id: string, recordId: string): VisitorData =>
  mapCrate(d, id, (c) => (c.records.includes(recordId) ? c : { ...c, records: [...c.records, recordId] }));
export const removeFromCrate = (d: VisitorData, id: string, recordId: string): VisitorData =>
  mapCrate(d, id, (c) => ({ ...c, records: c.records.filter((r) => r !== recordId) }));
