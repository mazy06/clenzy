import { API_CONFIG } from '@/config/api';
import { apiClient } from '@/api/apiClient';
import { baitlyDemoCatalog, baitlyDemoProviders, isBaitlyDemoCatalogEnabled } from '../baitlyDemoCatalog';
import { marketplaceApi } from '../api';
import { useBaitlyDataMode } from '@/config/baitlyDataMode';

jest.mock('@/config/api', () => ({ API_CONFIG: { BASE_URL: 'http://localhost:8084' } }));
jest.mock('@/api/apiClient', () => ({ apiClient: { get: jest.fn(), post: jest.fn() } }));
jest.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ isAuthenticated: false }) } }));

describe('Baitly local demo catalog', () => {
  const previousFlag = process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG;
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG = '1';
    (API_CONFIG as { BASE_URL: string }).BASE_URL = 'http://localhost:8084';
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
    useBaitlyDataMode.getState().setMode('demo');
  });
  afterAll(() => {
    if (previousFlag === undefined) delete process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG;
    else process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG = previousFlag;
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;
  });
  it('requires explicit opt-in, a development build and a local API', () => {
    expect(isBaitlyDemoCatalogEnabled()).toBe(true);
    process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG = '0';
    useBaitlyDataMode.getState().setMode('real');
    expect(isBaitlyDemoCatalogEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG = '1';
    useBaitlyDataMode.getState().setMode('demo');
    (API_CONFIG as { BASE_URL: string }).BASE_URL = 'https://api.clenzy.fr';
    expect(isBaitlyDemoCatalogEnabled()).toBe(false);
    (API_CONFIG as { BASE_URL: string }).BASE_URL = 'http://localhost:8084';
    (globalThis as unknown as { __DEV__: boolean }).__DEV__ = false;
    expect(isBaitlyDemoCatalogEnabled()).toBe(false);
  });
  it('supports provider search, city and trade filters without backend access', async () => {
    const all = await marketplaceApi.catalog('', '', 0);
    expect(all.totalElements).toBe(5);
    expect(all.items.every(p => p.demo && !p.verified && p.id < 0)).toBe(true);
    expect(baitlyDemoCatalog('menage', 'cleaning', 0, 'Marrakech').items.map(p => p.displayName)).toEqual(['Dar Zellige']);
    expect(baitlyDemoCatalog('', '', 0, 'Paris').items).toEqual([]);
    expect(baitlyDemoCatalog('Marrakech', '', 0).totalElements).toBe(5);
    expect(baitlyDemoCatalog('Dar Zellige', '', 0).items.map(p => p.id)).toEqual([-1]);
    expect(baitlyDemoCatalog('', '', 1).items).toEqual([]);
    expect((await marketplaceApi.provider(-1)).offers.length).toBe(2);
    expect(apiClient.get).not.toHaveBeenCalled();
  });
  it('never creates a real quote for a synthetic ID, even after disabling demo', async () => {
    await expect(marketplaceApi.create({ providerId: -1, title: 'Test' })).rejects.toThrow('démonstration');
    process.env.EXPO_PUBLIC_BAITLY_DEMO_CATALOG = '0';
    useBaitlyDataMode.getState().setMode('real');
    await expect(marketplaceApi.provider(-1)).rejects.toThrow('désactivé');
    await expect(marketplaceApi.create({ providerId: -1, title: 'Test' })).rejects.toThrow('démonstration');
    expect(apiClient.post).not.toHaveBeenCalled();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
  it('keeps the local database review snapshot consistent and explicitly fictional', () => {
    const reviews = baitlyDemoProviders.flatMap(p => p.demoReviews ?? []);
    expect(reviews).toHaveLength(12);
    expect(new Set(reviews.map(review => review.id)).size).toBe(12);
    expect(new Set(reviews.map(review => review.clientRole))).toEqual(new Set(['OWNER', 'CONCIERGE']));
    expect(reviews.every(review => review.demo && review.providerId < 0 && review.rating >= 1 && review.rating <= 5
      && review.portraitIndex != null && review.portraitIndex >= 0 && review.portraitIndex <= 5 && review.clientName && review.feedback && review.serviceLabel)).toBe(true);
    expect(baitlyDemoProviders.find(p => p.id === -1)?.ratingAvg).toBeCloseTo(4.6667, 3);
    expect(baitlyDemoProviders.find(p => p.id === -3)?.ratingAvg).toBe(3.5);
    expect(baitlyDemoProviders.find(p => p.id === -1)?.ratingCount).toBe(3);
  });
});
