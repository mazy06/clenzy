// Mock expo-secure-store
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const store = new Map();
  return {
    createMMKV: () => ({
      set: (key, value) => store.set(key, value),
      getString: (key) => store.get(key),
      getNumber: (key) => {
        const val = store.get(key);
        return val !== undefined ? Number(val) : undefined;
      },
      getBoolean: (key) => store.get(key),
      delete: (key) => store.delete(key),
      clearAll: () => store.clear(),
    }),
    MMKV: jest.fn().mockImplementation(() => ({
      set: (key, value) => store.set(key, value),
      getString: (key) => store.get(key),
      getNumber: (key) => store.get(key),
      getBoolean: (key) => store.get(key),
      delete: (key) => store.delete(key),
      clearAll: () => store.clear(),
    })),
  };
});

// Mock @react-native-community/netinfo
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
  fetch: jest.fn().mockResolvedValue({ isConnected: true, type: 'wifi' }),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[test]' }),
  getDevicePushTokenAsync: jest.fn().mockResolvedValue({ data: 'fcm-test-token', type: 'fcm' }),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  getLastNotificationResponseAsync: jest.fn().mockResolvedValue(null),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3, LOW: 2, MIN: 1 },
}));

// Mock expo-device
jest.mock('expo-device', () => ({
  isDevice: true,
}));

// Mock config/api
jest.mock('@/config/api', () => ({
  API_CONFIG: {
    BASE_URL: 'http://localhost:8080',
    BASE_PATH: '/api',
    ENDPOINTS: { ME: '/auth/me' },
  },
  KEYCLOAK_CONFIG: {
    issuer: 'http://localhost:8080/realms/clenzy',
    clientId: 'clenzy-mobile',
  },
}));

// Silence console.warn in tests
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('Zustand')) return;
  originalWarn.call(console, ...args);
};
