import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const getAllMock = vi.fn();
const getByIdMock = vi.fn();

vi.mock('../../../services/api', () => ({
  serviceRequestsApi: {
    getAll: (params: unknown) => getAllMock(params),
    getById: (id: number) => getByIdMock(id),
  },
}));

import { useAttachedServiceRequests } from '../PlanningActionPanel/useAttachedServiceRequests';
import type { PlanningEvent } from '../types';
import type { AttachmentCandidate } from '../utils/interventionAttachment';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const stay: AttachmentCandidate = {
  id: 42,
  propertyId: 1,
  checkIn: '2026-03-11',
  checkOut: '2026-03-15',
  status: 'confirmed',
};

/** Ménage du jour de checkout, que le serveur n'a PAS lié au séjour. */
const unlinkedCleaningEvent = {
  id: 'sr-7',
  type: 'cleaning',
  propertyId: 1,
  startDate: '2026-03-15',
  endDate: '2026-03-15',
  label: 'Menage de depart',
  status: 'awaiting_payment',
  color: '#000',
  serviceRequest: {
    id: 7,
    propertyId: 1,
    propertyName: 'Studio Centre',
    serviceType: 'CLEANING',
    title: 'Menage de depart',
    startDate: '2026-03-15',
    estimatedDurationHours: 2,
    estimatedCost: 55,
    status: 'AWAITING_PAYMENT',
  },
} as unknown as PlanningEvent;

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('useAttachedServiceRequests', () => {
  beforeEach(() => {
    getAllMock.mockReset();
    getByIdMock.mockReset();
  });

  it('complète la liste du serveur par ce que la règle commune rattache', async () => {
    getAllMock.mockResolvedValue([]);
    getByIdMock.mockResolvedValue({ id: 7, title: 'Menage de depart', status: 'AWAITING_PAYMENT' });

    const { result } = renderHook(
      () =>
        useAttachedServiceRequests({
          reservationId: 42,
          allEvents: [unlinkedCleaningEvent],
          loadedReservations: [stay],
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(result.current[0].id).toBe(7);
    // La fiche COMPLÈTE est rechargée : la forme allégée du planning ne suffit pas.
    expect(getByIdMock).toHaveBeenCalledWith(7);
  });

  it('ne recharge pas une demande déjà rendue par le serveur', async () => {
    getAllMock.mockResolvedValue([{ id: 7, title: 'Menage de depart', status: 'AWAITING_PAYMENT' }]);

    const { result } = renderHook(
      () =>
        useAttachedServiceRequests({
          reservationId: 42,
          allEvents: [unlinkedCleaningEvent],
          loadedReservations: [stay],
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(result.current).toHaveLength(1));
    expect(getByIdMock).not.toHaveBeenCalled();
  });

  it('ignore une demande qui se rattache à un AUTRE séjour', async () => {
    getAllMock.mockResolvedValue([]);

    const { result } = renderHook(
      () =>
        useAttachedServiceRequests({
          reservationId: 43,
          allEvents: [unlinkedCleaningEvent],
          loadedReservations: [stay, { ...stay, id: 43, checkIn: '2026-04-01', checkOut: '2026-04-05' }],
        }),
      { wrapper: makeWrapper() },
    );

    await waitFor(() => expect(getAllMock).toHaveBeenCalled());
    expect(result.current).toEqual([]);
    expect(getByIdMock).not.toHaveBeenCalled();
  });
});
