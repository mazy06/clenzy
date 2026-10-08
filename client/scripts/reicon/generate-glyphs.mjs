#!/usr/bin/env node
/**
 * Génère `src/icons/glyphs/` à partir de `glyph-map.json`.
 *
 *   node scripts/reicon/generate-glyphs.mjs
 *
 * Un module par glyphe (tree-shaking + découpage par route préservés), plus un
 * barrel `index.ts` qui expose aussi les alias historiques (noms Lucide).
 * Variante par défaut : `-duotone` quand Reicon la fournit, sinon le contour.
 * Les glyphes listés dans `custom` sont écrits à la main et ne sont pas touchés.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const clientRoot = join(here, '..', '..');
const outDir = join(clientRoot, 'src', 'icons', 'glyphs');
const require = createRequire(join(clientRoot, 'package.json'));

const { glyphs, aliases, withFilled, custom } = JSON.parse(readFileSync(join(here, 'glyph-map.json'), 'utf8'));
const available = new Set(
  Object.keys(require('@iconify-icons/reicon/package.json').exports).map((k) => k.replace(/^\.\//, '')),
);

const HEADER = '// Généré par scripts/reicon/generate-glyphs.mjs — ne pas éditer à la main.\n';
const camel = (s) => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());

const missing = Object.entries(glyphs).filter(([, reicon]) => !available.has(reicon));
if (missing.length) {
  console.error('Glyphes Reicon introuvables :', missing.map(([n, r]) => `${n} → ${r}`).join(', '));
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const keep = new Set(custom.map((n) => `${n}.tsx`).concat(custom.map((n) => `${n}.ts`)));
for (const file of readdirSync(outDir)) if (!keep.has(file)) rmSync(join(outDir, file));

let duotoneCount = 0;
for (const [name, reicon] of Object.entries(glyphs)) {
  const variants = {};
  if (available.has(`${reicon}-duotone`)) {
    variants.duotone = `${reicon}-duotone`;
    duotoneCount += 1;
  } else {
    variants.outline = reicon;
  }
  if (withFilled.includes(name)) {
    variants.outline = reicon;
    if (available.has(`${reicon}-filled`)) variants.filled = `${reicon}-filled`;
  }
  const imports = Object.entries(variants)
    .map(([, glyph]) => `import ${camel(glyph)} from '@iconify-icons/reicon/${glyph}';`)
    .join('\n');
  const object = Object.entries(variants)
    .map(([weight, glyph]) => `${weight}: ${camel(glyph)}`)
    .join(', ');
  writeFileSync(
    join(outDir, `${name}.ts`),
    `${HEADER}import { createIcon } from '../createIcon';\n${imports}\n\n` +
      `export const ${name} = /* @__PURE__ */ createIcon('${name}', { ${object} });\n`,
  );
}

const exportsByModule = new Map();
for (const name of [...Object.keys(glyphs), ...custom]) exportsByModule.set(name, [name]);
for (const [alias, target] of Object.entries(aliases)) {
  if (!exportsByModule.has(target)) throw new Error(`Alias ${alias} → ${target} : cible inconnue`);
  exportsByModule.get(target).push(`${target} as ${alias}`);
}
const barrel = [...exportsByModule.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([module, specs]) => `export { ${specs.join(', ')} } from './${module}';`)
  .join('\n');
writeFileSync(
  join(outDir, 'index.ts'),
  `${HEADER}export { createIcon, DEFAULT_ICON_WEIGHT } from '../createIcon';\n` +
    `export type { IconComponent, IconProps, IconWeight, IconData, IconVariants } from '../createIcon';\n\n${barrel}\n`,
);

console.log(`${Object.keys(glyphs).length} glyphes (${duotoneCount} en duotone), ${Object.keys(aliases).length} alias.`);
