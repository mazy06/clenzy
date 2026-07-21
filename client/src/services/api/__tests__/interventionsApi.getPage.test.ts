import { describe, it, expect, vi, beforeEach } from 'vitest';
import { interventionsApi } from '../interventionsApi';
import apiClient from '../../apiClient';
import { isMockEnabled } from '../../storageService';

// Le apiClient réel dépend de Keycloak/fetch : stub déterministe.
vi.mock('../../apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

vi.mock('../../storageService', () => ({
  isMockEnabled: vi.fn(() => false),
  setMockEnabled: vi.fn(),
}));

const mockedGet = vi.mocked(apiClient.get);
const mockedIsMockEnabled = vi.mocked(isMockEnabled);

describe('interventionsApi.getPage — pagination serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsMockEnabled.mockReturnValue(false);
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

  it('whenMockModeEnabled_thenFiltersAndPaginatesLocally', async () => {
    // import.meta.env.DEV est true sous Vitest : le mode mock est actif.
    mockedIsMockEnabled.mockReturnValue(true);

    const page0 = await interventionsApi.getPage({ page: 0, size: 4, type: 'CLEANING' });

    expect(mockedGet).not.toHaveBeenCalled();
    expect(page0.content).toHaveLength(4);
    expect(page0.content.every((i) => i.type === 'CLEANING')).toBe(true);
    expect(page0.totalElements).toBe(10); // 10 CLEANING dans le jeu mock
    expect(page0.totalPages).toBe(3);
    expect(page0.first).toBe(true);
    expect(page0.last).toBe(false);

    const lastPage = await interventionsApi.getPage({ page: 2, size: 4, type: 'CLEANING' });
    expect(lastPage.content).toHaveLength(2);
    expect(lastPage.last).toBe(true);
  });

  it('whenMockModeWithStatusFilter_thenOnlyMatchingRows', async () => {
    mockedIsMockEnabled.mockReturnValue(true);

    const result = await interventionsApi.getPage({ page: 0, size: 50, status: 'SCHEDULED' });

    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content.every((i) => i.status === 'SCHEDULED')).toBe(true);
    expect(result.totalElements).toBe(result.content.length);
  });
});
