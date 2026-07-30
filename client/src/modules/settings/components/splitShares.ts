/**
 * Redistribution des parts d'une repartition a somme constante.
 *
 * <p>Extrait du composant pour rester testable : c'est la seule partie ou une
 * erreur est invisible a l'oeil (un total a 99,9 % apres une serie de drags)
 * mais casse l'enregistrement.</p>
 *
 * <p>Tout le calcul se fait en <b>dixiemes de point</b> (entiers 0..1000) :
 * enchainer des additions de flottants sur des pourcentages fait deriver le
 * total, et c'est precisement ce total que le formulaire valide.</p>
 */

export interface SplitShare {
  key: string;
  /** Valeur en pourcentage (une decimale significative). */
  value: number;
  /** Une part verrouillee n'absorbe jamais d'ajustement et ne peut pas etre draguee. */
  locked?: boolean;
}

/** Granularite d'un pas : 0,1 point. */
const SCALE = 10;
const TOTAL = 100 * SCALE;

const toUnits = (pct: number) => Math.round(pct * SCALE);
const toPct = (units: number) => units / SCALE;

/**
 * Valeur maximale atteignable par `key` : tout sauf ce que retiennent les
 * parts verrouillees. Les parts libres peuvent, elles, descendre a zero.
 */
export function maxShareFor(shares: SplitShare[], key: string): number {
  const lockedElsewhere = shares
    .filter((s) => s.key !== key && s.locked)
    .reduce((sum, s) => sum + toUnits(s.value), 0);
  return toPct(Math.max(0, TOTAL - lockedElsewhere));
}

/** true si aucune autre part ne peut absorber un ajustement de `key`. */
export function isShareAdjustable(shares: SplitShare[], key: string): boolean {
  const target = shares.find((s) => s.key === key);
  if (!target || target.locked) return false;
  return shares.some((s) => s.key !== key && !s.locked);
}

/**
 * Porte `key` a `nextValue` et reporte l'ecart sur les parts non verrouillees,
 * au prorata de leur poids — une part deux fois plus grosse encaisse deux fois
 * plus de l'ajustement, ce qui preserve les rapports existants.
 *
 * <p>Le reste de division entiere est pose sur la derniere part servie, pour
 * que la somme retombe exactement sur 100 %.</p>
 *
 * @returns un nouveau tableau ; l'entree n'est jamais mutee. Si rien ne peut
 *          absorber l'ecart, l'entree est renvoyee telle quelle.
 */
export function redistributeShares(
  shares: SplitShare[],
  key: string,
  nextValue: number,
): SplitShare[] {
  const absorbers = shares.filter((s) => s.key !== key && !s.locked);
  if (absorbers.length === 0 || !shares.some((s) => s.key === key)) {
    return shares;
  }

  const lockedUnits = shares
    .filter((s) => s.key !== key && s.locked)
    .reduce((sum, s) => sum + toUnits(s.value), 0);

  const targetUnits = Math.min(Math.max(toUnits(nextValue), 0), TOTAL - lockedUnits);
  const poolUnits = TOTAL - lockedUnits - targetUnits;

  const absorbersUnits = absorbers.map((s) => toUnits(s.value));
  const absorbersTotal = absorbersUnits.reduce((a, b) => a + b, 0);

  // Toutes les parts absorbantes sont a zero : plus de prorata possible, on
  // repartit a parts egales plutot que de diviser par zero.
  const weights = absorbersTotal > 0
    ? absorbersUnits.map((u) => u / absorbersTotal)
    : absorbersUnits.map(() => 1 / absorbers.length);

  let assigned = 0;
  const nextByKey = new Map<string, number>();
  absorbers.forEach((s, i) => {
    const isLast = i === absorbers.length - 1;
    const units = isLast ? poolUnits - assigned : Math.round(poolUnits * weights[i]);
    assigned += units;
    nextByKey.set(s.key, Math.max(0, units));
  });

  return shares.map((s) => {
    if (s.key === key) return { ...s, value: toPct(targetUnits) };
    const units = nextByKey.get(s.key);
    return units === undefined ? s : { ...s, value: toPct(units) };
  });
}

/** Somme des parts, arrondie a la meme granularite que la redistribution. */
export function sumShares(shares: SplitShare[]): number {
  return toPct(shares.reduce((sum, s) => sum + toUnits(s.value), 0));
}
