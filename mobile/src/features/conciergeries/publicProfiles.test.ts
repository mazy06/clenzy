jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/features/marketplace/queries', () => ({ useBaitlyScope: jest.fn() }));
jest.mock('@/config/baitlyDataMode', () => ({ baitlyDataMode: jest.fn() }));
import { apiClient } from '@/api/apiClient';
import { baitlyDataMode } from '@/config/baitlyDataMode';
import { publicProfilesApi } from './publicProfiles';

describe('public profile data boundary', () => {
  beforeEach(() => jest.clearAllMocks());
  it('reads public profiles through the API in real mode', async () => {
    jest.mocked(baitlyDataMode).mockReturnValue('real');
    jest.mocked(apiClient.get).mockResolvedValue([]);
    await expect(publicProfilesApi.list('OWNER', 'Paris')).resolves.toEqual([]);
    expect(apiClient.get).toHaveBeenCalledWith('/public/baitly-catalog/profiles', expect.objectContaining({ skipAuth: true, params: { role: 'OWNER', query: 'Paris' } }));
  });
  it('never substitutes demo profiles after an API error', async () => {
    jest.mocked(baitlyDataMode).mockReturnValue('real');
    jest.mocked(apiClient.get).mockRejectedValue(new Error('Offline'));
    await expect(publicProfilesApi.list('CONCIERGE', '')).rejects.toThrow('Offline');
  });
  it('does not submit real contacts in demonstration mode', async () => {
    jest.mocked(baitlyDataMode).mockReturnValue('demo');
    await expect(publicProfilesApi.contact('a-profile', 'Hello')).rejects.toThrow();
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
