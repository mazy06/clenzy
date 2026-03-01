import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { createMMKV } from 'react-native-mmkv';

const queryStorage = createMMKV({ id: 'query-cache' });

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000, // 30s (same as web)
      gcTime: 5 * 60_000, // 5min
      retry: 2,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 1,
    },
  },
});

/**
 * MMKV-based persister for TanStack Query
 * Automatically caches all queries to disk for offline access
 */
export const queryPersister = createAsyncStoragePersister({
  storage: {
    getItem: (key) => {
      const value = queryStorage.getString(key);
      return Promise.resolve(value ?? null);
    },
    setItem: (key, value) => {
      queryStorage.set(key, value);
      return Promise.resolve();
    },
    removeItem: (key) => {
      queryStorage.remove(key);
      return Promise.resolve();
    },
  },
  throttleTime: 1000,
});
