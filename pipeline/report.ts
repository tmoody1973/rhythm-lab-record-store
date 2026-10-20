// Refresh reporting and safe writes for the catalog step.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Catalog } from '../src/catalog/schema.ts';

export function diffCatalogs(prev: Catalog | null, next: Catalog): { added: string[]; removed: string[] } {
  const before = new Set(prev?.albums.map((a) => a.id) ?? []);
  const now = new Set(next.albums.map((a) => a.id));
  return { added: [...now].filter((id) => !before.has(id)), removed: [...before].filter((id) => !now.has(id)) };
}

/** Crate entries (content/crates.json, `records: string[]` of catalog ids) missing from the new catalog. Never edits crates. */
export function danglingCrateRefs(crates: unknown, next: Catalog): { crateId: string; recordId: string }[] {
  if (!Array.isArray(crates)) return [];
  const present = new Set(next.albums.map((a) => a.id));
  return crates.flatMap((c) =>
    Array.isArray(c?.records)
      ? c.records.filter((id: unknown) => typeof id === 'string' && !present.has(id)).map((recordId: string) => ({ crateId: String(c.id), recordId }))
      : [],
  );
}

/** Only a listing that ended on a short (last) page is complete enough to publish. */
export function listingComplete(r: { stoppedBy: string }): boolean {
  return r.stoppedBy === 'short-page';
}

/** Write to a temp file, then rename over the target: readers see the old file or the new one, never half of one. */
export async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(data, null, 2) + '\n');
  await rename(tmp, path);
}
