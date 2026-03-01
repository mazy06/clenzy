/**
 * API Configuration
 * Mirroring client/src/config/api.ts
 */

const ENV = {
  development: {
    BASE_URL: 'http://192.168.1.70:8084',
    KEYCLOAK_URL: 'http://192.168.1.70:8086',
  },
  staging: {
    BASE_URL: 'https://api.staging.clenzy.fr',
    KEYCLOAK_URL: 'https://auth.staging.clenzy.fr',
  },
  production: {
    BASE_URL: 'https://api.clenzy.fr',
    KEYCLOAK_URL: 'https://auth.clenzy.fr',
  },
};

const environment = (__DEV__ ? 'development' : 'production') as keyof typeof ENV;

export const API_CONFIG = {
  BASE_URL: ENV[environment].BASE_URL,
  BASE_PATH: '/api',
  KEYCLOAK_URL: ENV[environment].KEYCLOAK_URL,
  KEYCLOAK_REALM: 'clenzy',
  KEYCLOAK_CLIENT_ID: 'clenzy-mobile',
  ENDPOINTS: {
    ME: '/me',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    PERMISSIONS_SYNC: '/permissions/sync',
    DEVICE_REGISTER: '/devices/register',
    DEVICE_UNREGISTER: '/devices',
  },
} as const;

export const KEYCLOAK_CONFIG = {
  issuer: `${API_CONFIG.KEYCLOAK_URL}/realms/${API_CONFIG.KEYCLOAK_REALM}`,
  clientId: API_CONFIG.KEYCLOAK_CLIENT_ID,
  redirectUrl: 'clenzy://auth/callback',
  scopes: ['openid', 'profile', 'email'],
  usePKCE: true,
} as const;
