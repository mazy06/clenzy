import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import fr from '../locales/fr.json';
import en from '../locales/en.json';
import ar from '../locales/ar.json';

/**
 * Garde-fou de traduction du Dashboard.
 *
 * L'écran a longtemps affiché du français aux utilisateurs anglophones et
 * arabophones : les libellés existaient uniquement comme valeur de repli dans le
 * code, et personne ne le voyait puisque `t()` rend le repli sans se plaindre.
 * Ce test rend l'oubli bruyant — un `t('dashboard.…')` ajouté sans sa
 * traduction fait échouer la suite, dans les trois langues.
 */

const SRC = join(__dirname, '..', '..');
const KEY_PATTERN = /t\(\s*['"](dashboard\.[A-Za-z0-9_.]+)['"]/g;

/** Toutes les clés `dashboard.*` littérales référencées dans le code source. */
function usedKeys(): Set<string> {
  const keys = new Set<string>();

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) {
        if (entry !== 'node_modules') walk(path);
        continue;
      }
      if (!/\.tsx?$/.test(entry)) continue;
      const source = readFileSync(path, 'utf8');
      for (const match of source.matchAll(KEY_PATTERN)) keys.add(match[1]);
    }
  };

  walk(SRC);
  return keys;
}

/** Une clé n'est résolue que si elle mène à une chaîne — un nœud ne suffit pas. */
function resolves(locale: unknown, dotted: string): boolean {
  let node: unknown = locale;
  for (const part of dotted.split('.')) {
    if (typeof node !== 'object' || node === null || !(part in node)) return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

describe('locales — clés du Dashboard', () => {
  const keys = [...usedKeys()].sort();

  it('trouve les clés du Dashboard dans le code (le scan fonctionne)', () => {
    // Sans cette garde, un scan cassé rendrait les trois tests suivants verts
    // en n'ayant rien vérifié du tout.
    expect(keys.length).toBeGreaterThan(150);
    expect(keys).toContain('dashboard.actionItems.title');
  });

  it.each([
    ['fr', fr],
    ['en', en],
    ['ar', ar],
  ])('%s traduit toutes les clés utilisées', (_lang, locale) => {
    expect(keys.filter((key) => !resolves(locale, key))).toEqual([]);
  });
});
