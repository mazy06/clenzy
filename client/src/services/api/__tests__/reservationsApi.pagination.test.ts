import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks AVANT l'import du module sous test (hoisting vitest).
// apiClient a un export default ET un export nommé — mocker les deux.
vi.mock('../../apiClient', () => {
  const mock = { get: vi.fn() };
  return { default: mock, apiClient: mock };
});
import apiClient from '../../apiClient';
import { reservationsApi } from '../reservationsApi';

const apiGet = vi.mocked(apiClient.get);

/**
 * Pagination serveur des réservations (audit perf 2026-07-21, P1-6).
 *
 * Contrat : GET /reservations sans `page` = liste historique (shape inchangée) ;
 * avec `page` (+ `size`, `search`) = enveloppe {content, totalElements, ...}.
 */
describe('reservationsApi — pagination serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
