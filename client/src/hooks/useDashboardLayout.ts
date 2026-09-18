import { useCallback, useMemo } from 'react';
import { useUserPreference } from './useUserPreference';

/**
 * Clé de préférence — `user_ui_preferences`, donc cross-devices.
 *
 * ⚠️ Volontairement distincte de `dashboard.layout.order` : les dispositions
 * enregistrées avant le recentrage sur la projection portaient des identifiants
 * périmés (`action-items` composite, pas de `revenue-by-channel`). Les fusionner
 * aurait produit une tuile par ligne et fait perdre les appariements voulus —
 * revenus + canal, à traiter + occupation. On repart donc de la disposition
 * livrée, et l'ancienne clé s'éteint d'elle-même.
 */
const LAYOUT_KEY = 'dashboard.layout.v2';

/** Au-delà, plus rien n'est lisible sur une ligne. */
export const MAX_WIDGETS_PER_ROW = 3;

/** Une ligne du tableau de bord : des tuiles côte à côte, et leurs largeurs. */
export interface DashboardRow {
  /** Identifiants, de gauche à droite. */
  ids: string[];
  /** Largeurs en pourcentage, même longueur que `ids`. Absent = réparties également. */
  sizes?: number[];
}

/**
 * Disposition du Dashboard, personnalisée par l'utilisateur.
 *
 * Ce qui est stocké : **des identifiants et des pourcentages**. Jamais l'arbre de
 * composants. C'est ce qui rend la préférence survivable à un déploiement.
 *
 * Trois règles de fusion, qui sont le cœur du sujet — les tuiles apparaissent et
 * disparaissent selon le rôle, les bascules de fonctionnalité et les versions :
 *
 *  1. un identifiant enregistré **qui n'existe plus** est ignoré, et une ligne
 *     devenue vide disparaît ;
 *  2. une tuile disponible **absente de la disposition** est ajoutée en fin, sur
 *     sa propre ligne. Sans cette règle, toute nouvelle tuile livrée serait
 *     invisible pour l'ensemble des comptes existants ;
 *  3. les largeurs incohérentes (mauvais nombre, somme fausse) sont
 *     **recalculées** plutôt que rejetées — une préférence abîmée ne doit pas
 *     casser l'écran.
 *
 * La disposition n'est volontairement **pas** segmentée par rôle : les règles
 * ci-dessus absorbent déjà la différence.
 */

/**
 * Répartition égale — en fractions EXACTES, pas en entiers.
 *
 * <p>L'arrondi précédent posait le reste sur la première tuile : à trois par
 * ligne, `[34, 33, 33]`. Un pour cent d'écart ne se voit pas sur un chiffre,
 * mais sur une ligne de trois graphiques la première colonne est visiblement
 * plus large. En tiers exacts les trois sont strictement identiques, et la
 * somme vaut toujours 100 — `sizesAreSane` reste satisfait.</p>
 */
function equalSizes(count: number): number[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, () => 100 / count);
}

/** Largeurs valides ? Bon cardinal, valeurs positives, somme proche de 100. */
function sizesAreSane(sizes: number[] | undefined, count: number): sizes is number[] {
  if (!sizes || sizes.length !== count) return false;
  if (sizes.some((s) => !Number.isFinite(s) || s <= 0)) return false;
  const total = sizes.reduce((sum, s) => sum + s, 0);
  return Math.abs(total - 100) < 1;
}

/**
 * Normalise une préférence enregistrée en lignes exploitables.
 *
 * Accepte les **deux formats** : la liste plate d'identifiants livrée en
 * première étape, et les lignes introduites ensuite. Aucune migration n'est
 * nécessaire côté données — une préférence v1 devient une pile de lignes à une
 * tuile, ce qui est exactement le rendu qu'avait l'utilisateur.
 */
