import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { ChartThumbnailContext, ChartTile, FiguresRow } from '../../components/stats';
import { useTranslation } from '../../hooks/useTranslation';
import type { DashboardPeriod } from './DashboardDateFilter';
import type { ReportContent } from '../reports/reportShell';
import { resolveDestination } from '../notifications/notificationMeta';
import { useOverviewReport } from '../reports/OverviewReport';
import { useRevenueReport } from '../reports/RevenueReport';
import { useOccupancyReport } from '../reports/OccupancyReport';
import { usePricingReport } from '../reports/PricingReport';
import { usePaceReport } from '../reports/PaceReport';
import { usePropertiesReport } from '../reports/PropertiesReport';
import { useInterventionsReport } from '../reports/InterventionsReport';
import { useTeamsReport } from '../reports/TeamsReport';
import { useFiscalReport } from '../reports/FiscalReportSection';
import { usePortfolioStatsReport } from '../portfolios/PortfolioStatsTab';
import {
  usePulseCompliance,
  usePulseFinance,
  usePulseGrowth,
  usePulseGuest,
  usePulseOperations,
} from './pulseTiles';

/**
 * Tuiles IMPORTEES : les graphiques et tableaux des Rapports et des
 * statistiques de Portefeuilles, posables un par un sur le tableau de bord.
 *
 * <h2>Ce qui rend la chose possible</h2>
 * <p>Chaque onglet expose desormais son contenu sous forme de hook
 * ({@link ReportContent}) : une liste de tuiles ADRESSABLES par leur cle. Une
 * tuile importee est donc un couple — la source qui sait charger les donnees,
 * et la cle de la tuile a en extraire.</p>
 *
 * <h2>Ce qui n'est PAS duplique</h2>
 * <p>Ni les donnees, ni le rendu : le tableau de bord monte le hook de l'onglet
 * d'origine et rend la meme tuile. Un graphique corrige dans les Rapports l'est
 * ici sans rien recopier. React Query dedoublonne les requetes quand plusieurs
 * tuiles viennent de la meme source.</p>
 *
 * <h2>Le prix a payer</h2>
 * <p>Importer UNE tuile monte le hook de TOUT son onglet, donc ses requetes.
 * C'est le compromis assume : l'alternative — un hook par graphique — aurait
 * demande de decouper neuf ecrans en quarante morceaux, pour une economie que
 * le cache rend en grande partie theorique.</p>
 */

/** Prefixe des identifiants de tuiles importees, persistes en preference. */
export const IMPORT_PREFIX = 'import:';

export interface ImportedWidgetRef {
  sourceId: string;
  tileKey: string;
}

/** `import:reports.overview:revenue-trend` */
export function importedWidgetId(sourceId: string, tileKey: string): string {
  return `${IMPORT_PREFIX}${sourceId}:${tileKey}`;
}

export function parseImportedWidgetId(id: string): ImportedWidgetRef | null {
  if (!id.startsWith(IMPORT_PREFIX)) return null;
  const rest = id.slice(IMPORT_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator <= 0 || separator === rest.length - 1) return null;
  const sourceId = rest.slice(0, separator);
  if (!TILE_SOURCE_IDS.has(sourceId)) return null;
  return { sourceId, tileKey: rest.slice(separator + 1) };
}

/** L'identifiant designe-t-il une tuile importee connue ? */
export function isImportedWidgetId(id: string): boolean {
  return parseImportedWidgetId(id) !== null;
}

export interface TileSource {
  id: string;
  /** Cle i18n du nom de la source, tel qu'il s'appelle dans son ecran. */
  labelKey: string;
  fallback: string;
  /** Ecran d'origine, pour situer la source dans le selecteur. */
  originKey: string;
  originFallback: string;
  /** Route de cet ecran : c'est le renvoi par defaut des tuiles importees. */
  originPath: string;
  /** La source suit-elle la periode choisie sur le tableau de bord ? */
  usesPeriod: boolean;
  useContent: (period: DashboardPeriod) => ReportContent;
}

