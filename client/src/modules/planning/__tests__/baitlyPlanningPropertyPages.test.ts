import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../../services/apiClient';
import { planningDataApi } from '../../../services/api/planningDataApi';

vi.mock('../../../services/apiClient', () => ({ default: { get: vi.fn() } }));
beforeEach(() => vi.mocked(apiClient.get).mockReset());

describe('catalogue paginé léger Baitly', () => {
  it('récupère les 1 101 logements, au-delà de la première page de 1 000', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (_url, options) => {
      const page = Number(options?.params?.page);
      const count = page === 5 ? 101 : 200;
      return { content: Array.from({ length: count }, (_, i) => ({ id: page * 200 + i + 1, name: 'Logement' })),
        number: page, totalPages: 6 };
    });
    const properties = await planningDataApi.getProperties();
    expect(properties).toHaveLength(1101);
    expect(properties.at(-1)?.id).toBe(1101);
    expect(apiClient.get).toHaveBeenCalledTimes(6);
  });

  it('fait remonter une page en échec au lieu de masquer un portefeuille incomplet', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ content: [{ id: 1 }], number: 0, totalPages: 2 });
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network'));
    await expect(planningDataApi.getProperties()).rejects.toThrow('network');
  });

  it('borne les lots de l’index à 500 IDs tout en conservant les données hors page', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (_url, options) => {
      const ids = String(options?.params?.propertyIds).split(',').map(Number);
      return { reservations: ids.map((id) => ({ id, propertyId: id })), interventions: [], awaitingPayment: [], blocked: [] };
    });
    const ids = Array.from({ length: 1101 }, (_, i) => i + 1);
    const result = await planningDataApi.getIndex([...ids, 1], '2026-10-01', '2026-10-31');
    expect(result.reservations).toHaveLength(1101);
    expect(apiClient.get).toHaveBeenCalledTimes(3);
    for (const [, options] of vi.mocked(apiClient.get).mock.calls) {
      expect(String(options?.params?.propertyIds).split(',').length).toBeLessThanOrEqual(500);
    }
  });
});
