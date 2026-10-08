#!/usr/bin/env node
/**
 * Génère `src/modules/booking-engine/sdk/components/reiconGlyphs.ts` : la
 * géométrie des glyphes Reicon utilisés par le widget de réservation public.
 *
 *   node scripts/reicon/generate-sdk-icons.mjs
 *
 * Le SDK est embarqué sur des sites tiers (Shadow DOM, CSP possiblement stricte /
 * Trusted Types) : il construit ses SVG nœud par nœud via `createElementNS`,
 * jamais par `innerHTML`. Ce script pré-parse donc les corps SVG en arbres
 * `[tag, attrs, children]` sérialisés en TS statique.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..', '..');
const reiconRoot = join(clientRoot, 'node_modules', '@iconify-icons', 'reicon');
const exportsMap = JSON.parse(readFileSync(join(reiconRoot, 'package.json'), 'utf8')).exports;

/** Glyphes Reicon (nom complet, suffixe de graisse inclus) embarqués par le SDK. */
const GLYPHS = [
  'arrow-left-duotone', 'bath-duotone', 'bed-duotone', 'calendar-duotone', 'chair-duotone', 'check',
  'chef-hat-duotone', 'chevron-down', 'chevron-left', 'chevron-right', 'flame-duotone', 'fridge-duotone',
  'heart', 'heart-filled', 'lock-duotone', 'map-point-duotone', 'minus', 'parking', 'plus', 'star',
  'star-filled', 'stars-duotone', 'tree', 'tuning2-duotone', 'tv-duotone', 'users-duotone',
  'washer-duotone', 'water-duotone', 'wifi', 'wind-duotone',
];

/** Mini-parseur XML : les corps Reicon sont des fragments SVG bien formés, sans texte. */
function parse(body) {
  const root = { children: [] };
  const stack = [root];
  for (const [, closing, tag, rawAttrs, selfClosing] of body.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    if (closing) {
      stack.pop();
      continue;
    }
    const attrs = Object.fromEntries([...rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]));
    const node = { tag, attrs, children: [] };
    stack.at(-1).children.push(node);
    if (!selfClosing) stack.push(node);
  }
  return root.children;
}

const serialize = (nodes) =>
  `[${nodes
    .map((n) => `[${JSON.stringify(n.tag)}, ${JSON.stringify(n.attrs)}${n.children.length ? `, ${serialize(n.children)}` : ''}]`)
    .join(', ')}]`;

const lines = [];
for (const glyph of GLYPHS) {
  const entry = exportsMap[`./${glyph}`];
  if (!entry) throw new Error(`Glyphe Reicon introuvable : ${glyph}`);
  const { default: data } = await import(pathToFileURL(join(reiconRoot, entry.default)).href);
  lines.push(`  '${glyph}': ${serialize(parse(data.body))},`);
}

writeFileSync(
  join(clientRoot, 'src', 'modules', 'booking-engine', 'sdk', 'components', 'reiconGlyphs.ts'),
  `// Généré par scripts/reicon/generate-sdk-icons.mjs — ne pas éditer à la main.\n` +
    `// Géométrie des glyphes Reicon (https://reicon.dev, MIT), viewBox 0 0 24 24.\n\n` +
    `export type GlyphNode = [tag: string, attrs: Record<string, string>, children?: GlyphNode[]];\n\n` +
    `export const REICON_GLYPHS = {\n${lines.join('\n')}\n} satisfies Record<string, GlyphNode[]>;\n\n` +
    `export type ReiconGlyphName = keyof typeof REICON_GLYPHS;\n`,
);
console.log(`${GLYPHS.length} glyphes SDK générés.`);