/**
 * Sources disponibles.
 *
 * <p>`useContent` appelle un hook : chaque entree est donc consommee par un
 * composant qui lui est propre ({@link SourceMount}), monte une seule fois par
 * tuile placee. L'ordre des hooks reste stable pour un composant donne.</p>
 */
export const TILE_SOURCES: TileSource[] = [
  {
    id: 'reports.overview',
    originPath: '/reports',
    labelKey: 'reports.sections.overview.title',
    fallback: 'Synthèse',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: true,
    useContent: (period) => useOverviewReport(period),
  },
  {
    id: 'reports.revenue',
    originPath: '/reports',
    labelKey: 'reports.sections.revenue.title',
    fallback: 'Revenus',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: true,
    useContent: (period) => useRevenueReport(period),
  },
  {
    id: 'reports.occupancy',
    originPath: '/reports',
    labelKey: 'reports.sections.occupancy.title',
    fallback: 'Occupation',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: true,
    useContent: (period) => useOccupancyReport(period),
  },
  {
    id: 'reports.pricing',
    originPath: '/reports',
    labelKey: 'reports.sections.pricing.title',
    fallback: 'Tarifs & prévisions',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: true,
    useContent: (period) => usePricingReport(period),
  },
  {
    id: 'reports.pace',
    originPath: '/reports',
    labelKey: 'reports.sections.pace.title',
    fallback: 'Pace',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: false,
    useContent: () => usePaceReport(),
  },
  {
    id: 'reports.properties',
    originPath: '/reports',
    labelKey: 'reports.sections.properties.title',
    fallback: 'Biens',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: true,
    useContent: (period) => usePropertiesReport(period),
  },
  {
    id: 'reports.interventions',
    originPath: '/reports',
    labelKey: 'reports.sections.interventions.title',
    fallback: 'Interventions',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: false,
    useContent: () => useInterventionsReport(),
  },
  {
    id: 'reports.teams',
    originPath: '/reports',
    labelKey: 'reports.sections.teams.title',
    fallback: 'Équipes',
    originKey: 'navigation.reports',
    originFallback: 'Rapports',
    usesPeriod: false,
    useContent: () => useTeamsReport(),
  },
  {
    id: 'reports.fiscal',
    originPath: '/billing',
    labelKey: 'billing.tabs.fiscalReport',
    fallback: 'Rapport fiscal',
    originKey: 'navigation.billing',
    originFallback: 'Facturation',
    // La TVA se declare par periode fiscale : la tuile suit la periode du
    // tableau de bord, ramenee a la granularite la plus proche.
    usesPeriod: true,
    useContent: (period) => useFiscalReport(period),
  },
  {
    id: 'portfolios.stats',
    originPath: '/directory?tab=portfolios',
    labelKey: 'portfolios.tabs.statistics',
    fallback: 'Statistiques',
    originKey: 'navigation.contactsHub',
    originFallback: 'Annuaire',
    usesPeriod: false,
    useContent: () => usePortfolioStatsReport(),
  },
  {
    id: 'pulse.growth',
    originPath: '/reports',
    labelKey: 'pulse.sources.growth',
    fallback: 'Croissance & distribution',
    originKey: 'navigation.dashboard',
    originFallback: 'Tableau de bord',
    usesPeriod: false,
    useContent: () => usePulseGrowth(),
  },
  {
    id: 'pulse.operations',
    originPath: '/planning',
    labelKey: 'pulse.sources.operations',
    fallback: 'Opérations du parc',
    originKey: 'navigation.dashboard',
    originFallback: 'Tableau de bord',
    usesPeriod: false,
    useContent: () => usePulseOperations(),
  },
  {
    id: 'pulse.compliance',
    originPath: '/documents',
    labelKey: 'pulse.sources.compliance',
    fallback: 'Conformité & mandats',
    originKey: 'navigation.dashboard',
    originFallback: 'Tableau de bord',
    usesPeriod: false,
    useContent: () => usePulseCompliance(),
  },
  {
    id: 'pulse.finance',
    originPath: '/accounting',
    labelKey: 'pulse.sources.finance',
    fallback: 'Trésorerie',
    originKey: 'navigation.dashboard',
    originFallback: 'Tableau de bord',
    usesPeriod: false,
    useContent: () => usePulseFinance(),
  },
  {
    id: 'pulse.guest',
    originPath: '/contact',
    labelKey: 'pulse.sources.guest',
    fallback: 'Voyageurs & réputation',
    originKey: 'navigation.dashboard',
    originFallback: 'Tableau de bord',
    usesPeriod: false,
    useContent: () => usePulseGuest(),
  },
];

