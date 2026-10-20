// The CC0 decor that `npm run decor` puts in public/decor/ (gitignored). If it's missing or incomplete the shop
// falls back to flat colours rather than a half-dressed room (spec: "Decor in CI and deploy").
import { z } from 'zod';

const TEXTURES = ['brick_wall_02', 'dark_wooden_planks', 'black_walnut_veneer_01'] as const;
export const DECOR_FILES = [
  ...TEXTURES.flatMap((t) => [`${t}_diff.webp`, `${t}_nor.webp`]),
  'potted_plant_02.glb',
  'potted_plant_04.glb',
] as const;

export const DecorManifestSchema = z.object({ version: z.literal(1), files: z.array(z.string()) });
export type DecorManifest = z.infer<typeof DecorManifestSchema>;
type Surface = { map: string; normal: string };
export type DecorUrls = { brick: Surface; floor: Surface; walnut: Surface; plants: { lush: string; small: string } };

const at = (f: string) => `/decor/${f}`;
const surface = (t: string): Surface => ({ map: at(`${t}_diff.webp`), normal: at(`${t}_nor.webp`) });

export function decorUrls(m: DecorManifest | null): DecorUrls | null {
  if (!m || !DECOR_FILES.every((f) => m.files.includes(f))) return null;
  return {
    brick: surface('brick_wall_02'),
    floor: surface('dark_wooden_planks'),
    walnut: surface('black_walnut_veneer_01'),
    plants: { lush: at('potted_plant_02.glb'), small: at('potted_plant_04.glb') },
  };
}