/**
 * Préférence enregistrée : les lignes, et ce que l'utilisateur a RETIRÉ.
 *
 * <p>Les deux formats antérieurs (liste plate d'identifiants, tableau de
 * lignes) restent lus tels quels — une préférence ancienne devient simplement
 * une disposition sans retrait.</p>
 */
export interface DashboardLayoutPref {
  rows: DashboardRow[];
  /** Tuiles NATIVES écartées de l'écran. Sans elles, la règle 2 les remettrait. */
  hidden?: string[];
}

export type SavedLayout = DashboardRow[] | string[] | DashboardLayoutPref;

/** Normalise les trois formats de préférence en un seul. */
function readPref(saved: unknown): { rows: DashboardRow[] | null; hidden: string[] } {
  if (saved && !Array.isArray(saved) && typeof saved === 'object') {
    const pref = saved as DashboardLayoutPref;
    return {
      rows: Array.isArray(pref.rows) && pref.rows.length > 0 ? pref.rows : null,
      hidden: Array.isArray(pref.hidden) ? pref.hidden.filter((id) => typeof id === 'string') : [],
    };
  }
  if (Array.isArray(saved) && saved.length > 0 && typeof saved[0] === 'string') {
    return {
      rows: (saved as string[]).map((id): DashboardRow => ({ ids: [id] })),
      hidden: [],
    };
  }
  if (Array.isArray(saved) && saved.length > 0) {
    return { rows: saved as DashboardRow[], hidden: [] };
  }
  return { rows: null, hidden: [] };
}

export interface MergeOptions {
  /**
   * Un identifiant DÉSIGNE-t-il une tuile importée d'un autre écran ?
   *
   * <p>Ces tuiles ne figurent pas dans `available` : elles n'existent que
   * parce que l'utilisateur les a placées. Sans ce prédicat, la règle 1 les
   * jetterait au prochain rendu.</p>
   */
  isImported?: (id: string) => boolean;
}

export function mergeLayoutRows(
  saved: unknown,
  available: string[],
  defaultRows: string[][],
  options: MergeOptions = {},
): DashboardRow[] {
  const availableSet = new Set(available);
  const { rows: savedRowsRaw, hidden } = readPref(saved);
  const hiddenSet = new Set(hidden);
  const isImported = options.isImported ?? (() => false);
  const savedRows: DashboardRow[] = savedRowsRaw ?? defaultRows.map((ids) => ({ ids }));

  const seen = new Set<string>();
  const rows: DashboardRow[] = [];
  for (const row of savedRows) {
    if (!row || !Array.isArray(row.ids)) continue;
    const ids = row.ids
      .filter((id) => typeof id === 'string'
        && (availableSet.has(id) || isImported(id))
        && !seen.has(id))
      .slice(0, MAX_WIDGETS_PER_ROW);
    if (ids.length === 0) continue;
    ids.forEach((id) => seen.add(id));
    rows.push({
      ids,
      sizes: sizesAreSane(row.sizes, ids.length) ? row.sizes : equalSizes(ids.length),
    });
  }

  // Tuiles disponibles jamais placées : ajoutées en fin, dans l'ordre du
  // registre — sauf celles que l'utilisateur a retirées.
  for (const id of available) {
    if (!seen.has(id) && !hiddenSet.has(id)) rows.push({ ids: [id], sizes: [100] });
  }
  return rows;
}

/** Retire une tuile de sa ligne, supprime les lignes vidées, réharmonise. */
export function withoutWidget(rows: DashboardRow[], id: string): DashboardRow[] {
  return rows
    .map((row) => ({ ...row, ids: row.ids.filter((rowId) => rowId !== id) }))
    .filter((row) => row.ids.length > 0)
    .map((row) => ({ ids: row.ids, sizes: equalSizes(row.ids.length) }));
}

/**
 * Place `draggedId` juste avant `targetId`, dans la ligne de ce dernier.
 *
 * C'est l'opération d'**appariement** : c'est elle qui compose une ligne de
 * plusieurs tuiles. Si la ligne cible est pleine, rien ne change — mieux vaut
 * une action sans effet qu'une tuile qui disparaît ailleurs.
 */
