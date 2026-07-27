import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interventionsApi } from '../interventionsApi';
import apiClient from '../../apiClient';

// Le apiClient réel dépend de Keycloak/fetch : stub déterministe.
vi.mock('../../apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe('interventionsApi.getPage — pagination serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('whenCalledWithPageSizeAndFilters_thenPassesParamsToServer', async () => {
    const pageResponse = {
      content: [{ id: 1 }],
      totalElements: 42,
      totalPages: 7,
      size: 6,
      number: 2,
      first: false,
      last: false,
    };
    mockedGet.mockResolvedValue(pageResponse);

    const params = {
      page: 2,
      size: 6,
      type: 'CLEANING',
      status: 'SCHEDULED',
      priority: 'HIGH',
      propertyId: 42,
    };
    const result = await interventionsApi.getPage(params);

    expect(mockedGet).toHaveBeenCalledWith('/interventions', { params });
    expect(result.totalElements).toBe(42);
    expect(result.content).toHaveLength(1);
  });

  it('whenCalledWithoutParams_thenCallsServerWithEmptyParams', async () => {
    mockedGet.mockResolvedValue({
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 20,
      number: 0,
      first: true,
      last: true,
    });

    await interventionsApi.getPage();

    expect(mockedGet).toHaveBeenCalledWith('/interventions', { params: {} });
  });

});
