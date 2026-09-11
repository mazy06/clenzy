import { describe, it, expect } from 'vitest';
import {
  IMPORT_PREFIX,
  KPI_TILE_KEY,
  TILE_SOURCES,
  sourceTiles,
  findTileSource,
  importedWidgetId,
  isImportedWidgetId,
  parseImportedWidgetId,
} from '../importedWidgets';
import { fiscalModeFor } from '../../reports/FiscalReportSection';

/**
 * L'identifiant d'une tuile importée est PERSISTÉ dans les préférences : c'est
 * lui qui doit survivre aux déploiements. Ces cas verrouillent son aller-retour
 * et, surtout, son refus des formes qu'on ne sait pas rendre.
 */
describe("identifiant d'une tuile importée", () => {
  it('faitLAllerRetour', () => {
    const id = importedWidgetId('reports.overview', 'revenue-trend');

    expect(id).toBe(`${IMPORT_PREFIX}reports.overview:revenue-trend`);
    expect(parseImportedWidgetId(id)).toEqual({
      sourceId: 'reports.overview',
      tileKey: 'revenue-trend',
    });
  });

  it('accepteUneCleQuiContientDesDeuxPoints', () => {
    // La source est le PREMIER segment ; le reste appartient à la clé.
    expect(parseImportedWidgetId(`${IMPORT_PREFIX}reports.overview:a:b`)).toEqual({
      sourceId: 'reports.overview',
      tileKey: 'a:b',
    });
  });

  it('refuseUneSourceInconnue', () => {
    // Une source retirée du produit ne doit pas laisser une tuile fantôme.
    expect(parseImportedWidgetId(`${IMPORT_PREFIX}reports.disparu:x`)).toBeNull();
    expect(isImportedWidgetId(`${IMPORT_PREFIX}reports.disparu:x`)).toBe(false);
  });

  it('refuseLesFormesIncompletes', () => {
    expect(parseImportedWidgetId('kpis')).toBeNull();
    expect(parseImportedWidgetId(`${IMPORT_PREFIX}reports.overview`)).toBeNull();
    expect(parseImportedWidgetId(`${IMPORT_PREFIX}reports.overview:`)).toBeNull();
    expect(parseImportedWidgetId(`${IMPORT_PREFIX}:x`)).toBeNull();
  });

  it('neConfondPasUneTuileNativeAvecUneImportee', () => {
    expect(isImportedWidgetId('revenue-by-channel')).toBe(false);
  });
});

describe('registre des sources', () => {
  it('couvreLesHuitOngletsDeRapports_lesStatistiquesDePortefeuilles_etLesTuilesDeParc', () => {
    expect(TILE_SOURCES.map((source) => source.id)).toEqual([
      'reports.overview',
      'reports.revenue',
      'reports.occupancy',
      'reports.pricing',
      'reports.pace',
      'reports.properties',
      'reports.interventions',
      'reports.teams',
      'reports.fiscal',
      'portfolios.stats',
      'pulse.growth',
      'pulse.operations',
      'pulse.compliance',
      'pulse.finance',
      'pulse.guest',
    ]);
  });

  it('nDeclareAucunIdentifiantEnDouble', () => {
    const ids = TILE_SOURCES.map((source) => source.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('seRetrouveParSonIdentifiant', () => {
    expect(findTileSource('portfolios.stats')?.fallback).toBe('Statistiques');
    expect(findTileSource('inconnue')).toBeUndefined();
  });

  it('chaqueSourceDeclareUnLibelleEtUneOrigine', () => {
    // Le sélecteur ne montre que ça : un nom, et l'écran d'où il vient.
    for (const source of TILE_SOURCES) {
      expect(source.labelKey, source.id).toBeTruthy();
      expect(source.fallback, source.id).toBeTruthy();
      expect(source.originKey, source.id).toBeTruthy();
    }
  });

  // Le renvoi d'une tuile importée n'a de valeur que s'il tombe sur une route
  // REELLE : un chemin inventé mène à « page introuvable », ce qui est pire
  // que pas de lien du tout.
  it('chaqueSourceRenvoieVersUneRouteDeLApplication', () => {
    const routes = new Set([
      '/reports',
      '/billing',
      '/directory',
      '/planning',
      '/documents',
      '/accounting',
      '/contact',
    ]);
    for (const source of TILE_SOURCES) {
      expect(routes.has(source.originPath.split('?')[0]), source.originPath).toBe(true);
    }
  });
});

describe('granularité fiscale', () => {
  it('suitLaPeriodeDuTableauDeBord_etRabatLaSemaineSurLeMois', () => {
    // La TVA ne se déclare pas à la semaine : le mois en cours est la seule
    // réponse honnête pour une période hebdomadaire.
    expect(fiscalModeFor('week')).toBe('monthly');
    expect(fiscalModeFor('month')).toBe('monthly');
    expect(fiscalModeFor('quarter')).toBe('quarterly');
    expect(fiscalModeFor('year')).toBe('annual');
  });
});

/**
 * Les rapports calculent DEUX choses : un bandeau de chiffres — les seuls à
 * porter la variation face à la période précédente — et des graphiques. Seuls
 * les graphiques étaient importables : aucune tuile posée sur le tableau de
 * bord ne pouvait donc montrer une évolution.
 */
describe('tuiles offertes par une source', () => {
  const chart = { key: 'revenue-trend', title: 'Recettes', render: () => null };

  it('ouvreSurLesIndicateurs_quandLaSourceEnPublie', () => {
    const offered = sourceTiles(
      {
        figures: [{ key: 'revenue', value: '12 000 €', label: 'Recettes', delta: 8 }],
        items: [chart],
        loading: false,
      },
      'Indicateurs clés',
    );

    expect(offered.map((tile) => tile.key)).toEqual([KPI_TILE_KEY, 'revenue-trend']);
    expect(offered[0].title).toBe('Indicateurs clés');
  });

  it('nInventePasDeBandeauVide', () => {
    const offered = sourceTiles({ figures: [], items: [chart], loading: false }, 'Indicateurs clés');

    expect(offered.map((tile) => tile.key)).toEqual(['revenue-trend']);
  });
});
