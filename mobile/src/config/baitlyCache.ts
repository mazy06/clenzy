import { type Query, type QueryClient } from '@tanstack/react-query';

export const BAITLY_QUERY_ROOT = 'baitly-mobile-v1';

/** Personal mobile queries, including legacy admin screens, remain in memory. */
export function shouldPersistMobileQuery(query: Query) {
  return false;
}

export function clearBaitlySessionCache(client: QueryClient) {
  void client.cancelQueries();
  client.removeQueries();
}
