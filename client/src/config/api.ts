// Configuration centralisée de l'API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8084';
const API_BASE_PATH = import.meta.env.VITE_API_BASE_PATH || '/api';

export const API_CONFIG = {
  // URLs de base
  BASE_URL: API_BASE_URL,
  BASE_PATH: API_BASE_PATH,

  // Endpoints d'authentification
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/logout',
    ME: '/me',
  },

  // URLs complètes
  ENDPOINTS: {
    LOGIN: `${API_BASE_URL}${API_BASE_PATH}/auth/login`,
    LOGOUT: `${API_BASE_URL}${API_BASE_PATH}/logout`,
    ME: `${API_BASE_URL}${API_BASE_PATH}/me`,
  }
} as const;

// Configuration Keycloak
export const KEYCLOAK_CONFIG = {
  URL: import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8083',
  REALM: import.meta.env.VITE_KEYCLOAK_REALM || 'clenzy',
  CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'clenzy-web',
} as const;

// Configuration de l'application
export const APP_CONFIG = {
  NAME: import.meta.env.VITE_APP_NAME || 'Clenzy',
  VERSION: import.meta.env.VITE_APP_VERSION || '1.0.0',
} as const;

// Fonction utilitaire pour construire les URLs de l'API
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
};

// Fonction utilitaire pour construire les URLs Keycloak
export const buildKeycloakUrl = (endpoint: string): string => {
  return `${KEYCLOAK_CONFIG.URL}/realms/${KEYCLOAK_CONFIG.REALM}${endpoint}`;
};
