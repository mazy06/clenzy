// ===========================================
// Clenzy — Smoke Test (validation rapide)
// ===========================================
// Verifie que l'application repond correctement.
// Duree : ~30 secondes, 1 VU.
// Usage : k6 run tests/performance/smoke-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { API_BASE } from './config.js';

export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // Health check — endpoint public
  const healthRes = http.get(`${API_BASE}/../actuator/health`);
  check(healthRes, {
    'health status 200': (r) => r.status === 200,
    'health body contains UP': (r) => r.body && r.body.includes('UP'),
  });

  sleep(1);

  // API publique — captcha ou version
  const apiRes = http.get(`${API_BASE}/../actuator/info`);
  check(apiRes, {
    'info status 200 or 404': (r) => r.status === 200 || r.status === 404,
  });

  sleep(1);
}
