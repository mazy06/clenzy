import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PropsWithChildren } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { usePropertiesList } from '../usePropertiesList';

const getAll = vi.hoisted(() => vi.fn());
vi.mock('../../services/api/propertiesApi', () => ({ propertiesApi: { getAll } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('revérifie le portefeuille vide au retour immédiat d’un ajout ou import', async () => {
  getAll.mockResolvedValueOnce([]).mockResolvedValue([{ id: 1, name: 'Premier logement', status: 'INACTIVE' }]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const initial = renderHook(usePropertiesList, { wrapper });
  await waitFor(() => expect(initial.result.current.isLoading).toBe(false));
  expect(initial.result.current.properties).toHaveLength(0);
  initial.unmount();
  const returned = renderHook(usePropertiesList, { wrapper });
  await waitFor(() => expect(returned.result.current.properties).toHaveLength(1));
  expect(getAll).toHaveBeenCalledTimes(2);
  returned.unmount(); client.clear();
});
