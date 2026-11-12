// In-browser mock database. Lives in sessionStorage only: closing the tab
// wipes it (PRD section 6.3: "stores nothing beyond the browser session").

import { todayIso } from '../dates';
import { DB_VERSION, seed, type MockDb } from './seed';

const KEY = 'agridirect-demo-db';
let cache: MockDb | null = null;

function storage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readDb(): MockDb {
  if (cache) return cache;
  const raw = storage()?.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as MockDb;
      if (parsed.version === DB_VERSION) {
        cache = parsed;
        return parsed;
      }
    } catch {
      // Corrupt or old data: fall through to a fresh seed.
    }
  }
  cache = seed(todayIso());
  return cache;
}

export function writeDb(db: MockDb): void {
  cache = db;
  try {
    storage()?.setItem(KEY, JSON.stringify(db));
  } catch {
    // Quota exceeded (e.g. many photos): keep the in-memory copy.
  }
}

/** Run a mutation against a copy and persist it. */
export function mutate<T>(fn: (db: MockDb) => T): T {
  const db = structuredClone(readDb());
  const result = fn(db);
  writeDb(db);
  return result;
}

export function resetDb(): void {
  cache = null;
  storage()?.removeItem(KEY);
}

export function newId(prefix = 'id'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${rand.slice(0, 8)}`;
}
