// ===========================================
// Clenzy — Load Test (test de charge standard)
// ===========================================
// Simule une charge realiste sur les endpoints principaux.
// Duree : ~5 minutes, montee progressive jusqu'a 50 VUs.
// Usage : k6 run tests/performance/load-test.js
//
// Variables d'environnement :
//   BASE_URL         - URL du backend (defaut: http://localhost:8080)
//   CI_AUTH_TOKEN    - Token JWT pre-signe (CI, pas de Keycloak)
//   KEYCLOAK_URL     - URL Keycloak (defaut: http://localhost:8443)
//   TEST_USER        - Email utilisateur de test
//   TEST_PASSWORD    - Mot de passe utilisateur de test

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import {
  BASE_URL,
  API_BASE,
  CI_AUTH_TOKEN,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  TEST_USER,
  TEST_PASSWORD,
} from './config.js';

// ─── Metriques custom ──────────────────────────────────────────────────────

const errorRate = new Rate('business_errors');
const authDuration = new Trend('auth_duration', true);
const apiDuration = new Trend('api_duration', true);

// ─── Options K6 ─────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Montee : 0 → 10 VUs
    { duration: '1m', target: 25 },    // Montee : 10 → 25 VUs
    { duration: '2m', target: 50 },    // Plateau : 50 VUs pendant 2 min
    { duration: '1m', target: 25 },    // Descente : 50 → 25 VUs
    { duration: '30s', target: 0 },    // Cooldown : 25 → 0 VUs
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1500'],
    http_req_failed: ['rate<0.01'],
    business_errors: ['rate<0.05'],
    auth_duration: ['p(95)<2000'],
    api_duration: ['p(95)<500'],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAuthToken() {
  // En CI, utiliser le token pre-signe (pas de Keycloak)
  if (CI_AUTH_TOKEN) {
    return CI_AUTH_TOKEN;
  }

  // En environnement avec Keycloak, obtenir un token via password grant
  const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const res = http.post(tokenUrl, {
    grant_type: 'password',
    client_id: KEYCLOAK_CLIENT_ID,
    username: TEST_USER,
    password: TEST_PASSWORD,
  });

  authDuration.add(res.timings.duration);

  if (res.status !== 200) {
    errorRate.add(1);
    console.error(`Auth failed: ${res.status} — ${res.body}`);
    return null;
  }

  errorRate.add(0);

  try {
    return JSON.parse(res.body).access_token;
  } catch {
    return null;
  }
}

function authHeaders(token) {
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
}

// ─── Scenario principal ─────────────────────────────────────────────────────

export default function () {
  // 1. Authentification
  const token = getAuthToken();
  if (!token) {
    sleep(2);
    return;
  }

  const params = authHeaders(token);

  // 2. Health check (public, toujours accessible)
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/actuator/health`);
    check(res, {
      'health: status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);

  // 3. Liste des proprietes (endpoint critique — le plus frequente)
  group('Properties - List', () => {
    const res = http.get(`${API_BASE}/properties?size=20`, params);
    apiDuration.add(res.timings.duration);

    const ok = check(res, {
      'properties: status 200': (r) => r.status === 200,
      'properties: body is JSON': (r) => {
        try { JSON.parse(r.body); return true; } catch { return false; }
      },
    });

    errorRate.add(ok ? 0 : 1);
  });

  sleep(0.5);

  // 4. Liste des reservations
  group('Reservations - List', () => {
    const res = http.get(`${API_BASE}/reservations`, params);
    apiDuration.add(res.timings.duration);

    const ok = check(res, {
      'reservations: status 200 or 403': (r) => r.status === 200 || r.status === 403,
    });

    errorRate.add(ok ? 0 : 1);
  });

  sleep(0.5);

  // 5. Detail d'une propriete (lecture unitaire)
  group('Properties - Detail', () => {
    const res = http.get(`${API_BASE}/properties/1`, params);
    apiDuration.add(res.timings.duration);

    check(res, {
      'property detail: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(0.5);

  // 6. Calendrier de pricing (endpoint lourd — calcul)
  group('Calendar Pricing', () => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

    const res = http.get(
      `${API_BASE}/calendar-pricing/1?from=${from}&to=${to}`,
      params,
    );
    apiDuration.add(res.timings.duration);

    check(res, {
      'pricing: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
  });

  sleep(0.5);

  // 7. Liste des utilisateurs (endpoint admin)
  group('Users - List', () => {
    const res = http.get(`${API_BASE}/users`, params);
    apiDuration.add(res.timings.duration);

    check(res, {
      'users: status 200 or 403': (r) => r.status === 200 || r.status === 403,
    });
  });

  sleep(1);
}
