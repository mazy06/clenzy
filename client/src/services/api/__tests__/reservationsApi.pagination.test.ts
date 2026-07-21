import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks AVANT l'import du module sous test (hoisting vitest).
// apiClient a un export default ET un export nommé — mocker les deux.
vi.mock('../../apiClient', () => {
  const mock = { get: vi.fn() };
  return { default: mock, apiClient: mock };
});
vi.mock('../../storageService', () => ({
  isMockEnabled: vi.fn(() => false),
  setMockEnabled: vi.fn(),
}));

import apiClient from '../../apiClient';
import { isMockEnabled } from '../../storageService';
import { reservationsApi } from '../reservationsApi';

const apiGet = vi.mocked(apiClient.get);
const mockEnabled = vi.mocked(isMockEnabled);

/**
 * Pagination serveur des réservations (audit perf 2026-07-21, P1-6).
 *
 * Contrat : GET /reservations sans `page` = liste historique (shape inchangée) ;
 * avec `page` (+ `size`, `search`) = enveloppe {content, totalElements, ...}.
 */
describe('reservationsApi — pagination serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnabled.mockReturnValue(false);
  });

  describe('getAll (mode historique)', () => {
    it('n\'envoie ni page ni size — le backend reste en mode liste', async () => {
      apiGet.mockResolvedValueOnce([]);

      await reservationsApi.getAll({ propertyIds: [1, 2], status: 'confirmed' });

      expect(apiGet).toHaveBeenCalledWith('/reservations', {
        params: { propertyIds: '1,2', status: 'confirmed' },
      });
      const params = apiGet.mock.calls[0][1]!.params as Record<string, unknown>;
      expect(params).not.toHaveProperty('page');
      expect(params).not.toHaveProperty('size');
    });
  });

  describe('getPage (mode paginé opt-in)', () => {
    it('envoie page/size/search + filtres au format Spring', async () => {
      apiGet.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 1, size: 25 });

      await reservationsApi.getPage({
        propertyIds: [3],
        status: 'pending',
        source: 'airbnb',
        page: 1,
        size: 25,
        search: ' jean ',
      });

      expect(apiGet).toHaveBeenCalledWith('/reservations', {
        params: {
          propertyIds: '3',
          status: 'pending',
          source: 'airbnb',
          page: 1,
          size: 25,
          search: 'jean',
        },
      });
    });

    it('omet search quand le terme est vide ou blanc', async () => {
      apiGet.mockResolvedValueOnce({ content: [], totalElements: 0, totalPages: 0, number: 0, size: 10 });

      await reservationsApi.getPage({ page: 0, size: 10, search: '   ' });

      const params = apiGet.mock.calls[0][1]!.params as Record<string, unknown>;
      expect(params).not.toHaveProperty('search');
    });
  });

  describe('getPage (mode mock)', () => {
    beforeEach(() => {
      mockEnabled.mockReturnValue(true);
    });

    it('pagine le jeu mock et calcule les métadonnées', async () => {
      const size = 3;
      const firstPage = await reservationsApi.getPage({ page: 0, size });

      expect(apiGet).not.toHaveBeenCalled();
      expect(firstPage.number).toBe(0);
      expect(firstPage.size).toBe(size);
      expect(firstPage.content.length).toBeLessThanOrEqual(size);
      expect(firstPage.totalPages).toBe(Math.ceil(firstPage.totalElements / size));
    });

    it('retourne une page vide au-delà du total', async () => {
      const probe = await reservationsApi.getPage({ page: 0, size: 5 });
      const beyond = await reservationsApi.getPage({ page: probe.totalPages + 1, size: 5 });

      expect(beyond.content).toHaveLength(0);
      expect(beyond.totalElements).toBe(probe.totalElements);
    });
  });
});
