// npm run import-crate -- "<share link>" --into <crate-id> [--name "Crate Name"]
// Copies a crate you built in the browser (on any device) into content/crates.json. Never removes anything.
import { existsSync, readFileSync } from 'node:fs';
import { CatalogSchema } from '../src/catalog/schema.ts';
import { CratesFileSchema, mergeImport } from '../src/crates/curation.ts';
import { decodeShare } from '../src/crates/share.ts';
import { writeJsonAtomic } from './report.ts';

const CATALOG = 'public/catalog.json';
const CRATES = 'content/crates.json';
const say = (line: string) => process.stdout.write(line + '\n');
const fail = (line: string) => { say(`REFUSED: ${line}`); process.exit(1); };

function arg(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] ?? null : null;
}

const link = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !['--into', '--name'].includes(all[i - 1] ?? ''));
const into = arg('--into');
const name = arg('--name');
if (!link || !into) fail('usage: npm run import-crate -- "<share link>" --into <crate-id> [--name "Crate Name"]');
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(into!)) fail(`crate id "${into}" must be lowercase words joined by hyphens, e.g. staff-picks`);
if (!existsSync(CATALOG)) fail(`${CATALOG} is missing; run npm run catalog first`);

// Accept the full URL or just the ?shared= value.
const param = link!.includes('shared=') ? new URL(link!, 'http://local').searchParams.get('shared') ?? '' : link!;
const catalog = CatalogSchema.parse(JSON.parse(readFileSync(CATALOG, 'utf8')));
const decoded = decodeShare(param, new Set(catalog.albums.map((a) => a.id)));
if (!decoded.ok) fail(`that share link is ${decoded.reason === 'too-large' ? 'too large (over 200 records)' : 'broken'}`);
if (!decoded.ok) process.exit(1); // narrows the type; fail() already exited

const crates = existsSync(CRATES) ? CratesFileSchema.parse(JSON.parse(readFileSync(CRATES, 'utf8'))) : [];
const result = mergeImport(crates, into!, name ?? decoded.name, decoded.records);
await writeJsonAtomic(CRATES, CratesFileSchema.parse(result.crates));

const crate = result.crates.find((c) => c.id === into)!;
say(`${result.created ? 'Created' : 'Updated'} crate "${crate.name}" (${into}): ${result.added} added, ${crate.records.length} total.`);
if (decoded.dropped) say(`${decoded.dropped} record(s) in the link weren't in your catalog and were skipped.`);
