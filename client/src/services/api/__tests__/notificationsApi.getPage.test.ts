import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationsApi } from '../notificationsApi';
import apiClient from '../../apiClient';

// Le apiClient réel dépend de Keycloak/fetch : stub déterministe.
vi.mock('../../apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe('notificationsApi.getPage — pagination serveur', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    notificationsApi.resetAvailability();
  });

  it('whenCalledWithFilters_thenPassesParamsToServer', async () => {
    const pageResponse = { content: [{ id: 1 }], page: 0, size: 10, totalElements: 33 };
    mockedGet.mockResolvedValue(pageResponse);

    const result = await notificationsApi.getPage({ page: 0, size: 10, category: 'payment' });

    expect(mockedGet).toHaveBeenCalledWith('/notifications', {
      params: { page: 0, size: 10, category: 'payment', unread: undefined },
    });
    expect(result.totalElements).toBe(33);
    expect(result.content).toHaveLength(1);
  });

  it('whenUnreadTab_thenSendsUnreadTrue', async () => {
    mockedGet.mockResolvedValue({ content: [], page: 0, size: 10, totalElements: 0 });

    await notificationsApi.getPage({ page: 0, size: 10, unread: true });

    expect(mockedGet).toHaveBeenCalledWith('/notifications', {
      params: { page: 0, size: 10, category: undefined, unread: true },
    });
  });

  it('whenBackendFails_thenReturnsEmptyPageAndMarksUnavailable', async () => {
    mockedGet.mockRejectedValue(new Error('boom'));

    const result = await notificationsApi.getPage({ page: 2, size: 10 });

    expect(result).toEqual({ content: [], page: 2, size: 10, totalElements: 0 });

    // Endpoint marqué indisponible : l'appel suivant n'atteint plus le réseau.
    mockedGet.mockClear();
    const next = await notificationsApi.getPage({ page: 0, size: 10 });
    expect(mockedGet).not.toHaveBeenCalled();
    expect(next.totalElements).toBe(0);
  });
});
