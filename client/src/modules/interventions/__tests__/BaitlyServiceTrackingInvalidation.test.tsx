import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { PropsWithChildren } from 'react';
import { useInterventionState } from '../useInterventionState';
import { interventionsApi } from '../../../services/api/interventionsApi';
import type { InterventionDetailsData } from '../interventionUtils';

const auth = vi.hoisted(() => ({
  user: { databaseId: 1 }, hasPermissionAsync: vi.fn().mockResolvedValue(true),
  isTechnician: () => true, isHousekeeper: () => false, isSupervisor: () => false, isPlatformStaff: () => false,
}));
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => auth }));
vi.mock('../../../hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../services/api/interventionsApi', () => ({ interventionsApi: { getById: vi.fn(), start: vi.fn(), complete: vi.fn() } }));
vi.mock('../../../services/api/propertiesApi', () => ({ propertiesApi: {} }));
vi.mock('../../../services/api/teamsApi', () => ({ teamsApi: {} }));
vi.mock('../useInterventionsList', () => ({ interventionsKeys: { detail: (id: string) => ['interventions', 'detail', id], lists: () => ['interventions', 'list'] } }));
vi.mock('../../documents/hooks/useDocuments', () => ({ documentKeys: { generationsByReference: () => ['documents'] } }));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(interventionsApi.getById).mockResolvedValue({ id: 42, status: 'PENDING', type: 'OTHER', serviceItemCode: 'driver-airport', assignedToType: 'user', assignedToId: 1 } as InterventionDetailsData);
});

it.each(['start', 'complete'] as const)('invalidates paid-service tracking after %s succeeds without changing unrelated preferences', async action => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const tracked = ['paid-service-execution', 8];
  client.setQueryData(tracked, { state: 'CONFIRMED' });
  client.setQueryData(['upsell-orders', '1:2'], [{ id: 8 }]);
  client.setQueryData(['user-preferences'], { language: 'fr' });
  vi.mocked(interventionsApi[action]).mockResolvedValue({ id: 42, status: action === 'start' ? 'IN_PROGRESS' : 'COMPLETED' } as InterventionDetailsData);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useInterventionState('42'), { wrapper });
  await waitFor(() => expect(result.current.intervention?.id).toBe(42));
  await act(async () => {
    if (action === 'start') await result.current.handleStartIntervention();
    else await result.current.handleCompleteIntervention();
  });
  await waitFor(() => expect(client.getQueryState(tracked)?.isInvalidated).toBe(true));
  expect(client.getQueryState(['upsell-orders', '1:2'])?.isInvalidated).toBe(true);
  expect(client.getQueryState(['user-preferences'])?.isInvalidated).toBe(false);
});
