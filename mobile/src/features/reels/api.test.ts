import { QueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { reelsApi } from './api';

jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/features/marketplace/queries', () => ({ useBaitlyScope: jest.fn() }));
jest.mock('@/config/baitlyDataMode', () => ({ baitlyDataMode: () => 'real' }));

describe('first Réel settings visit', () => {
  it.each([undefined, null])('accepts an absent social profile (%s) in React Query', async response => {
    jest.mocked(apiClient.get).mockResolvedValueOnce(response);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await expect(client.fetchQuery({ queryKey: ['reels-settings'], queryFn: reelsApi.settings })).resolves.toBeNull();
    client.clear();
  });
  it('preserves the server connection availability', async () => {
    const settings = { displayName: '', published: false, instagramConfigured: true, instagramConnected: false };
    jest.mocked(apiClient.get).mockResolvedValueOnce(settings);
    await expect(reelsApi.settings()).resolves.toEqual(settings);
  });
});
