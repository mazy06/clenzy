#!/usr/bin/env node
// Carte Baitly · contours des secteurs d'intervention des prestataires.
//
// Un secteur est déclaré par un code (département « 75 », arrondissement INSEE « 75111 »)
// ou, hors France, par une ville de la liste fermée de coverageCountries.ts. Ce script
// produit UNE fois le fichier des contours, versionné avec le code et lu par le serveur :
//   - départements (101, outre-mer inclus) : IGN Admin Express via france-geojson, Licence Ouverte ;
//   - arrondissements de Paris, Lyon, Marseille (45) : geo.api.gouv.fr (IGN), Licence Ouverte ;
//   - villes du Maroc et d'Arabie saoudite : OpenStreetMap via Nominatim (ODbL), 1 requête/s.
//     Contour de la ville, sinon de son gouvernorat ; une ville réduite à un point dans OSM
//     devient un cercle marqué `approx` (rayon CITY_FALLBACK_RADIUS_KM).
//
// Utilisation (depuis la racine) : node scripts/maps/sectors/build-baitly-sectors.mjs
// Sortie : server/src/main/resources/geo/baitly-sectors.geojson
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { CITY_QUERIES, normalizeCity, sectorKey } from './sectorCities.mjs';

const OUTPUT = resolve('server/src/main/resources/geo/baitly-sectors.geojson');
const DEPARTMENTS_URL = 'https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements-avec-outre-mer.geojson';
const ARRONDISSEMENTS_URL = 'https://geo.api.gouv.fr/communes?type=arrondissement-municipal&fields=code,nom&format=geojson&geometry=contour';
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'Baitly-sectors-build/1.0 (https://baitly.fr)';
const CITY_FALLBACK_RADIUS_KM = 12;
// Un polygone plus vaste n'est pas une ville mais une région : on le refuse.
const MAX_CITY_AREA_KM2 = 6000;
const MAPSHAPER = 'mapshaper@0.6.102';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function fetchJson(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  return response.json();
}

/** Aire approchée (km²) d'un Polygon/MultiPolygon en coordonnées géographiques. */
function areaKm2(geometry) {
  const ring = (coords) => {
    let sum = 0;
    const lat0 = coords.reduce((s, c) => s + c[1], 0) / coords.length;
    const kx = 111.32 * Math.cos((lat0 * Math.PI) / 180);
    for (let i = 0, j = coords.length - 1; i < coords.length; j = i++) {
      sum += (coords[j][0] * kx) * (coords[i][1] * 110.57) - (coords[i][0] * kx) * (coords[j][1] * 110.57);
    }
    return Math.abs(sum / 2);
  };
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce((total, rings) => total + ring(rings[0]) - rings.slice(1).reduce((h, r) => h + ring(r), 0), 0);
}

