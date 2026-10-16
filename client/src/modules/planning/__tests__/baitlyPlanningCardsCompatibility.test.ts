import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../../services/apiClient';
import { planningDataApi } from '../../../services/api/planningDataApi';

vi.mock('../../../services/apiClient', () => ({ default: { get: vi.fn() } }));

describe('compatibilité du déploiement des briques Baitly', () => {
  beforeEach(() => { vi.mocked(apiClient.get).mockReset(); });

  it('préfère la lecture légère sans appel historique', async () => {
    vi.mocked(apiClient.get).mockResolvedValue([{ id: 1, propertyId: 1 }]);
    const data = await planningDataApi.getReservationDetails([1], '2026-10-01', '2026-10-31');
    expect(data.reservations).toHaveLength(1);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    expect(apiClient.get).toHaveBeenCalledWith('/planning/reservation-cards', expect.any(Object));
  });

  it('utilise le contrat historique uniquement si la route légère est absente', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce([{ id: 1 }]);
    const signal = new AbortController().signal;
    await planningDataApi.getReservationDetails([1], '2026-10-01', '2026-10-31', signal);
    expect(apiClient.get).toHaveBeenLastCalledWith('/planning/reservations', {
      signal, params: { propertyIds: '1', from: '2026-10-01', to: '2026-10-31' },
    });
  });

  it.each([401, 403, 429, 500])('propage HTTP %s sans contourner l’erreur', async (status) => {
    const error = { status };
    vi.mocked(apiClient.get).mockRejectedValue(error);
    await expect(planningDataApi.getReservationDetails([1], '2026-10-01', '2026-10-31')).rejects.toBe(error);
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
