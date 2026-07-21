import { describe, it, expect, vi, beforeEach } from 'vitest';
import { guestsApi } from '../guestsApi';
import apiClient from '../../apiClient';

// Le apiClient réel dépend de Keycloak/fetch : stub déterministe.
vi.mock('../../apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe('guestsApi.listPage — pagination serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('whenCalledWithPageSizeAndFilters_thenPassesParamsToServer', async () => {
    const pageResponse = {
      content: [{ id: 1, firstName: 'Alice', lastName: 'Dupont', fullName: 'Alice Dupont', totalStays: 2, totalSpent: 100, organizationId: 1 }],
      page: 1,
      size: 25,
      totalElements: 51,
    };
    mockedGet.mockResolvedValue(pageResponse);

    const result = await guestsApi.listPage({ page: 1, size: 25, search: 'ali', channel: 'AIRBNB' });

    expect(mockedGet).toHaveBeenCalledWith('/guests/list', {
      params: { page: 1, size: 25, search: 'ali', channel: 'AIRBNB' },
    });
    expect(result.totalElements).toBe(51);
    expect(result.content).toHaveLength(1);
  });

  it('whenNoFilters_thenOnlyPageAndSizeAreSent', async () => {
    mockedGet.mockResolvedValue({ content: [], page: 0, size: 25, totalElements: 0 });

    await guestsApi.listPage({ page: 0, size: 25 });

    expect(mockedGet).toHaveBeenCalledWith('/guests/list', {
      params: { page: 0, size: 25 },
    });
  });
});