/**
 * De quel COTE de la cible la tuile se pose.
 *
 * <p>« before » et « after » se disent dans l'ordre de LECTURE, pas en gauche
 * et droite : en arabe, `before` est à droite. C'est le rendu qui place la
 * barre d'insertion du bon côté, avec des propriétés logiques.</p>
 */
export type DropSide = 'before' | 'after';

export function placeNextTo(
  rows: DashboardRow[],
  draggedId: string,
  targetId: string,
  side: DropSide = 'before',
): DashboardRow[] {
  if (draggedId === targetId) return rows;
  const targetRow = rows.find((row) => row.ids.includes(targetId));
  if (!targetRow) return rows;
  const sameRow = targetRow.ids.includes(draggedId);
  if (!sameRow && targetRow.ids.length >= MAX_WIDGETS_PER_ROW) return rows;

  return withoutWidget(rows, draggedId).map((row) => {
    if (!row.ids.includes(targetId)) return row;
    const ids = [...row.ids];
    ids.splice(ids.indexOf(targetId) + (side === 'after' ? 1 : 0), 0, draggedId);
    return { ids, sizes: equalSizes(ids.length) };
  });
}

/** Sort une tuile sur sa propre ligne, insérée à `rowIndex`. */
export function placeOnOwnRow(
  rows: DashboardRow[],
  draggedId: string,
  rowIndex: number,
): DashboardRow[] {
  const pruned = withoutWidget(rows, draggedId);
  const clamped = Math.max(0, Math.min(rowIndex, pruned.length));
  const next = [...pruned];
  next.splice(clamped, 0, { ids: [draggedId], sizes: [100] });
  return next;
}

/**
 * Décale une tuile d'un cran dans sa propre ligne.
 *
 * Les largeurs suivent la tuile : échanger deux colonnes ne doit pas
 * redistribuer l'espace que l'utilisateur a réglé à la poignée.
 */
export function shiftIdWithinRow(
  rows: DashboardRow[],
  id: string,
  delta: -1 | 1,
): DashboardRow[] {
  const rowIndex = rows.findIndex((row) => row.ids.includes(id));
  if (rowIndex < 0) return rows;
  const ids = [...rows[rowIndex].ids];
  const from = ids.indexOf(id);
  const to = from + delta;
  if (to < 0 || to >= ids.length) return rows;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  const sizes = rows[rowIndex].sizes ? [...rows[rowIndex].sizes!] : undefined;
  if (sizes) [sizes[from], sizes[to]] = [sizes[to], sizes[from]];
  return rows.map((row, index) => (index === rowIndex ? { ids, sizes } : row));
}

export interface DashboardLayout {
  rows: DashboardRow[];
  /** Tuiles natives retirées de l'écran — le sélecteur les repropose. */
  hidden: string[];
  isLoaded: boolean;
  /** L'utilisateur a-t-il une disposition à lui ? Pilote l'affichage du « Réinitialiser ». */
  isCustomized: boolean;
  /**
   * Déplace une tuile à côté d'une autre, dans la ligne de celle-ci.
   * `side` dit de quel côté, dans l'ordre de lecture. Si la ligne cible est
   * pleine, rien ne se passe.
   */
  moveNextTo: (draggedId: string, targetId: string, side?: DropSide) => void;
  /** Sort une tuile sur sa propre ligne, insérée à la position donnée. */
  moveToOwnRow: (draggedId: string, rowIndex: number) => void;
  /**
   * Décale une tuile d'un cran dans sa propre ligne.
   *
   * Indispensable au clavier : `moveNextTo` sait insérer avant une cible, mais
   * pas placer en dernière position d'une ligne.
   */
  shiftWithinRow: (id: string, delta: -1 | 1) => void;
  /** Enregistre les largeurs d'une ligne après redimensionnement. */
  setRowSizes: (rowIndex: number, sizes: number[]) => void;
  /**
   * Retire une tuile de l'écran.
   *
   * <p>Une tuile NATIVE est mémorisée comme écartée : sans cela, la règle
   * d'ajout automatique la remettrait au rendu suivant. Une tuile IMPORTÉE
   * n'existe que par sa présence dans les lignes — la sortir suffit.</p>
   */
  removeWidget: (id: string) => void;
  /** Place une tuile en fin de disposition, sur sa propre ligne. */
  addWidget: (id: string) => void;
  reset: () => void;
}

