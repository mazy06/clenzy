import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useReservationForm } from './useReservationForm';
import { reservationsApi, type Reservation } from '../../services/api/reservationsApi';

vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { platformRole: 'SUPER_ADMIN' } }) }));
vi.mock('../../modules/planning/hooks/usePlanningData', () => ({ planningKeys: { all: ['planning'] } }));
vi.mock('../../hooks/useReservations', () => ({ reservationsKeys: { all: ['reservations'] } }));
vi.mock('../../services/api/reservationsApi', () => ({ reservationsApi: { update: vi.fn() } }));
vi.mock('../../services/api/propertiesApi', () => ({ propertiesApi: {
  getById: vi.fn().mockResolvedValue({ id: 88, nightlyPrice: 23 }),
  getAll: vi.fn().mockResolvedValue([]), getCleaningEstimate: vi.fn().mockResolvedValue(0),
} }));
vi.mock('../../services/api/touristTaxApi', () => ({ touristTaxApi: { getConfigs: vi.fn().mockResolvedValue([]) } }));
vi.mock('../../services/api/calendarPricingApi', () => ({ calendarPricingApi: { getPricing: vi.fn().mockResolvedValue([]) } }));

describe('Persistance des réservations Baitly', () => {
  it('recharge séparément les frais et taxes et transmet une seule modification même en cas de double validation', async () => {
    const reservation = { id: 594, propertyId: 88, guestName: 'Recette Mobile', guestCount: 2,
      childrenCount: 0, checkIn: '2026-11-12', checkOut: '2026-11-15', source: 'direct',
      status: 'confirmed', totalPrice: 93, cleaningFee: 15, touristTaxAmount: 9,
      confirmationCode: 'TEST-MOBILE', notes: 'Recette',
    } as Reservation;
    let finish!: (value: Reservation) => void;
    vi.mocked(reservationsApi.update).mockReset().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    const props = { open: true, mode: 'edit' as const, reservation, onClose: vi.fn() };
    const { result } = renderHook(() => useReservationForm(props), {
      wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.totalPrice).toBe(93));
    expect(result.current.cleaningFee).toBe('15');
    expect(result.current.touristTaxPerPerson).toBe('1.5');
    expect(reservationsApi.update).not.toHaveBeenCalled();
    act(() => { result.current.setTouristTaxPerPerson('2'); result.current.setConfirmationCode('TEST-EDIT'); });
    act(() => { result.current.handleSubmit(); result.current.handleSubmit(); });
    await waitFor(() => expect(reservationsApi.update).toHaveBeenCalledTimes(1));
    expect(reservationsApi.update).toHaveBeenCalledWith(594, expect.objectContaining({
      totalPrice: 96, cleaningFee: 15, touristTaxAmount: 12, confirmationCode: 'TEST-EDIT',
    }));
    await act(async () => finish(reservation));
    client.clear();
  });
});