function circle([lng, lat], radiusKm) {
  const points = [];
  for (let i = 0; i <= 48; i++) {
    const angle = (i / 48) * 2 * Math.PI;
    points.push([
      lng + (radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(angle),
      lat + (radiusKm / 110.57) * Math.sin(angle),
    ]);
  }
  return { type: 'Polygon', coordinates: [points] };
}

async function nominatim(query, countryCodes) {
  const url = new URL(NOMINATIM);
  url.search = new URLSearchParams({
    q: query, countrycodes: countryCodes, polygon_geojson: '1', polygon_threshold: '0.0005',
    format: 'jsonv2', limit: '6',
  }).toString();
  await sleep(1100); // politique d'usage Nominatim : 1 requête par seconde au plus
  return fetchJson(url);
}

/** Gouvernorat (relation OSM) ∩ disque autour du centre-ville, découpé par mapshaper. */
async function governorateGeometry({ country, queries, governorate }) {
  const [center] = await nominatim(queries[0], country.toLowerCase());
  if (!center) throw new Error(`Centre introuvable : ${queries[0]}`);
  const url = new URL('https://nominatim.openstreetmap.org/lookup');
  url.search = new URLSearchParams({ osm_ids: governorate.relation, polygon_geojson: '1', format: 'json' }).toString();
  await sleep(1100);
  const [area] = await fetchJson(url);
  if (!area?.geojson) throw new Error(`Gouvernorat introuvable : ${governorate.relation}`);
  const work = mkdtempSync(join(tmpdir(), 'baitly-governorate-'));
  try {
    const collection = (geometry) => JSON.stringify({ type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: {}, geometry }] });
    writeFileSync(join(work, 'area.geojson'), collection(area.geojson));
    writeFileSync(join(work, 'disc.geojson'), collection(circle([Number(center.lon), Number(center.lat)], governorate.radiusKm)));
    execFileSync('npx', ['--yes', MAPSHAPER, join(work, 'area.geojson'), '-clip', join(work, 'disc.geojson'),
      '-o', 'format=geojson', join(work, 'city.geojson')], { stdio: 'ignore' });
    // Sans attributs, mapshaper écrit une GeometryCollection plutôt qu'une FeatureCollection.
    const output = JSON.parse(readFileSync(join(work, 'city.geojson'), 'utf8'));
    const geometry = output.features ? output.features[0]?.geometry : output.geometries?.[0];
    if (!geometry) throw new Error(`Découpe vide : ${governorate.relation}`);
    return { geometry, source: `gouvernorat ${governorate.relation} ∩ ${governorate.radiusKm} km`, approx: false };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Premier polygone de taille « ville » parmi les requêtes candidates, sinon un cercle. */
async function cityGeometry(city) {
  if (city.governorate) return governorateGeometry(city);
  const { country, queries } = city;
  const countryCodes = country === 'MA' ? 'ma,eh' : country.toLowerCase();
  let point = null;
  for (const query of queries) {
    for (const result of await nominatim(query, countryCodes)) {
      const { geojson } = result;
      if (!point) point = [Number(result.lon), Number(result.lat)];
      if (geojson.type !== 'Polygon' && geojson.type !== 'MultiPolygon') continue;
      const area = areaKm2(geojson);
      if (area > 0.5 && area <= MAX_CITY_AREA_KM2) return { geometry: geojson, source: query, approx: false };
    }
  }
  if (!point) throw new Error(`Ville introuvable : ${queries.join(' / ')}`);
  return { geometry: circle(point, CITY_FALLBACK_RADIUS_KM), source: 'cercle', approx: true };
}

function feature(key, kind, name, geometry, extra = {}) {
  return { type: 'Feature', properties: { key, kind, name, ...extra }, geometry };
}

const features = [];

const departments = await fetchJson(DEPARTMENTS_URL);
for (const { properties, geometry } of departments.features) {
  features.push(feature(sectorKey({ country: 'FR', department: properties.code }), 'department', properties.nom, geometry));
}
const arrondissements = await fetchJson(ARRONDISSEMENTS_URL);
for (const { properties, geometry } of arrondissements.features) {
  features.push(feature(sectorKey({ country: 'FR', arrondissement: properties.code }), 'arrondissement', properties.nom, geometry));
}
for (const city of CITY_QUERIES) {
  const { geometry, source, approx } = await cityGeometry(city);
  // Autres graphies acceptées à la saisie (« Riyadh », « Fès »…) : requêtes qui nomment la ville elle-même.
  const aliases = [...new Set(city.queries
    .filter((query) => !/governorate|préfecture|province|محافظة|,/i.test(query))
    .map(normalizeCity)
    .filter((alias) => alias && alias !== normalizeCity(city.name)))];
  features.push(feature(sectorKey({ country: city.country, city: city.name }), 'city', city.name, geometry,
    { ...(aliases.length ? { aliases } : {}), ...(approx ? { approx } : {}) }));
  console.log(`${city.country} ${city.name.padEnd(16)} ${approx ? 'cercle approximatif' : `contour (${source})`}`);
}

// Simplification topologique commune (les frontières partagées restent jointives) et
// coordonnées à 5 décimales (~1 m) : fichier compact, lu une fois au démarrage du serveur.
const work = mkdtempSync(join(tmpdir(), 'baitly-sectors-'));
try {
  const raw = join(work, 'raw.geojson');
  const simplified = join(work, 'simplified.geojson');
  writeFileSync(raw, JSON.stringify({ type: 'FeatureCollection', features }));
  execFileSync('npx', ['--yes', MAPSHAPER, raw, '-simplify', 'visvalingam', 'percentage=12%', 'keep-shapes',
    '-o', 'format=geojson', 'precision=0.00001', simplified], { stdio: 'inherit' });
  const output = JSON.parse(readFileSync(simplified, 'utf8'));
  output.attribution = 'Contours : IGN Admin Express (Licence Ouverte 2.0), geo.api.gouv.fr ; © contributeurs OpenStreetMap (ODbL)';
  writeFileSync(OUTPUT, JSON.stringify(output));
  console.log(`→ ${OUTPUT} : ${output.features.length} secteurs`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
