import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { propertiesListKeys, usePropertiesList } from '../usePropertiesList';
import { propertiesApi, type Property } from '../../services/api/propertiesApi';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each(['ui', 'api'])('keeps the API DTO intact when %s mounts first', async (first) => {
  const raw = { id: 42, ownerId: 7, ownerName: 'Owner', name: 'Studio', status: 'ACTIVE', coverPhotoUrl: '/photo', maxGuests: 4 } as Property;
  const get = vi.spyOn(propertiesApi, 'getAll').mockResolvedValue([raw]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const useApi = () => useQuery({ queryKey: propertiesListKeys.all, queryFn: () => propertiesApi.getAll(), staleTime: 60_000 });
  const useBoth = () => ({ api: useApi(), ui: usePropertiesList() });
  if (first === 'ui') {
    const initial = renderHook(() => usePropertiesList(), { wrapper });
    await waitFor(() => expect(initial.result.current.properties).toHaveLength(1));
    initial.unmount();
  } else {
    const initial = renderHook(useApi, { wrapper });
    await waitFor(() => expect(initial.result.current.data).toHaveLength(1));
    initial.unmount();
  }
  const hook = renderHook(useBoth, { wrapper });
  await waitFor(() => expect(hook.result.current.ui.properties).toHaveLength(1));
  expect(hook.result.current.api.data?.[0]).toEqual(raw);
  expect(hook.result.current.ui.properties[0]).toMatchObject({ id: '42', ownerId: '7', status: 'active', guests: 4, imageUrl: '/photo' });
  expect(get).toHaveBeenCalledTimes(1);
  client.clear();
});