const TILE_SOURCE_IDS = new Set(TILE_SOURCES.map((source) => source.id));

export function findTileSource(sourceId: string): TileSource | undefined {
  return TILE_SOURCES.find((source) => source.id === sourceId);
}

/**
 * Monte UNE source et rend ce qu'on lui demande.
 *
 * <p>Un composant par source, cree une fois pour toutes : le hook appele est
 * fixe pour une instance donnee, ce qu'exigent les regles des hooks. Passer la
 * source en propriete d'un composant unique changerait le hook appele d'un
 * rendu a l'autre.</p>
 */
const SOURCE_MOUNTS: Record<string, React.FC<{ period: DashboardPeriod; children: (content: ReportContent) => React.ReactNode }>> =
  Object.fromEntries(
    TILE_SOURCES.map((source) => [
      source.id,
      function SourceMount({ period, children }) {
        const content = source.useContent(period);
        return <>{children(content)}</>;
      },
    ]),
  );

/** Cle de la tuile synthetique qui porte les INDICATEURS d'une source. */
export const KPI_TILE_KEY = 'source-kpis';

/**
 * Tuiles offertes par une source.
 *
 * <p>Les rapports calculent DEUX choses : un bandeau de chiffres — les seuls a
 * porter la variation par rapport a la periode precedente — et des graphiques.
 * Seuls les graphiques etaient importables : aucune tuile posee sur le tableau
 * de bord ne pouvait donc montrer une evolution. Le bandeau devient ici une
 * tuile comme les autres, et arrive avec ses deltas.</p>
 */
export function sourceTiles(content: ReportContent, kpiTitle: string): ReportContent['items'] {
  if (content.figures.length === 0) return content.items;
  return [
    {
      key: KPI_TILE_KEY,
      title: kpiTitle,
      fluid: true,
      render: () => <FiguresRow figures={content.figures} />,
    },
    ...content.items,
  ];
}

/**
 * Renvoi vers l'ecran ou la donnee se travaille.
 *
 * <p>Masque en mode edition (regle `.db-board`) : pendant qu'on reorganise le
 * tableau, un lien sous le curseur est un piege, pas un service.</p>
 */
const OriginLink: React.FC<{ to: string; label: string }> = ({ to, label }) => (
  <Link
    to={to}
    title={label}
    aria-label={label}
    className="db-origin-link inline-flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground"
  >
    <ArrowUpRight className="size-3.5" aria-hidden />
  </Link>
);

/** Rendu d'une tuile importee, dans le cadre du tableau de bord. */
export const ImportedTileWidget: React.FC<{
  reference: ImportedWidgetRef;
  period: DashboardPeriod;
}> = ({ reference, period }) => {
  const { t } = useTranslation();
  const Mount = SOURCE_MOUNTS[reference.sourceId];
  const source = findTileSource(reference.sourceId);
  if (!Mount || !source) return null;

  return (
    <Mount period={period}>
      {(content) => {
        const kpiTitle = t('dashboard.imported.kpisTitle', 'Indicateurs clés');
        const tile = sourceTiles(content, kpiTitle).find((item) => item.key === reference.tileKey);
        if (!tile) {
          // La tuile n'existe pas dans cette periode (pas de donnee) : on le dit,
          // plutot que de laisser un cadre vide sans explication.
          return (
            <ChartTile
              fluid
              title={t('dashboard.imported.missingTitle', 'Graphique indisponible')}
              hint={t('dashboard.imported.missingHint', 'Aucune donnée sur la période choisie.')}
            >
              <span className="sr-only">{reference.tileKey}</span>
            </ChartTile>
          );
        }
        // Le libelle du renvoi doit nommer la DESTINATION, pas la source : une
        // tuile de parc vit sur le tableau de bord mais renvoie ailleurs. Le
        // registre de navigation donne a l'ecran le nom qu'il porte dans la
        // barre laterale ; hors registre, on retombe sur l'ecran d'origine.
        const to = tile.href ?? source.originPath;
        const destination = resolveDestination(to);
        const origin = destination?.translationKey
          ? t(destination.translationKey, destination.fallbackLabel ?? source.originFallback)
          : t(source.originKey, source.originFallback);
        return (
          <ChartTile
            title={tile.title}
            hint={tile.hint}
            fluid={tile.fluid}
            action={
              <div className="flex items-center gap-1">
                {tile.action}
                <OriginLink
                  to={to}
                  label={t('dashboard.imported.openOrigin', 'Ouvrir dans {{screen}}', { screen: origin })}
                />
              </div>
            }
          >
            {tile.render()}
          </ChartTile>
        );
      }}
    </Mount>
  );
};

