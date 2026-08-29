// Configuration centralisée de l'API

/**
 * Hôtes de boucle locale : depuis un autre appareil, ils ne désignent plus la
 * machine de dev mais l'appareil lui-même.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/**
 * Aligne l'hôte d'une URL de service sur celui de la page.
 *
 * En dev, le backend et Keycloak sont configurés en `localhost` (docker-compose
 * injecte VITE_API_BASE_URL / VITE_KEYCLOAK_URL dans le conteneur du front, et
 * ces variables d'environnement priment sur les fichiers `.env` — les éditer
 * n'a donc aucun effet). Quand on ouvre l'app depuis un téléphone du réseau
 * local (http://192.168.x.y:3000), `localhost` désigne le téléphone : l'API et
 * Keycloak sont injoignables.
 *
 * On recopie donc l'hôte de la page dans l'URL du service, en gardant schéma,
 * port et chemin. La réécriture ne se déclenche que si l'URL configurée EST
 * une boucle locale et que la page ne l'est PAS : la prod
 * (https://api.clenzy.fr servi depuis app.clenzy.fr) n'est jamais touchée.
 */
const alignHostWithPage = (url: string): string => {
  if (typeof window === 'undefined') return url;
  const pageHost = window.location.hostname;
  if (LOOPBACK_HOSTS.has(pageHost)) return url;
  try {
    const parsed = new URL(url);
    if (!LOOPBACK_HOSTS.has(parsed.hostname)) return url;
    parsed.hostname = pageHost;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return url;
  }
};

const API_BASE_URL = alignHostWithPage(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8084');
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
  URL: alignHostWithPage(import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8083'),
  REALM: import.meta.env.VITE_KEYCLOAK_REALM || 'clenzy',
  CLIENT_ID: import.meta.env.VITE_KEYCLOAK_CLIENT_ID || 'clenzy-web',
} as const;

// Configuration de l'application
export const APP_CONFIG = {
  NAME: import.meta.env.VITE_APP_NAME || 'Baitly',
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
