import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const source = fs.readFileSync(new URL('./baitly-planning-load.js', import.meta.url), 'utf8')
  .replace(/^import .+;$/gm, '')
  .replace('export function setup()', 'function setup()')
  .replace('export const options', 'const options')
  .replace('export default function (identities)', 'function execute(identities)')
  + '\nglobalThis.workload = { setup, execute, options };';

function workload(propertyCount, env = {}, responder = null) {
  const propertyIds = Array.from({ length: propertyCount }, (_, index) => index + 1);
  const requests = [], samples = [];
  class Metric {
    constructor(name) { this.name = name; }
    add(value, tags) { samples.push({ name: this.name, value, tags }); }
  }
  const response = (url) => {
    requests.push(url);
    const parsed = new URL(url);
    const ids = (parsed.searchParams.get('propertyIds') || '').split(',').filter(Boolean).map(Number);
    let body;
    if (parsed.pathname.endsWith('/properties')) {
      const page = Number(parsed.searchParams.get('page'));
      body = { number: page, totalPages: Math.ceil(propertyCount / 200), content: propertyIds.slice(page * 200, (page + 1) * 200).map((id) => ({ id })) };
    } else if (parsed.pathname.endsWith('/index')) {
      body = { reservations: ids.map((propertyId) => ({ propertyId })), interventions: [], awaitingPayment: [], blocked: [] };
    } else body = ids.map((propertyId) => ({ propertyId }));
    if (responder) body = responder(parsed, body);
    return { status: 200, body: JSON.stringify(body), json: () => body };
  };
  const context = vm.createContext({
    __ENV: { BASE_URL: 'https://app.clenzy.fr', PERF_ACTORS_FILE: '/private/actors.json', ...env },
    __VU: 1, __ITER: 0,
    open: () => JSON.stringify([{ token: 'test-token', propertyIds }]),
    SharedArray: class { constructor(_name, read) { return read(); } },
    Rate: Metric, Trend: Metric, Counter: Metric,
    check: (value, checks) => Object.values(checks).every((check) => check(value)),
    http: { batch: (reads) => reads.map((read) => response(read.url)), get: response },
  });
  vm.runInContext(source, context);
  return { ...context.workload, requests, samples };
}

test('1000 logements : index en lots de 500 et prix/détails de la première page uniquement', () => {
  const load = workload(1000);
  load.execute(load.setup());
  assert.equal(load.options.scenarios.planning.stages[0].target, 1);
  const index = load.requests.filter((url) => new URL(url).pathname.endsWith('/index'));
  assert.equal(index.length, 2);
  index.forEach((url) => assert.equal(new URL(url).searchParams.get('propertyIds').split(',').length, 500));
  assert.equal(load.requests.length, 5);
  assert(load.requests.some((url) => new URL(url).pathname.endsWith('/reservation-cards')));
  assert(load.samples.filter((sample) => sample.name === 'planning_errors').every((sample) => sample.value === false));
});

test('parcours reload : toutes les pages du catalogue sont parcourues', () => {
  const load = workload(1000, { PLANNING_INCLUDE_CATALOG: 'true' });
  load.execute(load.setup());
  assert.equal(load.requests.filter((url) => new URL(url).pathname.endsWith('/properties')).length, 5);
  assert(load.samples.filter((sample) => sample.name === 'planning_errors').every((sample) => sample.value === false));
});

test('un logement étranger dans un lot est une erreur métier même avec HTTP 200', () => {
  const load = workload(1000, {}, (url, body) => url.pathname.endsWith('/index')
    ? { ...body, reservations: [{ propertyId: 90000 }] } : body);
  load.execute(load.setup());
  assert.equal(load.samples.filter((sample) => sample.name === 'planning_errors' && sample.value).length, 2);
});

test('un catalogue incomplet invalide la fenêtre au lieu de masquer une troncature', () => {
  const load = workload(1000, { PLANNING_INCLUDE_CATALOG: 'true' }, (url, body) => url.pathname.endsWith('/properties')
    ? { ...body, content: [] } : body);
  load.execute(load.setup());
  assert(load.samples.filter((sample) => sample.name === 'planning_errors').every((sample) => sample.value));
});

test('les dates impossibles et les fenêtres dépassant 62 jours sont refusées', () => {
  assert.throws(() => workload(10, { PLANNING_FROM: '2026-02-30' }), /plage ISO/);
  assert.throws(() => workload(10, { PLANNING_TO: '2027-01-01' }), /plage ISO/);
});

test('le mode baseline conserve l’endpoint complet pour une comparaison avant/après', () => {
  const load = workload(10, { PLANNING_DETAILS_MODE: 'full' });
  load.execute(load.setup());
  assert(load.requests.some((url) => new URL(url).pathname.endsWith('/reservations')));
});

test('une cohorte sans comptes est refusée avant d’exécuter le test', () => {
  assert.throws(() => workload(10, { PLANNING_PROPERTY_COUNT: '1000' }), /Aucun compte/);
});