/**
 * Tuiles proposees par une source — consomme par le selecteur.
 *
 * <p>Les tuiles sont rendues ENTIERES, pas resumees a leur intitule : le
 * selecteur en tire une vignette, et on choisit sur ce qu'on voit plutot que
 * sur ce qu'on devine.</p>
 */
export const SourceTileOptions: React.FC<{
  source: TileSource;
  period: DashboardPeriod;
  children: (tiles: ReportContent['items'], loading: boolean) => React.ReactNode;
}> = ({ source, period, children }) => {
  const { t } = useTranslation();
  const Mount = SOURCE_MOUNTS[source.id];
  if (!Mount) return null;
  return (
    <Mount period={period}>
      {(content) =>
        children(sourceTiles(content, t('dashboard.imported.kpisTitle', 'Indicateurs clés')), content.loading)
      }
    </Mount>
  );
};

/**
 * Gabarit de la vignette du selecteur.
 *
 * <p>Le graphique est rendu a une taille CONFORTABLE puis reduit par
 * `transform`. Le rendre directement a 104 px de large mettrait le
 * `ResponsiveContainer` de Recharts sous son seuil utile : axes rognes,
 * legendes repliees, anneaux coupes — la vignette montrerait autre chose que
 * ce qu'on ajoute.</p>
 */
const THUMB_WIDTH = 104;
const THUMB_HEIGHT = 60;
const THUMB_SOURCE_WIDTH = 380;

/**
 * Le contenu est rendu au MEME rapport que la vignette, puis reduit.
 *
 * <p>Aucun rognage : les graphiques ne dessinent ni axes ni legende en
 * vignette ({@link ChartThumbnailContext}), donc le trace occupe deja toute la
 * surface. Le zoom « a l'estime » qui compensait les gouttieres reservees par
 * Recharts n'a plus lieu d'etre — il decadrait l'anneau, qui n'en avait pas
 * besoin.</p>
 */
const THUMB_SOURCE_HEIGHT = Math.round(THUMB_SOURCE_WIDTH * (THUMB_HEIGHT / THUMB_WIDTH));

export const TileThumbnail: React.FC<{ tile: ReportContent['items'][number] }> = ({ tile }) => {
  const scale = THUMB_WIDTH / THUMB_SOURCE_WIDTH;
  return (
    <span
      aria-hidden
      className="db-thumb relative block shrink-0 overflow-hidden rounded-md border border-border bg-card"
      style={{ width: THUMB_WIDTH, height: THUMB_HEIGHT }}
    >
      <ChartThumbnailContext.Provider value>
        <span
          className="pointer-events-none absolute start-0 top-0 block origin-top-left [&>*]:h-full [&>*]:w-full"
          style={{
            width: THUMB_SOURCE_WIDTH,
            height: THUMB_SOURCE_HEIGHT,
            transform: `scale(${scale})`,
          }}
        >
          {tile.render()}
        </span>
      </ChartThumbnailContext.Provider>
    </span>
  );
};