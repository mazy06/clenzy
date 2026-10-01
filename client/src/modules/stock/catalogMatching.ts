interface NamedCatalogEntry {
  key: string;
  names: { fr: string; en: string; ar: string };
  aliases?: readonly string[];
}

export function normalizeCatalogSearch(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
    .replace(/(\d)\s*[×x*]\s*(?=\d)/gi, '$1 ')
    .replace(/(\d)(?=\p{L})/gu, '$1 ').replace(/(\p{L})(?=\d)/gu, '$1 ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

const articles = new Set(['a', 'au', 'aux', 'de', 'du', 'des', 'd', 'le', 'la', 'les', 'en', 'pour', 'the', 'of', 'for']);
const singularsEndingInS = new Set(['tapis', 'matelas', 'couscous', 'ananas', 'sans', 'velours', 'gris', 'inox']);

/** Même objet, même format : on garde tous les mots distinctifs et tous les nombres. */
export function normalizeCatalogName(value: string): string {
  const words = normalizeCatalogSearch(value).split(' ');
  return words.filter((word, index) => !articles.has(word) && (word !== 'l' || /^\d+$/.test(words[index - 1] ?? '')))
    .map(word => word.length > 3 && word.endsWith('s') && !singularsEndingInS.has(word) ? word.slice(0, -1) : word)
    .join(' ');
}

/** Index déterministe : une ambiguïté reste sans image, jamais le premier résultat arbitraire. */
export function createCatalogResolver<T extends NamedCatalogEntry>(entries: readonly T[]) {
  const byKey = new Map(entries.map(entry => [entry.key, entry]));
  const names = new Map<string, T | null>();
  const aliases = new Map<string, T | null>();
  const canonical = new Map<string, T | null>();
  const add = (index: Map<string, T | null>, value: string, entry: T) => {
    if (!value) return;
    if (!index.has(value)) index.set(value, entry);
    else if (index.get(value)?.key !== entry.key) index.set(value, null);
  };
  for (const entry of entries) {
    for (const name of Object.values(entry.names)) {
      add(names, normalizeCatalogSearch(name), entry);
      add(canonical, normalizeCatalogName(name), entry);
    }
    for (const alias of entry.aliases ?? []) {
      add(aliases, normalizeCatalogSearch(alias), entry);
      add(canonical, normalizeCatalogName(alias), entry);
    }
  }
  return (key?: string | null, name = ''): T | undefined => {
    const explicit = key ? byKey.get(key) : undefined;
    if (explicit) return explicit;
    const normalized = normalizeCatalogSearch(name);
    if (names.has(normalized)) return names.get(normalized) ?? undefined;
    if (aliases.has(normalized)) return aliases.get(normalized) ?? undefined;
    return canonical.get(normalizeCatalogName(name)) ?? undefined;
  };
}

const number = '\\d+(?:[.,]\\d+)?';
const unit = '(?:millilitres?|milliliters?|centilitres?|centiliters?|litres?|liters?|ml|cl|dl|l|kilogrammes?|kilograms?|grammes?|grams?|kg|mg|g|millimetres?|centimetres?|metres?|mm|cm|m|pouces?|inches?|oz|lbs?|مل|لتر|غ|كغ|سم|مم)';
const lengthUnit = '(?:millimetres?|centimetres?|metres?|mm|cm|m|pouces?|inches?|سم|مم)';
const dimension = `${number}\\s*(?:${lengthUnit}\\s*)?(?:(?:[x×*/]|par|by)\\s*${number}\\s*(?:${lengthUnit}\\s*)?){1,2}`;
// Une contenance clôt le format : « 6 × 50 cl x40 » doit d'abord perdre « x40 ».
const multipack = `${number}\\s*[x×*]\\s*${number}\\s*${unit}`;
const formatSuffix = new RegExp(`(?:${multipack}|${dimension}|${number}\\s*${unit}|(?<![\\p{L}\\p{N}])[x×]\\s*${number}|${number}\\s*(?:unites?|pieces?|pcs|units?)|(?:lots?|boites?|paquets?|boxes?)\\s+(?:de|of)\\s+${number})\\s*[\\])]?$`, 'iu');

/**
 * Repli d'affichage uniquement : un format absent du catalogue garde l'image du type
 * reconnu, sans transformer une taille saisie en référence d'une autre taille.
 * On retire un suffixe à la fois afin de préserver d'abord les formats exacts.
 * Aucun mot de produit, numéro de modèle ou nombre de places n'est supprimé.
 */
export function createCatalogVisualResolver<T extends NamedCatalogEntry>(entries: readonly T[]) {
  const resolve = createCatalogResolver(entries);
  return (key?: string | null, name = ''): T | undefined => {
    const exact = resolve(key, name);
    if (exact) return exact;
    let candidate = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    while (candidate) {
      const format = formatSuffix.exec(candidate);
      if (!format || format.index === 0) return undefined;
      candidate = candidate.slice(0, format.index).replace(/[\s,;:()[\]\-–]+$/g, '');
      const entry = resolve(null, candidate);
      if (entry) return entry;
    }
    return undefined;
  };
}
