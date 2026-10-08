#!/usr/bin/env node
/**
 * Génère `src/icons/glyphs.ts` (corps SVG Reicon indexés par nom Ionicons) à
 * partir de `glyph-map.json`.
 *
 *   node scripts/reicon/generate-glyphs.mjs
 *
 * Les données viennent de `@iconify-icons/reicon`, installé côté web
 * (`client/`, lancer `npm ci` dedans d'abord). Les corps sont INLINÉS dans le
 * fichier généré : l'app n'embarque aucune dépendance d'icônes au runtime.
 *
 * Pour chaque clé `xxx` : `xxx-outline` → duotone (repli contour) et `xxx` →
 * variante pleine (repli duotone / contour), sauf graisse forcée dans `weights`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..', '..');
const reiconRoot = join(mobileRoot, '..', 'client', 'node_modules', '@iconify-icons', 'reicon');

const { glyphs, weights, custom } = JSON.parse(readFileSync(join(here, 'glyph-map.json'), 'utf8'));
const exportsMap = JSON.parse(readFileSync(join(reiconRoot, 'package.json'), 'utf8')).exports;

async function load(glyph) {
  const entry = exportsMap[`./${glyph}`];
  if (!entry) return undefined;
  const mod = await import(pathToFileURL(join(reiconRoot, entry.default)).href);
  return mod.default;
}

const ORDER = {
  duotone: ['duotone', 'outline', 'filled'],
  outline: ['outline', 'duotone', 'filled'],
  filled: ['filled', 'duotone', 'outline'],
};

async function resolve(reicon, weight) {
  for (const w of ORDER[weight]) {
    const data = await load(w === 'outline' ? reicon : `${reicon}-${w}`);
    if (data) {
      if ((data.width ?? 24) !== 24 || (data.height ?? 24) !== 24 || data.left || data.top) {
        throw new Error(`${reicon} : viewBox inattendue`);
      }
      return data.body;
    }
  }
  throw new Error(`Glyphe Reicon introuvable : ${reicon}`);
}

const entries = [];
for (const [ion, reicon] of Object.entries(glyphs)) {
  entries.push([`${ion}-outline`, await resolve(reicon, weights[`${ion}-outline`] ?? 'duotone')]);
  entries.push([ion, await resolve(reicon, weights[ion] ?? 'filled')]);
}
for (const [name, body] of Object.entries(custom)) entries.push([name, body]);
entries.sort(([a], [b]) => a.localeCompare(b));

const lines = entries.map(([name, body]) => `  '${name}': ${JSON.stringify(body)},`).join('\n');
writeFileSync(
  join(mobileRoot, 'src', 'icons', 'glyphs.ts'),
  `// Généré par scripts/reicon/generate-glyphs.mjs — ne pas éditer à la main.\n` +
    `// Corps SVG (viewBox 0 0 24 24) des glyphes Reicon, indexés par nom Ionicons historique.\n` +
    `export const GLYPHS = {\n${lines}\n} as const;\n\nexport type IconName = keyof typeof GLYPHS;\n`,
);
console.log(`${entries.length} noms d'icônes générés.`);
