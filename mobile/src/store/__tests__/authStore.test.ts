import * as SecureStore from 'expo-secure-store';

// Reset module state between tests
beforeEach(() => {
  jest.clearAllMocks();
  // Reset Zustand store by re-importing
  const { useAuthStore } = require('../authStore');
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: true,
    isInitialized: false,
  });
});

function getStore() {
  const { useAuthStore } = require('../authStore');
  return useAuthStore;
}

describe('authStore', () => {
  describe('initial state', () => {
    it('should have default values', () => {
      const state = getStore().getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(true);
      expect(state.isInitialized).toBe(false);
    });
  });

  describe('setTokens', () => {
    it('should store tokens in SecureStore and update state', async () => {
      const store = getStore();
      await store.getState().setTokens('access-123', 'refresh-456');

      const state = store.getState();
      expect(state.accessToken).toBe('access-123');
      expect(state.refreshToken).toBe('refresh-456');
      expect(state.isAuthenticated).toBe(false);

      expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('clenzy_access_token', 'access-123');
      expect(SecureStore.setItemAsync).toHaveBeenCalledWith('clenzy_refresh_token', 'refresh-456');
    });
  });

  describe('logout', () => {
    it('should clear tokens and user', async () => {
      const store = getStore();
      // Set some state first
      store.setState({
        user: { id: '1', email: 'test@test.com', username: 'test', roles: ['HOST'], permissions: [] },
        accessToken: 'token',
        refreshToken: 'refresh',
        isAuthenticated: true,
      });

      await store.getState().logout();

      const state = store.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isAuthenticated).toBe(false);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('clenzy_access_token');
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('clenzy_refresh_token');
    });
  });

  describe('role helpers', () => {
    beforeEach(() => {
      const store = getStore();
      store.setState({
        user: {
          id: '1',
          email: 'test@test.com',
          username: 'test',
          roles: ['SUPER_ADMIN', 'HOST'],
          permissions: [],
        },
        isAuthenticated: true,
      });
    });

    it('hasRole returns true for existing role', () => {
      expect(getStore().getState().hasRole('SUPER_ADMIN')).toBe(true);
      expect(getStore().getState().hasRole('HOST')).toBe(true);
    });

    it('hasRole returns false for missing role', () => {
      expect(getStore().getState().hasRole('TECHNICIAN')).toBe(false);
    });

    it('hasAnyRole returns true if any role matches', () => {
      expect(getStore().getState().hasAnyRole(['SUPER_ADMIN', 'TECHNICIAN'])).toBe(true);
    });

    it('hasAnyRole returns false if no role matches', () => {
      expect(getStore().getState().hasAnyRole(['TECHNICIAN', 'HOUSEKEEPER'])).toBe(false);
    });

    it('isSuperAdmin returns true for SUPER_ADMIN', () => {
      expect(getStore().getState().isSuperAdmin()).toBe(true);
    });

    it('isHost returns true for HOST', () => {
      expect(getStore().getState().isHost()).toBe(true);
    });

    it('isTechnician returns false when not TECHNICIAN', () => {
      expect(getStore().getState().isTechnician()).toBe(false);
    });

    it('isPlatformStaff returns true for SUPER_ADMIN', () => {
      expect(getStore().getState().isPlatformStaff()).toBe(true);
    });
  });

  describe('role helpers with no user', () => {
    it('hasRole returns false when no user', () => {
      expect(getStore().getState().hasRole('HOST')).toBe(false);
    });

    it('hasAnyRole returns false when no user', () => {
      expect(getStore().getState().hasAnyRole(['HOST'])).toBe(false);
    });
  });

  describe('initialize', () => {
    it('should set isInitialized=true and isLoading=false when no tokens stored', async () => {
      (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);

      const store = getStore();
      await store.getState().initialize();

      const state = store.getState();
      expect(state.isInitialized).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.isAuthenticated).toBe(false);
    });
  });
});

describe('native login session', () => {
  it('opens the account only after the authenticated profile loads', async () => {
    globalThis.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ subject: 'A', role: 'HOST', email: 'a@test.invalid' }) });
    await getStore().getState().login(' a@test.invalid ', 'password');
    expect(globalThis.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining('/api/auth/login'), expect.objectContaining({
      body: JSON.stringify({ username: 'a@test.invalid', password: 'password' }), credentials: 'omit',
    }));
    expect(getStore().getState().user.id).toBe('A');
    expect(getStore().getState().isAuthenticated).toBe(true);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalledWith('clenzy_access_token', 'access');
  });
  it('does not open an account or save tokens after invalid credentials', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: 'authentication_failed' }) });
    await expect(getStore().getState().login('a@test.invalid', 'wrong')).rejects.toMatchObject({ reason: 'credentials' });
    expect(getStore().getState().isAuthenticated).toBe(false);
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
  it('preserves the server CAPTCHA protection and sends a challenge token only when supplied', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: 'captcha_required', captchaRequired: true }) });
    await expect(getStore().getState().login('a@test.invalid', 'password')).rejects.toMatchObject({ reason: 'captcha' });
    await expect(getStore().getState().login('a@test.invalid', 'password', 'challenge')).rejects.toMatchObject({ reason: 'captcha' });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(expect.stringContaining('/api/auth/login'), expect.objectContaining({
      body: JSON.stringify({ username: 'a@test.invalid', password: 'password', captchaToken: 'challenge' }),
    }));
    expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
  });
  it('refreshes through the backend client that issued the native login tokens', async () => {
    const store = getStore();
    store.setState({ refreshToken: 'old' });
    globalThis.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'new-access', refresh_token: 'new-refresh' }) });
    expect(await store.getState().refreshAccessToken()).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining('/public/baitly-session/refresh'), expect.objectContaining({ body: JSON.stringify({ refreshToken: 'old' }) }));
    expect(store.getState().refreshToken).toBe('new-refresh');
  });
});
