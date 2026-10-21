// npm run check-secrets — scans generated files for any credential value from .env.local.
// Prints only PASS or FAIL with file names; never the values.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const KEYS = ['SUBSONIC_PASSWORD', 'SUBSONIC_USER', 'APPLE_TEAM_ID', 'APPLE_KEY_ID', 'DISCOGS_KEY', 'DISCOGS_SECRET', 'MUSICBRAINZ_CONTACT'];
const PATHS = ['out', 'data/.cache/enrich', 'data/enrichment-review.md', 'tests/fixtures/enrich', 'public/enrichment.json', 'public/catalog.json', 'public/about', 'data/.cache/about', 'docs/ENRICHMENT-COVERAGE.md'];

const secrets = KEYS.map((k) => process.env[k]).filter((v): v is string => !!v && v.length >= 6);
if (secrets.length < 5) {
  process.stdout.write('secrets not loaded; run with --env-file=.env.local\n');
  process.exit(1);
}
const files = (p: string): string[] =>
  !existsSync(p) ? [] : statSync(p).isDirectory() ? readdirSync(p).flatMap((f) => files(join(p, f))) : [p];
const leaks = PATHS.flatMap(files).filter((f) => {
  const text = readFileSync(f, 'utf8');
  return secrets.some((s) => text.includes(s)) || /BEGIN PRIVATE KEY|Bearer ey[A-Za-z0-9_-]{10}/.test(text);
});
process.stdout.write(leaks.length ? `FAIL: ${leaks.join(', ')}\n` : 'PASS\n');
if (leaks.length) process.exit(1);
