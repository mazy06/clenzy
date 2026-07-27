import { describe, it, expect } from 'vitest';
import {
  mergeLayoutRows,
  placeNextTo,
  placeOnOwnRow,
  shiftIdWithinRow,
} from '../useDashboardLayout';

/**
 * Règles de survie de la disposition du Dashboard.
 *
 * C'est ici que ce genre de fonctionnalité pourrit : les tuiles apparaissent et
 * disparaissent selon le rôle, les bascules de fonctionnalité et les versions.
 * Une préférence enregistrée en juillet doit rester lisible en octobre.
 */
describe('mergeLayoutRows', () => {
  const DEFAULT_ROWS = [['kpis'], ['actions', 'occupation'], ['planning']];
  const AVAILABLE = ['kpis', 'actions', 'occupation', 'planning'];

  it('sansPreference_retourneDispositionParDefaut', () => {
    const rows = mergeLayoutRows([], AVAILABLE, DEFAULT_ROWS);
    expect(rows.map((r) => r.ids)).toEqual([['kpis'], ['actions', 'occupation'], ['planning']]);
  });

  it('sansPreference_repartitLesLargeursEgalement', () => {
    const rows = mergeLayoutRows([], AVAILABLE, DEFAULT_ROWS);
    expect(rows[1].sizes).toEqual([50, 50]);
    expect(rows[0].sizes).toEqual([100]);
  });

  it('preferenceV1EnListePlate_devientUneTuileParLigne', () => {
    // Format de la première étape : une simple liste d'identifiants. Elle doit
    // rester lisible sans migration de données.
    const rows = mergeLayoutRows(['planning', 'kpis'], AVAILABLE, DEFAULT_ROWS);
    expect(rows.map((r) => r.ids)).toEqual([['planning'], ['kpis'], ['actions'], ['occupation']]);
  });

  it('tuileSupprimeeDuProduit_estIgnoree', () => {
    const saved = [{ ids: ['legacy', 'kpis'] }, { ids: ['planning'] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows[0].ids).toEqual(['kpis']);
  });

  it('ligneDevenueVide_disparait', () => {
    const saved = [{ ids: ['legacy'] }, { ids: ['kpis'] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows[0].ids).toEqual(['kpis']);
    expect(rows.some((r) => r.ids.length === 0)).toBe(false);
  });

  it('nouvelleTuileLivree_estAjouteeSurSaPropreLigne', () => {
    // LE piège : sans cette règle, une tuile livrée en production serait
    // invisible pour tous les comptes ayant déjà personnalisé leur écran.
    const saved = [{ ids: ['kpis'] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows.map((r) => r.ids)).toEqual([['kpis'], ['actions'], ['occupation'], ['planning']]);
  });

  it('tuileDupliqueeEntreDeuxLignes_neParaitQuUneFois', () => {
    const saved = [{ ids: ['kpis', 'actions'] }, { ids: ['kpis'] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows.flatMap((r) => r.ids).filter((id) => id === 'kpis')).toHaveLength(1);
  });

  it('largeursIncoherentes_sontRecalculees', () => {
    // Somme fausse : la préférence est réparée, pas rejetée.
    const saved = [{ ids: ['actions', 'occupation'], sizes: [10, 10] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows[0].sizes).toEqual([50, 50]);
  });

  it('largeursDeMauvaisCardinal_sontRecalculees', () => {
    const saved = [{ ids: ['actions', 'occupation'], sizes: [100] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows[0].sizes).toHaveLength(2);
  });

  it('largeursValides_sontConservees', () => {
    const saved = [{ ids: ['actions', 'occupation'], sizes: [65, 35] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows[0].sizes).toEqual([65, 35]);
  });

  it('ligneTropChargee_estTronqueeATroisTuiles', () => {
    const available = ['a', 'b', 'c', 'd'];
    const saved = [{ ids: ['a', 'b', 'c', 'd'] }];
    const rows = mergeLayoutRows(saved, available, available.map((id) => [id]));
    expect(rows[0].ids).toEqual(['a', 'b', 'c']);
    // La tuile évincée n'est pas perdue : elle repart sur sa propre ligne.
    expect(rows[1].ids).toEqual(['d']);
  });

  it('preferenceCorrompue_neCassePasLEcran', () => {
    const saved = [null, { ids: 'pas-un-tableau' }, { ids: ['kpis'] }];
    const rows = mergeLayoutRows(saved, AVAILABLE, DEFAULT_ROWS);
    expect(rows[0].ids).toEqual(['kpis']);
    expect(rows.flatMap((r) => r.ids)).toEqual(
      expect.arrayContaining(['kpis', 'actions', 'occupation', 'planning']),
    );
  });
});

/**
 * Opérations de composition — l'algèbre de la disposition.
 *
 * Elles sont extraites du hook exprès : ce sont elles qui portent la logique,
 * et elles se testent sans monter le fournisseur de préférences.
 */
describe('placeNextTo — apparier deux tuiles', () => {
  it('deuxLignesDistinctes_lesReunit', () => {
    const rows = [{ ids: ['a'] }, { ids: ['b'] }];
    expect(placeNextTo(rows, 'b', 'a').map((r) => r.ids)).toEqual([['b', 'a']]);
  });

  it('ligneCiblePleine_neChangeRien', () => {
    // Refuser franchement vaut mieux que déplacer la tuile ailleurs en douce.
    const rows = [{ ids: ['a', 'b', 'c'] }, { ids: ['d'] }];
    expect(placeNextTo(rows, 'd', 'a')).toEqual(rows);
  });

  it('memeLigne_reordonneAuLieuDeRefuser', () => {
    const rows = [{ ids: ['a', 'b', 'c'] }];
    expect(placeNextTo(rows, 'c', 'a').map((r) => r.ids)).toEqual([['c', 'a', 'b']]);
  });

  it('ligneSourceVidee_disparait', () => {
    const rows = [{ ids: ['a'] }, { ids: ['b'] }, { ids: ['c'] }];
    expect(placeNextTo(rows, 'a', 'c').map((r) => r.ids)).toEqual([['b'], ['a', 'c']]);
  });

  it('surElleMeme_neChangeRien', () => {
    const rows = [{ ids: ['a', 'b'] }];
    expect(placeNextTo(rows, 'a', 'a')).toEqual(rows);
  });
});

describe('shiftIdWithinRow — réordonner dans une ligne', () => {
  it('versLaGauche_echangeAvecLeVoisin', () => {
    const rows = [{ ids: ['a', 'b', 'c'], sizes: [50, 30, 20] }];
    const next = shiftIdWithinRow(rows, 'b', -1);
    expect(next[0].ids).toEqual(['b', 'a', 'c']);
  });

  it('lesLargeursSuiventLaTuile', () => {
    // Échanger deux colonnes ne doit pas redistribuer l'espace réglé à la main.
    const rows = [{ ids: ['a', 'b'], sizes: [70, 30] }];
    const next = shiftIdWithinRow(rows, 'a', 1);
    expect(next[0].ids).toEqual(['b', 'a']);
    expect(next[0].sizes).toEqual([30, 70]);
  });

  it('auBordDeLaLigne_neChangeRien', () => {
    const rows = [{ ids: ['a', 'b'] }];
    expect(shiftIdWithinRow(rows, 'a', -1)).toEqual(rows);
    expect(shiftIdWithinRow(rows, 'b', 1)).toEqual(rows);
  });

  it('tuileInconnue_neChangeRien', () => {
    const rows = [{ ids: ['a'] }];
    expect(shiftIdWithinRow(rows, 'zzz', 1)).toEqual(rows);
  });
});

describe('placeOnOwnRow — extraire une tuile', () => {
  it('sortDUneLigneAppariee', () => {
    const rows = [{ ids: ['a', 'b'] }];
    expect(placeOnOwnRow(rows, 'b', 0).map((r) => r.ids)).toEqual([['b'], ['a']]);
  });

  it('indexHorsBornes_estRamene', () => {
    const rows = [{ ids: ['a'] }, { ids: ['b'] }];
    expect(placeOnOwnRow(rows, 'a', 99).map((r) => r.ids)).toEqual([['b'], ['a']]);
  });
});
