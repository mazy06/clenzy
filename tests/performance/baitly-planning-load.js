// Baitly : lectures du planning à débit imposé, avec plusieurs comptes/organisations.
// Les jetons et logements de test proviennent d'un fichier externe non versionné.
import http from 'k6/http';
import { check } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Trend, Counter } from 'k6/metrics';

if (!__ENV.BASE_URL || !__ENV.PERF_ACTORS_FILE) {
  throw new Error('BASE_URL et PERF_ACTORS_FILE sont obligatoires. Voir docs/BAITLY-PLANNING-PERFORMANCE.md.');
}
const baseUrl = __ENV.BASE_URL.replace(/\/$/, '');
const actors = new SharedArray('baitly-planning-actors', () => {
  const values = JSON.parse(open(__ENV.PERF_ACTORS_FILE));
  if (!Array.isArray(values) || !values.length || values.some((actor) =>
    (!(typeof actor.token === 'string' && actor.token.trim())
      && !(typeof actor.clientId === 'string' && actor.clientId.startsWith('baitly-perf-')
        && typeof actor.clientSecret === 'string' && actor.clientSecret))
    || !Array.isArray(actor.propertyIds) || !actor.propertyIds.length
    || actor.propertyIds.length > 10000
    || actor.propertyIds.some((id) => !Number.isSafeInteger(id) || id < 1))) {
    throw new Error('Chaque compte de test doit avoir une identité et 1 à 10 000 propertyIds autorisés.');
  }
  return values;
});

