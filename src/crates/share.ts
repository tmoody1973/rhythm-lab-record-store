// Share links: ?shared=<base64url(JSON { name, ids: compact ids })>. Everything decoded here is untrusted.
import { fromCompact, toCompact } from '../catalog/ids.ts';

export const MAX_SHARED_IDS = 200;
export const MAX_NAME = 60;

/** Trim, collapse whitespace, drop control characters, cap length. The result is rendered as text only. */
export function cleanName(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
}

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(param: string): string {
  const b64 = param.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeShare(crate: { name: string; records: string[] }): string {
  const ids = crate.records.map(toCompact).filter((c): c is string => c !== null);
  return toBase64Url(JSON.stringify({ name: cleanName(crate.name), ids }));
}

export type ShareResult =
  | { ok: true; name: string; records: string[]; dropped: number }
  | { ok: false; reason: 'malformed' | 'too-large' };

/** Decode and validate a share link; ids that are malformed or not in `known` are dropped and counted. */
export function decodeShare(param: string, known: Set<string>): ShareResult {
  let payload: unknown;
  try {
    payload = JSON.parse(fromBase64Url(param));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'malformed' };
  const { name, ids } = payload as { name?: unknown; ids?: unknown };
  if (typeof name !== 'string' || !Array.isArray(ids)) return { ok: false, reason: 'malformed' };
  if (ids.length > MAX_SHARED_IDS) return { ok: false, reason: 'too-large' };
  const records = [...new Set(ids.map((c) => (typeof c === 'string' ? fromCompact(c) : null)).filter((id): id is string => id !== null && known.has(id)))];
  return { ok: true, name: cleanName(name) || 'Shared crate', records, dropped: ids.length - records.length };
}
