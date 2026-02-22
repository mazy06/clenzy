// ===========================================
// Clenzy — Soak Test (test d'endurance)
// ===========================================
// Maintient une charge moderee pendant une longue duree pour detecter
// les fuites memoire, la degradation progressive, les connexions DB non liberees.
// Duree : ~30 minutes, 30 VUs constants.
// Usage : k6 run tests/performance/soak-test.js

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
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

// ─── Options K6 ─────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: '1m', target: 30 },     // Montee
    { duration: '25m', target: 30 },    // Plateau stable pendant 25 min
    { duration: '2m', target: 0 },      // Cooldown
  ],
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<2000'],
    http_req_failed: ['rate<0.02'],
    business_errors: ['rate<0.05'],
    api_duration: ['p(95)<800'],
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
    sleep(3);
    return;
  }

  const params = authHeaders(token);

  // Cycle d'operations typiques d'un utilisateur
  group('Soak - Health', () => {
    const res = http.get(`${API_BASE}/../actuator/health`);
    check(res, { 'health: 200': (r) => r.status === 200 });
  });

  sleep(1);

  group('Soak - Properties', () => {
    const res = http.get(`${API_BASE}/properties?size=20`, params);
    apiDuration.add(res.timings.duration);
    const ok = check(res, { 'properties: 200': (r) => r.status === 200 });
    errorRate.add(ok ? 0 : 1);
  });

  sleep(1);

  group('Soak - Reservations', () => {
    const res = http.get(`${API_BASE}/reservations`, params);
    apiDuration.add(res.timings.duration);
    check(res, { 'reservations: status ok': (r) => r.status === 200 || r.status === 403 });
  });

  sleep(1);

  group('Soak - Property Detail', () => {
    const id = Math.floor(Math.random() * 10) + 1;
    const res = http.get(`${API_BASE}/properties/${id}`, params);
    apiDuration.add(res.timings.duration);
    check(res, { 'detail: no error': (r) => r.status < 500 });
  });

  sleep(2);
}