function positiveInteger(name, fallback) {
  const value = Number(__ENV[name] || fallback);
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${name} doit être un entier positif.`);
  return value;
}
const rate = positiveInteger('PLANNING_WINDOWS_PER_SECOND', 1);
const allocated = positiveInteger('PLANNING_VUS', 100);
const pageSize = positiveInteger('PLANNING_PAGE_SIZE', 10);
if (pageSize > 100) throw new Error('PLANNING_PAGE_SIZE ne doit pas dépasser 100.');
const from = __ENV.PLANNING_FROM || '2026-10-01';
const to = __ENV.PLANNING_TO || '2026-10-31';
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
if (!datePattern.test(from) || !datePattern.test(to) || from >= to
  || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))
  || new Date(from).toISOString().slice(0, 10) !== from || new Date(to).toISOString().slice(0, 10) !== to
  || (Date.parse(to) - Date.parse(from)) / 86400000 > 62) {
  throw new Error('PLANNING_FROM et PLANNING_TO doivent définir une plage ISO croissante.');
}
const cohort = __ENV.PLANNING_PROPERTY_COUNT ? positiveInteger('PLANNING_PROPERTY_COUNT', 10) : null;
const selectedActors = actors.filter((actor) => cohort === null || actor.propertyIds.length === cohort);
if (!selectedActors.length) throw new Error('Aucun compte pour cette taille de portefeuille.');
const includeCatalog = __ENV.PLANNING_INCLUDE_CATALOG === 'true';
const detailsPath = __ENV.PLANNING_DETAILS_MODE === 'full' ? 'planning/reservations' : 'planning/reservation-cards';

export function setup() {
  return selectedActors.map((actor) => {
    if (actor.token) return { token: actor.token, propertyIds: actor.propertyIds };
    if (baseUrl !== 'https://app.clenzy.fr') throw new Error('Les identités de fixture sont réservées au staging.');
    const response = http.post('https://auth.clenzy.fr/realms/clenzy/protocol/openid-connect/token', {
      grant_type: 'client_credentials', client_id: actor.clientId, client_secret: actor.clientSecret,
    }, { timeout: '10s', redirects: 0, headers: { 'User-Agent': 'Mozilla/5.0 Baitly-Staging-Perf' },
      tags: { endpoint: 'planning_test_auth', name: 'planning_test_auth' } });
    let payload;
    try { payload = response.json(); } catch { payload = null; }
    if (response.status !== 200 || !payload?.access_token || payload.expires_in < 240) {
      throw new Error('Authentification de fixture impossible ou durée insuffisante ; aucun secret journalisé.');
    }
    return { token: payload.access_token, propertyIds: actor.propertyIds };
  });
}

const errors = new Rate('planning_errors');
const throttled = new Rate('planning_throttled');
const duration = new Trend('planning_window_duration', true);
const responseBytes = new Counter('planning_response_bytes');
// Phases fixes uniquement : ne jamais publier les descriptions du header serveur.
const serverPhases = Object.fromEntries(['authz', 'details', 'rows', 'contacts', 'decrypt', 'mapping']
  .map((phase) => [phase, new Trend(`planning_server_${phase}_duration`, true)]));

function recordServerTiming(response) {
  const header = Object.entries(response.headers || {}).find(([name]) => name.toLowerCase() === 'server-timing')?.[1];
  if (typeof header !== 'string') return;
  for (const item of header.split(',')) {
    const match = /^\s*(authz|details|rows|contacts|decrypt|mapping)\s*;\s*dur=(\d+(?:\.\d+)?)\s*(?:;.*)?$/.exec(item);
    if (match && Number.isFinite(Number(match[2]))) serverPhases[match[1]].add(Number(match[2]));
  }
}
export const options = {
  systemTags: ['method', 'name', 'status', 'scenario', 'expected_response', 'check', 'error_code'],
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
    ...(includeCatalog ? { 'http_req_duration{endpoint:planning_catalog}': ['p(95)<500', 'p(99)<1500'] } : {}),
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

function utf8Length(value) {
  let bytes = 0;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 128) bytes++;
    else if (code < 2048) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < value.length
      && value.charCodeAt(i + 1) >= 0xDC00 && value.charCodeAt(i + 1) <= 0xDFFF) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

export default function (identities) {
  const actor = identities[(__VU + __ITER - 1) % identities.length];
  const ids = actor.propertyIds;
  const page = ids.slice(0, pageSize);
  const headers = { Authorization: `Bearer ${actor.token}`, 'User-Agent': 'Mozilla/5.0 Baitly-Staging-Perf' };
  const query = (properties) => `propertyIds=${properties.join(',')}&from=${from}&to=${to}`;
  const request = (path, properties, endpoint) => ({
    method: 'GET',
    url: `${baseUrl}/api/${path}?${query(properties)}`,
    params: { headers, timeout: '10s', redirects: 0, tags: { endpoint, name: endpoint } },
  });
  const started = Date.now();
  let validCatalog = true;
  if (includeCatalog) {
    const found = new Set();
    let totalPages = 1;
    for (let pageNumber = 0; pageNumber < totalPages && pageNumber < 50; pageNumber++) {
      const response = http.get(`${baseUrl}/api/planning/properties?page=${pageNumber}&size=200`, {
        headers, timeout: '10s', redirects: 0, tags: { endpoint: 'planning_catalog', name: 'planning_catalog' },
      });
      throttled.add(response.status === 429);
      responseBytes.add(utf8Length(response.body || ''), { endpoint: 'planning_catalog' });
      let body;
      try { body = response.json(); } catch { body = null; }
      if (response.status !== 200 || !Array.isArray(body?.content)
        || !Number.isSafeInteger(body.totalPages) || body.totalPages < 1 || body.totalPages > 50
        || body.number !== pageNumber) { validCatalog = false; break; }
      totalPages = body.totalPages;
      body.content.forEach((property) => found.add(property.id));
    }
    validCatalog = validCatalog && found.size === ids.length && ids.every((id) => found.has(id));
  }
  // Même périmètre que les hooks : données du portefeuille et tarifs de la page.
  const reads = [];
  for (let offset = 0; offset < ids.length; offset += 500) {
    reads.push({ properties: ids.slice(offset, offset + 500), endpoint: 'planning_index', path: 'planning/index' });
  }
  const responses = http.batch([
    ...reads.map((read) => request(read.path, read.properties, read.endpoint)),
    request(detailsPath, page, 'planning_reservations'),
    request('calendar/pricing', page, 'planning_pricing'),
    request('min-nights-overrides/batch', page, 'planning_min_nights'),
  ]);
  duration.add(Date.now() - started);
  responses.forEach((response, index) => {
    recordServerTiming(response);
    throttled.add(response.status === 429);
    let body;
    try { body = response.json(); } catch { body = null; }
    const isIndex = index < reads.length;
    const collections = isIndex && body
      ? [body.reservations, body.interventions, body.awaitingPayment, body.blocked]
      : [body];
    const allowed = new Set(isIndex ? reads[index].properties : page);
    const endpoint = isIndex ? 'planning_index'
      : ['planning_reservations', 'planning_pricing', 'planning_min_nights'][index - reads.length];
    responseBytes.add(utf8Length(response.body || ''), { endpoint });
    const valid = check(response, {
      'planning: HTTP 200': (r) => r.status === 200,
      'planning: collections valides et logements autorisés': () => collections.every((list) =>
        Array.isArray(list) && list.every((item) => allowed.has(item.propertyId))),
    });
    errors.add(!valid || !validCatalog);
  });
}
