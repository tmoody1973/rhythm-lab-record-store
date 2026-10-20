// Tarik's picks for the staff-picks wall (decision 12): his `staff-picks` crate in content/crates.json, filled with
// `npm run import-crate`, in his order. Records no longer in the catalog are dropped; no crate means a bare wall.
import type { PublicAlbum } from '../catalog/schema.ts';
import type { TarikCrate } from '../crates/curation.ts';

export const STAFF_PICKS = 'staff-picks';

export function staffPicks(crates: TarikCrate[], byId: Map<string, PublicAlbum>): PublicAlbum[] {
  const crate = crates.find((c) => c.id === STAFF_PICKS);
  return (crate?.records ?? []).map((id) => byId.get(id)).filter((r): r is PublicAlbum => !!r);
}
