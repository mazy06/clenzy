// Baitly : lectures du planning à débit imposé, avec plusieurs comptes/organisations.
// Les jetons et logements de test proviennent d'un fichier externe non versionné.
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Trend } from 'k6/metrics';

if (!__ENV.BASE_URL || !__ENV.PERF_ACTORS_FILE) {
  throw new Error('BASE_URL et PERF_ACTORS_FILE sont obligatoires. Voir docs/BAITLY-PLANNING-PERFORMANCE.md.');
}
const baseUrl = __ENV.BASE_URL.replace(/\/$/, '');
const actors = new SharedArray('baitly-planning-actors', () => {
  const values = JSON.parse(open(__ENV.PERF_ACTORS_FILE));
  if (!Array.isArray(values) || !values.length || values.some((actor) =>
    typeof actor.token !== 'string' || !actor.token.trim()
    || !Array.isArray(actor.propertyIds) || !actor.propertyIds.length
    || actor.propertyIds.length > 500
    || actor.propertyIds.some((id) => !Number.isSafeInteger(id) || id < 1))) {
    throw new Error('Chaque compte de test doit avoir un token et 1 à 500 propertyIds autorisés.');
  }
  return values;
});

function positiveInteger(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} doit être un entier positif.`);
  return value;
}
const rate = positiveInteger('PLANNING_WINDOWS_PER_SECOND', 10);
const allocated = positiveInteger('PLANNING_VUS', 100);
const pageSize = positiveInteger('PLANNING_PAGE_SIZE', 10);
if (pageSize > 100) throw new Error('PLANNING_PAGE_SIZE ne doit pas dépasser 100.');
const from = __ENV.PLANNING_FROM || '2026-10-01';
const to = __ENV.PLANNING_TO || '2026-10-31';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!datePattern.test(from) || !datePattern.test(to) || from >= to) {
  throw new Error('PLANNING_FROM et PLANNING_TO doivent définir une plage ISO croissante.');
}

const errors = new Rate('planning_errors');
const throttled = new Rate('planning_throttled');
const duration = new Trend('planning_window_duration', true);
export const options = {
  summaryTrendStats: ['med', 'p(95)', 'p(99)', 'max'],
  scenarios: {
    planning: {
      executor: 'ramping-arrival-rate',
      startRate: 1,
      timeUnit: '1s',
      preAllocatedVUs: allocated,
      maxVUs: allocated,
      stages: [
        { duration: '30s', target: rate },
        { duration: __ENV.PLANNING_PLATEAU || '2m', target: rate },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    'http_req_duration{endpoint:planning_index}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{endpoint:planning_reservations}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{endpoint:planning_pricing}': ['p(95)<500', 'p(99)<1500'],
    'http_req_duration{endpoint:planning_min_nights}': ['p(95)<500', 'p(99)<1500'],
    planning_errors: ['rate<0.01'],
    planning_throttled: ['rate<0.01'],
    planning_window_duration: ['p(95)<1500'],
    dropped_iterations: ['count==0'],
  },
};

export default function () {
  const actor = actors[(__VU + __ITER - 1) % actors.length];
  const ids = actor.propertyIds;
  const page = ids.slice(0, pageSize);
  const headers = { Authorization: `Bearer ${actor.token}` };
  const query = (properties) => `propertyIds=${properties.join(',')}&from=${from}&to=${to}`;
  const request = (path, properties, endpoint) => ({
    method: 'GET',
    url: `${baseUrl}/api/${path}?${query(properties)}`,
    params: { headers, timeout: '10s', tags: { endpoint, name: endpoint } },
  });
  const started = Date.now();
  // Même périmètre que les hooks : données du portefeuille et tarifs de la page.
  const responses = http.batch([
    request('planning/index', ids, 'planning_index'),
    request('planning/reservations', page, 'planning_reservations'),
    request('calendar/pricing', page, 'planning_pricing'),
    request('min-nights-overrides/batch', page, 'planning_min_nights'),
  ]);
  duration.add(Date.now() - started);
  responses.forEach((response, index) => {
    throttled.add(response.status === 429);
    let body;
    try { body = response.json(); } catch { body = null; }
    const collections = index === 0 && body
      ? [body.reservations, body.interventions, body.awaitingPayment, body.blocked]
      : [body];
    const allowed = new Set(index === 0 ? ids : page);
    const valid = check(response, {
      'planning: HTTP 200': (r) => r.status === 200,
      'planning: collections valides et logements autorisés': () => collections.every((list) =>
        Array.isArray(list) && list.every((item) => allowed.has(item.propertyId))),
    });
    errors.add(!valid);
  });
}
