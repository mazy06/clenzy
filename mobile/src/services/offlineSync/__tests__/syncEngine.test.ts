import NetInfo from '@react-native-community/netinfo';

// Mock apiClient
jest.mock('@/api/apiClient', () => ({
  apiClient: {
    post: jest.fn().mockResolvedValue({}),
    put: jest.fn().mockResolvedValue({}),
    patch: jest.fn().mockResolvedValue({}),
    upload: jest.fn().mockResolvedValue({}),
  },
}));

import { apiClient } from '@/api/apiClient';

beforeEach(() => {
  jest.clearAllMocks();
  (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: true });

  const { useOfflineStore } = require('@/store/offlineStore');
  useOfflineStore.setState({
    pendingActions: [],
    lastSyncTimestamp: 0,
    isSyncing: false,
  });
});

function getStore() {
  const { useOfflineStore } = require('@/store/offlineStore');
  return useOfflineStore;
}

function enqueueAction(overrides = {}) {
  return getStore().getState().enqueue({
    type: 'CREATE' as const,
    endpoint: '/interventions',
    method: 'POST' as const,
    payload: { name: 'test' },
    maxRetries: 3,
    dependencies: [],
    ...overrides,
  });
}

describe('syncEngine', () => {
  describe('processSyncQueue', () => {
    it('should return 0/0 when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({ isConnected: false });

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('should return 0/0 when already syncing', async () => {
      getStore().getState().setSyncing(true);

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('should return 0/0 when queue is empty', async () => {
      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();
      expect(result).toEqual({ synced: 0, failed: 0 });
    });

    it('should sync a single pending action', async () => {
      enqueueAction();
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();

      expect(result).toEqual({ synced: 1, failed: 0 });
      expect(apiClient.post).toHaveBeenCalledWith('/interventions', { name: 'test' });
      expect(getStore().getState().pendingActions).toHaveLength(0);
      expect(getStore().getState().isSyncing).toBe(false);
      expect(getStore().getState().lastSyncTimestamp).toBeGreaterThan(0);
    });

    it('should sync multiple actions', async () => {
      enqueueAction({ endpoint: '/a' });
      enqueueAction({ endpoint: '/b' });
      (apiClient.post as jest.Mock).mockResolvedValue({});

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();

      expect(result).toEqual({ synced: 2, failed: 0 });
      expect(getStore().getState().pendingActions).toHaveLength(0);
    });

    it('should handle 4xx errors as non-retryable (mark FAILED)', async () => {
      enqueueAction();
      (apiClient.post as jest.Mock).mockRejectedValue({ status: 400 });

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();

      expect(result).toEqual({ synced: 0, failed: 1 });
      const actions = getStore().getState().pendingActions;
      expect(actions).toHaveLength(1);
      expect(actions[0].status).toBe('FAILED');
    });

    it('should use PUT method for UPDATE actions', async () => {
      enqueueAction({ type: 'UPDATE', method: 'PUT', endpoint: '/items/1' });
      (apiClient.put as jest.Mock).mockResolvedValue({});

      const { processSyncQueue } = require('../syncEngine');
      await processSyncQueue();

      expect(apiClient.put).toHaveBeenCalledWith('/items/1', { name: 'test' });
    });

    it('should respect dependencies', async () => {
      const id1 = enqueueAction({ endpoint: '/parent' });
      enqueueAction({ endpoint: '/child', dependencies: [id1] });

      let callOrder: string[] = [];
      (apiClient.post as jest.Mock).mockImplementation((endpoint) => {
        callOrder.push(endpoint);
        return Promise.resolve({});
      });

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();

      expect(result).toEqual({ synced: 2, failed: 0 });
      expect(callOrder[0]).toBe('/parent');
      expect(callOrder[1]).toBe('/child');
    });

    it('should break if remaining actions have unmet dependencies from failed parents', async () => {
      const id1 = enqueueAction({ endpoint: '/parent' });
      enqueueAction({ endpoint: '/child', dependencies: [id1] });

      (apiClient.post as jest.Mock).mockRejectedValueOnce({ status: 400 });

      const { processSyncQueue } = require('../syncEngine');
      const result = await processSyncQueue();

      // Parent fails (4xx non-retryable), child has unmet dependency → loop breaks
      expect(result.failed).toBeGreaterThanOrEqual(1);
    });
  });

  describe('startSyncListener / stopSyncListener', () => {
    it('should register NetInfo listener', () => {
      const { startSyncListener, stopSyncListener } = require('../syncEngine');

      startSyncListener();
      expect(NetInfo.addEventListener).toHaveBeenCalled();

      stopSyncListener();
    });

    it('should not register twice', () => {
      const { startSyncListener, stopSyncListener } = require('../syncEngine');

      startSyncListener();
      startSyncListener();
      // Should only call addEventListener once
      expect(NetInfo.addEventListener).toHaveBeenCalledTimes(1);

      stopSyncListener();
    });
  });
});
