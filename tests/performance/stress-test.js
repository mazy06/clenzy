// ===========================================
// Clenzy — Stress Test (test de charge intense)
// ===========================================
// Pousse l'application au-dela de la charge normale pour identifier
// les points de rupture et valider la resilience.
// Duree : ~8 minutes, montee jusqu'a 200 VUs.
// Usage : k6 run tests/performance/stress-test.js
//
// ATTENTION : Ce test genere une charge importante.
// Ne pas executer contre un environnement de production actif.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import {
  API_BASE,
  KEYCLOAK_URL,
  KEYCLOAK_REALM,
  KEYCLOAK_CLIENT_ID,
  TEST_USER,
  TEST_PASSWORD,
} from './config.js';

// ─── Metriques custom ──────────────────────────────────────────────────────

const errorRate = new Rate('business_errors');
const apiDuration = new Trend('api_duration', true);
const totalRequests = new Counter('total_api_requests');

// ─── Options K6 ─────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '30s', target: 20 },    // Warm-up
    { duration: '1m', target: 50 },     // Charge normale
    { duration: '1m', target: 100 },    // Au-dessus de la normale
    { duration: '2m', target: 200 },    // Stress : double de la charge
    { duration: '1m', target: 100 },    // Descente progressive
    { duration: '1m', target: 50 },     // Retour normal
    { duration: '30s', target: 0 },     // Cooldown
  ],
  thresholds: {
    // Seuils plus tolerants pour le stress test
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.10'],       // 10% d'erreurs acceptables en stress
    business_errors: ['rate<0.15'],
    api_duration: ['p(95)<2000'],
  },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getAuthToken() {
  const tokenUrl = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;

  const res = http.post(tokenUrl, {
    grant_type: 'password',
    client_id: KEYCLOAK_CLIENT_ID,
    username: TEST_USER,
    password: TEST_PASSWORD,
  });

  if (res.status !== 200) {
    errorRate.add(1);
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
  const token = getAuthToken();
  if (!token) {
    sleep(1);
    return;
  }

  const params = authHeaders(token);

  // Rafale de requetes paralleles — simule un utilisateur actif
  group('Burst - Properties + Reservations', () => {
    const responses = http.batch([
      ['GET', `${API_BASE}/properties?size=50`, null, params],
      ['GET', `${API_BASE}/reservations`, null, params],
      ['GET', `${API_BASE}/../actuator/health`, null, {}],
    ]);

    responses.forEach((res, i) => {
      totalRequests.add(1);
      apiDuration.add(res.timings.duration);
      const ok = res.status >= 200 && res.status < 500;
      errorRate.add(ok ? 0 : 1);
    });

    check(responses[0], {
      'batch properties: status < 500': (r) => r.status < 500,
    });
    check(responses[1], {
      'batch reservations: status < 500': (r) => r.status < 500,
    });
  });

  sleep(0.3);

  // Lecture unitaire intensive
  group('Rapid Detail Reads', () => {
    for (let id = 1; id <= 5; id++) {
      const res = http.get(`${API_BASE}/properties/${id}`, params);
      totalRequests.add(1);
      apiDuration.add(res.timings.duration);
      check(res, {
        'detail read: no 5xx': (r) => r.status < 500,
      });
    }
  });

  sleep(0.3);

  // Calcul de pricing — endpoint lourd
  group('Pricing Under Load', () => {
    const now = new Date();
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

    for (let propertyId = 1; propertyId <= 3; propertyId++) {
      const res = http.get(
        `${API_BASE}/calendar-pricing/${propertyId}?from=${from}&to=${to}`,
        params,
      );
      totalRequests.add(1);
      apiDuration.add(res.timings.duration);
      check(res, {
        'pricing: no 5xx': (r) => r.status < 500,
      });
    }
  });

  sleep(0.5);
}
