// ===========================================
// Clenzy — Configuration tests de performance K6
// ===========================================
// Variables partagees entre tous les scripts de test.
// Surchargeables via variables d'environnement.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const API_BASE = `${BASE_URL}/api`;

// Keycloak
export const KEYCLOAK_URL = __ENV.KEYCLOAK_URL || 'http://localhost:8443';
export const KEYCLOAK_REALM = __ENV.KEYCLOAK_REALM || 'clenzy';
export const KEYCLOAK_CLIENT_ID = __ENV.KEYCLOAK_CLIENT_ID || 'clenzy-web';

// Utilisateur de test (doit exister dans Keycloak)
export const TEST_USER = __ENV.TEST_USER || 'perf-test@clenzy.fr';
export const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'PerfTest2026!';

// Seuils de performance par defaut
export const THRESHOLDS = {
  // 95% des requetes < 500ms, 99% < 1500ms
  http_req_duration_p95: 500,
  http_req_duration_p99: 1500,
  // Taux d'erreur < 1%
  http_req_failed_rate: 0.01,
  // Debit minimum : 50 req/s
  http_reqs_rate: 50,
};
