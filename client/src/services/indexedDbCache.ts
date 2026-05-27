/**
 * Wrapper vanilla minimaliste autour d'IndexedDB pour les caches frontend
 * volumineux (au-dela des ~5 MB de localStorage).
 *
 * <h2>Usage</h2>
 * <pre>
 * import { idbCache } from './indexedDbCache';
 *
 * await idbCache.set('amenity-icons:42', { WIFI: 'WifiHigh', POOL: 'Waves' });
 * const value = await idbCache.get<MyShape>('amenity-icons:42');
 * await idbCache.delete('amenity-icons:42');
 * </pre>
 *
 * <h2>Design</h2>
 * <ul>
 *   <li>Une seule base {@code clenzy-cache}, une seule object store {@code kv}
 *       (cle = string, valeur = JSON serializable).</li>
 *   <li>API async (Promise) — IndexedDB est intrinsequement async, pas de
 *       lecture synchrone possible. Les consommateurs doivent gerer un etat
 *       de loading.</li>
 *   <li>Aucune dependance npm — wrapper vanilla ~80 lignes pour eviter
 *       d'embarquer idb / idb-keyval.</li>
 *   <li>Tous les errors sont silent (best-effort) — IndexedDB peut etre
 *       desactive (private mode Safari, quota). Les callers doivent avoir
 *       un fallback (typiquement: continuer avec un cache vide).</li>
 * </ul>
 */

const DB_NAME = 'clenzy-cache';
const DB_VERSION = 1;
const STORE_NAME = 'kv';

let dbPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Lazy-open la base. Memoize pour eviter de re-ouvrir a chaque call.
 * Retourne null si IndexedDB n'est pas disponible (private mode, etc.).
 */
function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    dbPromise = Promise.resolve(null);
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T | null> {
  return openDb().then((db) => {
    if (!db) return null;
    return new Promise<T | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, mode);
        const store = tx.objectStore(STORE_NAME);
        const req = fn(store);
        req.onsuccess = () => resolve((req.result ?? null) as T | null);
        req.onerror = () => resolve(null);
        tx.onabort = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  });
}

export const idbCache = {
  async get<T>(key: string): Promise<T | null> {
    return withStore<T>('readonly', (store) => store.get(key) as IDBRequest<T>);
  },

  async set<T>(key: string, value: T): Promise<void> {
    await withStore('readwrite', (store) => store.put(value as unknown as IDBValidKey, key));
  },

  async delete(key: string): Promise<void> {
    await withStore('readwrite', (store) => store.delete(key));
  },

  async clear(): Promise<void> {
    await withStore('readwrite', (store) => store.clear());
  },

  /**
   * Liste toutes les cles commencant par {@code prefix}.
   * Utile pour iterer / cleanup partiel sans tout effacer.
   */
  async keysByPrefix(prefix: string): Promise<string[]> {
    const db = await openDb();
    if (!db) return [];
    return new Promise<string[]>((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        req.onsuccess = () => {
          const keys = (req.result as IDBValidKey[])
            .filter((k): k is string => typeof k === 'string' && k.startsWith(prefix));
          resolve(keys);
        };
        req.onerror = () => resolve([]);
        tx.onabort = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },

  /**
   * Supprime toutes les cles commencant par {@code prefix}.
   * Operation best-effort — silent fail si IDB indisponible.
   */
  async deleteByPrefix(prefix: string): Promise<void> {
    const keys = await idbCache.keysByPrefix(prefix);
    if (keys.length === 0) return;
    await Promise.all(keys.map((k) => idbCache.delete(k)));
  },
};