export function useDashboardLayout(
  availableIds: string[],
  defaultRows: string[][],
  options: MergeOptions = {},
): DashboardLayout {
  const [saved, setSaved, { isLoaded, reset: resetPref }] = useUserPreference<SavedLayout>(
    LAYOUT_KEY,
    [],
  );

  const { isImported } = options;
  const mergeOptions = useMemo(() => ({ isImported }), [isImported]);

  const rows = useMemo(
    () => mergeLayoutRows(saved, availableIds, defaultRows, mergeOptions),
    [saved, availableIds, defaultRows, mergeOptions],
  );

  const hidden = useMemo(() => readPref(saved).hidden, [saved]);

  /** Écrit lignes ET retraits : la préférence est désormais un couple. */
  const write = useCallback(
    (nextRows: DashboardRow[], nextHidden: string[]) =>
      setSaved({ rows: nextRows, hidden: nextHidden }),
    [setSaved],
  );

  const moveNextTo = useCallback(
    (draggedId: string, targetId: string, side: DropSide = 'before') =>
      write(placeNextTo(rows, draggedId, targetId, side), hidden),
    [rows, write, hidden],
  );

  const moveToOwnRow = useCallback(
    (draggedId: string, rowIndex: number) => write(placeOnOwnRow(rows, draggedId, rowIndex), hidden),
    [rows, write, hidden],
  );

  const shiftWithinRow = useCallback(
    (id: string, delta: -1 | 1) => write(shiftIdWithinRow(rows, id, delta), hidden),
    [rows, write, hidden],
  );

  /**
   * Enregistre les largeurs d'une ligne.
   *
   * Appelé par `onLayoutChanged`, qui ne se déclenche **qu'au relâchement du
   * pointeur** — aucune temporisation à gérer ici.
   */
  const setRowSizes = useCallback(
    (rowIndex: number, sizes: number[]) => {
      if (sizes.some((size) => !Number.isFinite(size) || size <= 0)) return;
      const next = rows.map((row, index) =>
        index === rowIndex && sizes.length === row.ids.length ? { ...row, sizes } : row,
      );
      write(next, hidden);
    },
    [rows, write, hidden],
  );

  const removeWidget = useCallback(
    (id: string) => {
      const nextHidden = availableIds.includes(id) && !hidden.includes(id)
        ? [...hidden, id]
        : hidden;
      write(withoutWidget(rows, id), nextHidden);
    },
    [rows, write, hidden, availableIds],
  );

  const addWidget = useCallback(
    (id: string) => {
      if (rows.some((row) => row.ids.includes(id))) return;
      write([...rows, { ids: [id], sizes: [100] }], hidden.filter((hiddenId) => hiddenId !== id));
    },
    [rows, write, hidden],
  );

  const reset = useCallback(() => resetPref(), [resetPref]);

  return {
    rows,
    hidden,
    isLoaded,
    isCustomized: Array.isArray(saved)
      ? saved.length > 0
      : Boolean(saved && ((saved.rows?.length ?? 0) > 0 || (saved.hidden?.length ?? 0) > 0)),
    moveNextTo,
    moveToOwnRow,
    shiftWithinRow,
    setRowSizes,
    removeWidget,
    addWidget,
    reset,
  };
}
