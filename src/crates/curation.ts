// Tarik's own crates and notes: content/crates.json and content/notes.json, hand-editable and imported by
// `npm run import-crate`. Validated by tests in CI; the site falls back to none if a file is ever invalid.
import { z } from 'zod';
import cratesJson from '../../content/crates.json' with { type: 'json' };
import notesJson from '../../content/notes.json' with { type: 'json' };

const RecordId = z.string().regex(/^bandcamp:(album|track):\d+$/);

const CrateSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().min(1).max(60),
  note: z.string().max(200),
  records: z.array(RecordId),
});
export const CratesFileSchema = z.array(CrateSchema).refine((cs) => new Set(cs.map((c) => c.id)).size === cs.length, 'crate ids must be unique');
export const NotesFileSchema = z.record(RecordId, z.string().max(500));
export type TarikCrate = z.infer<typeof CrateSchema>;

function loadOr<T>(schema: z.ZodType<T>, data: unknown, fallback: T, label: string): T {
  const r = schema.safeParse(data);
  if (!r.success) console.error(`[content] ${label} is invalid; showing none.`, r.error.issues);
  return r.success ? r.data : fallback;
}
export const TARIK_CRATES: TarikCrate[] = loadOr(CratesFileSchema, cratesJson, [], 'content/crates.json');
export const TARIK_NOTES: Record<string, string> = loadOr(NotesFileSchema, notesJson, {}, 'content/notes.json');

export function crateMembers(crates: TarikCrate[], crateId: string): Set<string> | null {
  const c = crates.find((x) => x.id === crateId);
  return c ? new Set(c.records) : null;
}

export function cratesContaining(crates: TarikCrate[], recordId: string): string[] {
  return crates.filter((c) => c.records.includes(recordId)).map((c) => c.name);
}

/** Merge records into one of Tarik's crates (creating it at the end if new). Never removes; keeps order. */
export function mergeImport(crates: TarikCrate[], crateId: string, name: string | null, records: string[]) {
  const existing = crates.find((c) => c.id === crateId);
  const base = existing ?? { id: crateId, name: name ?? crateId, note: '', records: [] };
  const fresh = [...new Set(records)].filter((r) => !base.records.includes(r));
  const merged = { ...base, records: [...base.records, ...fresh] };
  return {
    crates: existing ? crates.map((c) => (c.id === crateId ? merged : c)) : [...crates, merged],
    added: fresh.length,
    created: !existing,
  };
}
