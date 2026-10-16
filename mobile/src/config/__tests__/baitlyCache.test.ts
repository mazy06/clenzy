import { QueryClient, dehydrate } from '@tanstack/react-query';
import { BAITLY_QUERY_ROOT, clearBaitlySessionCache, shouldPersistMobileQuery } from '../baitlyCache';

it('excludes both current and legacy personal data from disk persistence', () => {
  const client = new QueryClient();
  client.setQueryData([BAITLY_QUERY_ROOT, 'user-a', 1, 'request', 7], { message: 'private' });
  client.setQueryData([BAITLY_QUERY_ROOT, 'user-a', 1, 'owner-mandates'], { signatureToken: 'private-token' });
  client.setQueryData([BAITLY_QUERY_ROOT, undefined, undefined, 'mandate-signature', 'private-token'], { ownerName: 'private' });
  client.setQueryData(['legacy'], { value: 1 });
  const result = dehydrate(client, { shouldDehydrateQuery: shouldPersistMobileQuery });
  expect(result.queries).toEqual([]);
  client.clear();
});
it('removes all current and legacy tenant data at an identity change', () => {
  const client = new QueryClient();
  client.setQueryData([BAITLY_QUERY_ROOT, 'user-a', 1, 'properties'], { secret: 'a' });
  client.setQueryData([BAITLY_QUERY_ROOT, 'user-a', 2, 'request'], { secret: 'b' });
  client.setQueryData(['legacy'], 'keep');
  clearBaitlySessionCache(client);
  expect(client.getQueriesData({ queryKey: [BAITLY_QUERY_ROOT] })).toEqual([]);
  expect(client.getQueryData(['legacy'])).toBeUndefined();
  client.clear();
});
