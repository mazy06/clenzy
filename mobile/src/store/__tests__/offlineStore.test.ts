beforeEach(() => {
  jest.clearAllMocks();
  const { useOfflineStore } = require('../offlineStore');
  useOfflineStore.setState({
    pendingActions: [],
    lastSyncTimestamp: 0,
    isSyncing: false,
  });
});

function getStore() {
  const { useOfflineStore } = require('../offlineStore');
  return useOfflineStore;
}

describe('offlineStore', () => {
  describe('initial state', () => {
    it('should have default values', () => {
      const state = getStore().getState();
      expect(state.pendingActions).toEqual([]);
      expect(state.lastSyncTimestamp).toBe(0);
      expect(state.isSyncing).toBe(false);
    });
  });

  describe('enqueue', () => {
    it('should add an action to pendingActions', () => {
      const store = getStore();
      const id = store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/interventions',
        method: 'POST',
        payload: { name: 'test' },
        maxRetries: 3,
        dependencies: [],
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');

      const state = store.getState();
      expect(state.pendingActions).toHaveLength(1);
      expect(state.pendingActions[0]).toMatchObject({
        id,
        type: 'CREATE',
        endpoint: '/interventions',
        method: 'POST',
        payload: { name: 'test' },
        maxRetries: 3,
        dependencies: [],
        retryCount: 0,
        status: 'PENDING',
      });
      expect(state.pendingActions[0].createdAt).toBeGreaterThan(0);
    });

    it('should enqueue multiple actions', () => {
      const store = getStore();
      store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/a',
        method: 'POST',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });
      store.getState().enqueue({
        type: 'UPDATE',
        endpoint: '/b',
        method: 'PUT',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });

      expect(store.getState().pendingActions).toHaveLength(2);
    });
  });

  describe('dequeue', () => {
    it('should remove an action by id', () => {
      const store = getStore();
      const id = store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/test',
        method: 'POST',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });

      expect(store.getState().pendingActions).toHaveLength(1);
      store.getState().dequeue(id);
      expect(store.getState().pendingActions).toHaveLength(0);
    });

    it('should not affect other actions', () => {
      const store = getStore();
      const id1 = store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/a',
        method: 'POST',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });
      store.getState().enqueue({
        type: 'UPDATE',
        endpoint: '/b',
        method: 'PUT',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });

      store.getState().dequeue(id1);
      expect(store.getState().pendingActions).toHaveLength(1);
      expect(store.getState().pendingActions[0].endpoint).toBe('/b');
    });
  });

  describe('updateStatus', () => {
    it('should update action status', () => {
      const store = getStore();
      const id = store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/test',
        method: 'POST',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });

      store.getState().updateStatus(id, 'SYNCING');
      expect(store.getState().pendingActions[0].status).toBe('SYNCING');

      store.getState().updateStatus(id, 'FAILED');
      expect(store.getState().pendingActions[0].status).toBe('FAILED');
    });
  });

  describe('incrementRetry', () => {
    it('should increment retryCount', () => {
      const store = getStore();
      const id = store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/test',
        method: 'POST',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });

      expect(store.getState().pendingActions[0].retryCount).toBe(0);
      store.getState().incrementRetry(id);
      expect(store.getState().pendingActions[0].retryCount).toBe(1);
      store.getState().incrementRetry(id);
      expect(store.getState().pendingActions[0].retryCount).toBe(2);
    });
  });

  describe('getPending', () => {
    it('should return only PENDING actions', () => {
      const store = getStore();
      const id1 = store.getState().enqueue({
        type: 'CREATE',
        endpoint: '/a',
        method: 'POST',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });
      store.getState().enqueue({
        type: 'UPDATE',
        endpoint: '/b',
        method: 'PUT',
        payload: {},
        maxRetries: 3,
        dependencies: [],
      });

      store.getState().updateStatus(id1, 'FAILED');

      const pending = store.getState().getPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].endpoint).toBe('/b');
    });
  });

  describe('setSyncing', () => {
    it('should toggle syncing state', () => {
      const store = getStore();
      expect(store.getState().isSyncing).toBe(false);

      store.getState().setSyncing(true);
      expect(store.getState().isSyncing).toBe(true);

      store.getState().setSyncing(false);
      expect(store.getState().isSyncing).toBe(false);
    });
  });

  describe('setLastSync', () => {
    it('should update lastSyncTimestamp', () => {
      const store = getStore();
      const now = Date.now();
      store.getState().setLastSync(now);
      expect(store.getState().lastSyncTimestamp).toBe(now);
    });
  });
});
