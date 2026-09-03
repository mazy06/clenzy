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

/**
 * Rend absolue une URL de media renvoyee par le serveur.
 *
 * <p>Le backend emet un chemin relatif — {@code /api/users/12/profile-picture?ticket=…} —
 * parce qu'il ignore sous quelle origine le front est servi. Tel quel, le
 * navigateur le resout contre l'origine de la PAGE : juste seulement quand
 * l'API est co-hebergee. Ce n'est le cas ni en developpement (page sur :3000,
 * API sur :8084, et le proxy Vite ne couvre que /api/copilotkit) ni en
 * production (app.clenzy.fr contre api.clenzy.com). L'image partait donc en
 * 404 et l'avatar retombait silencieusement sur les initiales.</p>
 *
 * <p>La chaine de requete est preservee : c'est elle qui porte le ticket HMAC
 * sans lequel l'endpoint repond 401.</p>
 */
export function resolveMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  if (/^(https?:)?\/\//.test(url) || url.startsWith('data:')) return url;
  // Le chemin porte deja son prefixe `/api` : on ne prepend que l'origine.
  return url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
}

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
