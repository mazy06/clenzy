#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { normalizeCity } from './sectorCities.mjs';

// Même source officielle que les arrondissements. Le réseau est utilisé au build seulement.
const source = 'https://geo.api.gouv.fr/communes?fields=code,nom,codeDepartement&format=geojson&geometry=contour&type=commune-actuelle';
const work = mkdtempSync(join(tmpdir(), 'baitly-communes-'));
try {
  let input = process.argv[2]; // GeoJSON déjà simplifié, pour une régénération hors ligne.
  if (!input) {
    const response = await fetch(source);
    if (!response.ok) throw new Error(`Communes : HTTP ${response.status}`);
    writeFileSync(join(work, 'raw.geojson'), await response.text());
    input = join(work, 'simplified.geojson');
    execFileSync('npx', ['--yes', 'mapshaper@0.6.102', join(work, 'raw.geojson'),
      '-simplify', 'visvalingam', 'percentage=3%', 'keep-shapes', '-o', 'format=geojson', 'precision=0.00001', input], { stdio: 'inherit' });
  }
  const groups = new Map();
  for (const feature of JSON.parse(readFileSync(input, 'utf8')).features) {
    const { code, nom, codeDepartement: department } = feature.properties;
    if (!department || !feature.geometry) throw new Error(`Commune sans département/contour : ${code}`);
    const group = groups.get(department) ?? [];
    group.push({ ...feature, properties: { key: `FR-C-${department}-${normalizeCity(nom)}`, kind: 'city', name: nom, code } });
    groups.set(department, group);
  }
  const server = 'server/src/main/resources/geo/baitly-communes';
  const client = 'client/public/geo/baitly-communes';
  mkdirSync(server, { recursive: true }); mkdirSync(client, { recursive: true });
  const names = {};
  for (const [department, features] of [...groups].sort()) {
    features.sort((a, b) => a.properties.name.localeCompare(b.properties.name, 'fr'));
    names[department] = features.map(f => f.properties.name);
    writeFileSync(`${client}/${department}.json`, JSON.stringify(names[department]));
    writeFileSync(`${server}/${department}.geojson`, JSON.stringify({ type: 'FeatureCollection', features }));
  }
  writeFileSync('server/src/main/resources/geo/baitly-communes.json', JSON.stringify(names));
  console.log(`${Object.values(names).flat().length} communes, ${groups.size} départements. Source : ${source}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
