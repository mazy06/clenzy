import { marketplaceApi } from '../api';
import { apiClient } from '@/api/apiClient';
import { useAuthStore } from '@/store/authStore';
jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn() } }));
jest.mock('@/store/authStore', () => ({ useAuthStore: { getState: jest.fn() } }));
describe('Baitly public directory', () => {
  beforeEach(() => { jest.clearAllMocks();jest.mocked(apiClient.get).mockResolvedValue({items:[],id:12}); });
  it('browses anonymously without sending or refreshing a token', async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ isAuthenticated: false });
    await marketplaceApi.catalog('', '', 0);
    expect(apiClient.get).toHaveBeenCalledWith('/public/baitly-catalog', expect.objectContaining({ skipAuth: true }));
    await marketplaceApi.provider(12);
    expect(apiClient.get).toHaveBeenLastCalledWith('/public/baitly-catalog/12', expect.objectContaining({ skipAuth: true }));
  });
  it('retains organization visibility for signed-in accounts', async () => {
    (useAuthStore.getState as jest.Mock).mockReturnValue({ isAuthenticated: true });
    await marketplaceApi.catalog('', '', 0);
    expect(apiClient.get).toHaveBeenCalledWith('/provider-catalog', expect.objectContaining({ skipAuth: false }));
  });
});
