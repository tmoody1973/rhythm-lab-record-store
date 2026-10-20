import { describe, expect, test } from 'vitest';
import { decodeShare, encodeShare } from '../../src/crates/share.ts';
import {
  addToCrate, createCrate, deleteCrate, EMPTY_VISITOR, loadVisitorData, removeFromCrate, renameCrate, saveVisitorData,
  toggleFavorite, type VisitorData,
} from '../../src/crates/storage.ts';

const A = 'bandcamp:album:1';
const T = 'bandcamp:track:2';
const known = new Set([A, T]);

function memoryStorage(init: Record<string, string> = {}, opts: { throwOnGet?: boolean; throwOnSet?: boolean } = {}): Storage {
  const m = new Map(Object.entries(init));
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => { if (opts.throwOnGet) throw new Error('SecurityError'); return m.get(k) ?? null; },
    setItem: (k, v) => { if (opts.throwOnSet) throw new Error('QuotaExceededError'); m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}

describe('share links', () => {
  test('round-trip a crate with albums and tracks', () => {
    const link = encodeShare({ name: 'Late Night', records: [A, T] });
    expect(link).toMatch(/^[A-Za-z0-9_-]+$/); // URL-safe, no padding
    expect(decodeShare(link, known)).toEqual({ ok: true, name: 'Late Night', records: [A, T], dropped: 0 });
  });
  test('unknown and malformed ids are dropped and counted', () => {
    const link = encodeShare({ name: 'Mix', records: [A, 'bandcamp:album:999', T] });
    const raw = btoa(JSON.stringify({ name: 'x', ids: ['a1', 'zzz', 42] })).replace(/=+$/, '');
    expect(decodeShare(link, known)).toEqual({ ok: true, name: 'Mix', records: [A, T], dropped: 1 });
    expect(decodeShare(raw, known)).toMatchObject({ ok: true, records: [A], dropped: 2 });
  });
  test('names are cleaned: trimmed, control characters removed, max 60 chars; markup is just text', () => {
    const evil = '<script>alert(1)</script>';
    expect(decodeShare(encodeShare({ name: evil, records: [A] }), known)).toMatchObject({ name: evil });
    const long = decodeShare(encodeShare({ name: `  ${'x'.repeat(10_000)}\u0000\u0007 `, records: [A] }), known);
    expect(long.ok && long.name.length).toBe(60);
    expect(long.ok && /[\u0000-\u001f]/.test(long.name)).toBe(false);
  });
  test('garbage is malformed; more than 200 ids is too large', () => {
    for (const bad of ['', '!!!', 'bm90IGpzb24', btoa('{"name":3,"ids":[]}')]) expect(decodeShare(bad, known)).toEqual({ ok: false, reason: 'malformed' });
    const big = encodeShare({ name: 'Big', records: Array.from({ length: 201 }, (_, i) => `bandcamp:album:${i + 1}`) });
    expect(decodeShare(big, known)).toEqual({ ok: false, reason: 'too-large' });
  });
});

describe('visitor storage', () => {
  test('nothing saved yet gives empty data and no notice', () => {
    expect(loadVisitorData(memoryStorage())).toEqual({ data: EMPTY_VISITOR, notice: null });
  });
  test('blocked storage gives empty data and says saving is off', () => {
    expect(loadVisitorData(null)).toEqual({ data: EMPTY_VISITOR, notice: 'unavailable' });
    expect(loadVisitorData(memoryStorage({}, { throwOnGet: true }))).toEqual({ data: EMPTY_VISITOR, notice: 'unavailable' });
  });
  test('corrupt or old data is reset with a notice', () => {
    expect(loadVisitorData(memoryStorage({ 'rl-record-store:visitor': '{not json' }))).toEqual({ data: EMPTY_VISITOR, notice: 'reset' });
    expect(loadVisitorData(memoryStorage({ 'rl-record-store:visitor': '{"schemaVersion":0}' }))).toEqual({ data: EMPTY_VISITOR, notice: 'reset' });
  });
  test('save round-trips, and reports failure instead of throwing', () => {
    const s = memoryStorage();
    const data = toggleFavorite(EMPTY_VISITOR, A);
    expect(saveVisitorData(data, s)).toBe(true);
    expect(loadVisitorData(s).data).toEqual(data);
    expect(saveVisitorData(data, memoryStorage({}, { throwOnSet: true }))).toBe(false);
    expect(saveVisitorData(data, null)).toBe(false);
  });
});

describe('crate updates never mutate their input', () => {
  const frozen = (d: VisitorData): VisitorData => Object.freeze({ ...d, favorites: Object.freeze([...d.favorites]) as string[], crates: Object.freeze(d.crates.map((c) => Object.freeze({ ...c, records: Object.freeze([...c.records]) as string[] }))) as VisitorData['crates'] });

  test('favorites toggle on and off', () => {
    const on = toggleFavorite(frozen(EMPTY_VISITOR), A);
    expect(on.favorites).toEqual([A]);
    expect(toggleFavorite(frozen(on), A).favorites).toEqual([]);
  });
  test('create, add (no duplicates), rename, remove, delete', () => {
    let d = createCrate(frozen(EMPTY_VISITOR), '  Late   Night  ');
    const id = d.crates[0]!.id;
    expect(d.crates[0]).toMatchObject({ name: 'Late Night', records: [] });
    d = addToCrate(frozen(d), id, A);
    d = addToCrate(frozen(d), id, A);
    d = addToCrate(frozen(d), id, T);
    expect(d.crates[0]!.records).toEqual([A, T]);
    d = renameCrate(frozen(d), id, 'Sunday');
    expect(d.crates[0]!.name).toBe('Sunday');
    d = removeFromCrate(frozen(d), id, A);
    expect(d.crates[0]!.records).toEqual([T]);
    expect(deleteCrate(frozen(d), id).crates).toEqual([]);
  });
  test('two crates with the same name get different ids', () => {
    const d = createCrate(createCrate(EMPTY_VISITOR, 'Mix'), 'Mix');
    expect(new Set(d.crates.map((c) => c.id)).size).toBe(2);
  });
});
