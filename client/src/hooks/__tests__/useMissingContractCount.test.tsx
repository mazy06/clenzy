import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { useMissingContractCount } from '../useMissingContractCount';
import { usePropertiesList } from '../usePropertiesList';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';

vi.mock('../useContractedPropertyIds', () => ({
  useContractedPropertyIds: () => ({ propertyIds: new Set([2]) }),
}));

const clients: QueryClient[] = [];
function wrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
afterEach(() => { cleanup(); clients.forEach(client => client.clear()); clients.length = 0; vi.restoreAllMocks(); });

it('shares one portfolio request between dashboard photos and missing contracts', async () => {
  const get = vi.spyOn(propertiesApi, 'getAll').mockResolvedValue([
    { id: 1, name: 'Studio', coverPhotoUrl: '/photo/1' },
    { id: 2, name: 'Maison' },
  ] as Property[]);
  const hook = renderHook(() => ({ photos: usePropertiesList(), contracts: useMissingContractCount() }), { wrapper: wrapper() });
  await waitFor(() => expect(hook.result.current.contracts.count).toBe(1));
  expect(get).toHaveBeenCalledTimes(1);
  expect(hook.result.current.contracts.missingPropertyIds).toEqual([1]);
  expect(hook.result.current.photos.properties[0].imageUrl).toBe('/photo/1');
});

it('does not fetch the portfolio when the contract check is disabled', () => {
  const get = vi.spyOn(propertiesApi, 'getAll');
  renderHook(() => useMissingContractCount(false), { wrapper: wrapper() });
  expect(get).not.toHaveBeenCalled();
});
