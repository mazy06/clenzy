/**
 * Storage abstraction — uses MMKV when available (dev client / standalone),
 * falls back to a simple in-memory Map for Expo Go compatibility.
 *
 * The API matches MMKV's synchronous interface: getString / set / delete / contains
 */

interface SyncStorage {
  getString(key: string): string | undefined;
  getNumber(key: string): number | undefined;
  set(key: string, value: string | number | boolean): void;
  delete(key: string): void;
  remove(key: string): void;
  contains(key: string): boolean;
  clearAll(): void;
}

let mmkvAvailable = false;
let createMMKVNative: ((opts: { id: string }) => SyncStorage) | null = null;

try {
  const mod = require('react-native-mmkv');
  // createMMKV is the Expo-compatible factory in v4+
  createMMKVNative = mod.createMMKV ?? mod.MMKV;
  if (createMMKVNative) {
    // Quick smoke test — will throw if NitroModules are missing (Expo Go)
    createMMKVNative({ id: '__probe__' });
    mmkvAvailable = true;
  }
} catch {
  mmkvAvailable = false;
}

/**
 * In-memory fallback that mirrors the MMKV sync API.
 * Data is lost on app restart — acceptable for dev in Expo Go.
 */
function createMemoryStorage(_opts: { id: string }): SyncStorage {
  const map = new Map<string, string | number | boolean>();
  return {
    getString: (key) => { const v = map.get(key); return typeof v === 'string' ? v : undefined; },
    getNumber: (key) => { const v = map.get(key); return typeof v === 'number' ? v : undefined; },
    set: (key, value) => { map.set(key, value); },
    delete: (key) => { map.delete(key); },
    remove: (key) => { map.delete(key); },
    contains: (key) => map.has(key),
    clearAll: () => { map.clear(); },
  };
}

/**
 * Create a storage instance. Uses MMKV if native modules are available,
 * otherwise falls back to in-memory storage.
 */
export function createStorage(opts: { id: string }): SyncStorage {
  if (mmkvAvailable && createMMKVNative) {
    return createMMKVNative(opts);
  }
  console.warn(`[Storage] MMKV unavailable (Expo Go?) — using in-memory fallback for "${opts.id}"`);
  return createMemoryStorage(opts);
}

export const isMMKVAvailable = mmkvAvailable;
