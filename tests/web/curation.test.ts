import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { CratesFileSchema, crateMembers, cratesContaining, mergeImport, NotesFileSchema, type TarikCrate } from '../../src/crates/curation.ts';

const A = 'bandcamp:album:1';
const B = 'bandcamp:album:2';
const T = 'bandcamp:track:3';
const crates: TarikCrate[] = [
  { id: 'staff-picks', name: 'Staff Picks', note: 'On repeat.', records: [A, T] },
  { id: 'jazz-and-beyond', name: 'Jazz & Beyond', note: '', records: [T] },
];
const deepFreeze = <X,>(x: X): X => { Object.values(x as object).forEach((v) => v && typeof v === 'object' && deepFreeze(v)); return Object.freeze(x); };

describe('content files', () => {
  test('the committed content/crates.json and content/notes.json are valid', () => {
    expect(() => CratesFileSchema.parse(JSON.parse(readFileSync('content/crates.json', 'utf8')))).not.toThrow();
    expect(() => NotesFileSchema.parse(JSON.parse(readFileSync('content/notes.json', 'utf8')))).not.toThrow();
  });
  test('duplicate crate ids, long names and bad record ids are rejected', () => {
    expect(() => CratesFileSchema.parse([...crates, crates[0]])).toThrow();
    expect(() => CratesFileSchema.parse([{ ...crates[0], name: 'x'.repeat(61) }])).toThrow();
    expect(() => CratesFileSchema.parse([{ ...crates[0], records: ['a1'] }])).toThrow();
    expect(() => CratesFileSchema.parse([{ ...crates[0], id: 'Staff Picks' }])).toThrow();
    expect(() => NotesFileSchema.parse({ [A]: 'x'.repeat(501) })).toThrow();
  });
});

describe('lookups', () => {
  test('crateMembers and cratesContaining agree', () => {
    expect(crateMembers(crates, 'staff-picks')).toEqual(new Set([A, T]));
    expect(crateMembers(crates, 'nope')).toBeNull();
    expect(cratesContaining(crates, T)).toEqual(['Staff Picks', 'Jazz & Beyond']);
    expect(cratesContaining(crates, B)).toEqual([]);
  });
});

describe('mergeImport', () => {
  test('adds only new records to an existing crate, keeping order and never removing', () => {
    const r = mergeImport(deepFreeze(structuredClone(crates)), 'staff-picks', null, [T, B, B]);
    expect(r).toMatchObject({ added: 1, created: false });
    expect(r.crates[0]!.records).toEqual([A, T, B]);
  });
  test('creates a new crate at the end with the given name', () => {
    const r = mergeImport(deepFreeze(structuredClone(crates)), 'late-night', 'Late Night', [B]);
    expect(r).toMatchObject({ added: 1, created: true });
    expect(r.crates.at(-1)).toEqual({ id: 'late-night', name: 'Late Night', note: '', records: [B] });
    expect(r.crates).toHaveLength(3);
  });
});
