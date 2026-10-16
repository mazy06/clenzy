import { afterEach, describe, expect, it, vi } from 'vitest';
import apiClient from '../../apiClient';
import { propertiesApi } from '../propertiesApi';

afterEach(() => vi.restoreAllMocks());

const page = (ids: number[], totalPages: number) => ({ content: ids.map((id) => ({ id })), totalPages });

describe('propertiesApi.getAll', () => {
  it('whenNoSizeIsGiven_thenEveryPageIsLoaded', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce(page([3, 2], 2))
      .mockResolvedValueOnce(page([1], 2));

    const properties = await propertiesApi.getAll();

    expect(properties.map((p) => p.id)).toEqual([3, 2, 1]);
    expect(get).toHaveBeenNthCalledWith(2, '/properties', { params: { page: 1, size: 1000 } });
  });

  it('whenASizeIsGiven_thenOnlyThatPageIsLoaded', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(page([1, 2], 9));

    const properties = await propertiesApi.getAll({ size: 2 });

    expect(properties).toHaveLength(2);
    expect(get).toHaveBeenCalledTimes(1);
  });
});
