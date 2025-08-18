// Configuration centralisée de l'API
export const API_CONFIG = {
  // URLs de base
  BASE_URL: 'http://localhost:8080',
  BASE_PATH: '/api',
  
  // Endpoints d'authentification
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/logout',
    ME: '/me',
  },
  
  // URLs complètes
  ENDPOINTS: {
    LOGIN: 'http://localhost:8080/api/auth/login',
    LOGOUT: 'http://localhost:8080/api/logout',
    ME: 'http://localhost:8080/api/me',
  }
} as const;

// Configuration Keycloak
export const KEYCLOAK_CONFIG = {
  URL: 'http://localhost:8081',
  REALM: 'clenzy',
  CLIENT_ID: 'clenzy-web',
} as const;

// Configuration de l'application
export const APP_CONFIG = {
  NAME: 'Clenzy',
  VERSION: '1.0.0',
} as const;

// Fonction utilitaire pour construire les URLs de l'API
export const buildApiUrl = (endpoint: string): string => {
  return `${API_CONFIG.BASE_URL}${API_CONFIG.BASE_PATH}${endpoint}`;
};

// Fonction utilitaire pour construire les URLs Keycloak
export const buildKeycloakUrl = (endpoint: string): string => {
  return `${KEYCLOAK_CONFIG.URL}/realms/${KEYCLOAK_CONFIG.REALM}${endpoint}`;
};
