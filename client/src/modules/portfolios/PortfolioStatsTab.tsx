import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import StatusChip from '../../components/StatusChip';
import StatTile from '../../components/baitly/StatTile';
import StatTileRow from '../../components/baitly/StatTileRow';
import {
  Card,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Progress,
  Spinner,
  type ChartConfig,
} from '../../components/ui';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { useViewportFill } from '../../hooks/useViewportFill';
import {
  portfoliosApi,
  portfoliosKeys,
  type PortfolioStats,
} from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../utils/cn';
import { Business, Group, Home, People } from '../../icons';
import {
  CHART_MIN_HEIGHT,
  CoverageChart,
  DonutChart,
  HistogramChart,
  SERIES_TOKENS,
  TimelineChart,
} from './PortfolioCharts';

/** Le `t` du hook, plutot qu'une signature reecrite a la main qui diverge. */
type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Statistiques des portefeuilles.
 *
 * <p>Tous les graphiques sont visibles A LA FOIS, dans la hauteur disponible.
 * Le carrousel qui les faisait defiler demandait cinq gestes pour comparer deux
 * repartitions ; un tableau de bord se lit d'un seul regard.</p>
 *
 * <p>La grille recoit la hauteur mesuree et ses rangees valent `minmax(0, 1fr)` :
 * les tuiles se partagent l'espace au lieu de le reclamer. Chaque graphique
 * remplit la sienne, il ne fixe plus sa propre hauteur — c'est ce qui evite le
 * defilement. Sous la largeur ou les tuiles s'empilent, la hauteur mesuree n'est
 * pas appliquee : entasser six graphiques dans un ecran etroit les rendrait
 * illisibles, mieux vaut alors laisser la page defiler.</p>
 */
const PortfolioStatsTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  // Appele AVANT tout retour anticipe : regle des Hooks.
  const [fillRef, fillHeight] = useViewportFill<HTMLDivElement>();

  const statsQuery = useQuery({
    queryKey: portfoliosKeys.stats(user?.id ?? ''),
    queryFn: () => portfoliosApi.getStatsByManager(user!.id),
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  const stats = statsQuery.data;

  if (statsQuery.isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (statsQuery.isError) {
    return (
      <p className="py-6 text-center text-sm text-destructive">
        {t('portfolios.errors.connectionError')}
      </p>
    );
  }

  if (!stats) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        {t('portfolios.statistics.noDataAvailable')}
      </p>
    );
  }

  const labelClients = t('portfolios.statistics.clientsLabel');
  const labelStaff = t('portfolios.statistics.staff');
  const labelProperties = t('portfolios.statistics.properties');

  // Une tuile dont la donnee est vide n'est pas rendue : un cadre titre sur un
  // graphique absent occupe de la place pour ne rien dire.
  const tuiles: Tuile[] = (
    [
      {
        cle: 'composition',
        titre: t('portfolios.statistics.composition'),
        precision: t('portfolios.statistics.chartScope', 'Clients et intervenants rattachés'),
        render: () => <CompositionChart breakdown={stats.portfolioBreakdown} t={t} />,
      },
      (stats.propertiesByCity.length > 0 || stats.staffByCity.length > 0) && {
        cle: 'coverage',
        titre: t('portfolios.statistics.coverage', 'Couverture par ville'),
        precision: t(
          'portfolios.statistics.coverageHint',
          'Une ville sans intervenant appelle un rattachement',
        ),
        render: () => (
          <CoverageChart
            properties={stats.propertiesByCity}
            staff={stats.staffByCity}
            propertiesLabel={labelProperties}
            staffLabel={labelStaff}
          />
        ),
      },
      stats.staffByTrade.length > 0 && {
        cle: 'trades',
        titre: t('portfolios.statistics.byTrade', 'Intervenants par métier'),
        render: () => <DonutChart buckets={stats.staffByTrade} totalLabel={labelStaff} />,
      },
      stats.propertiesByType.length > 0 && {
        cle: 'types',
        titre: t('portfolios.statistics.byPropertyType', 'Logements par type'),
        render: () => <DonutChart buckets={stats.propertiesByType} totalLabel={labelProperties} />,
      },
      stats.staffByCity.length > 0 && {
        cle: 'staffCity',
        titre: t('portfolios.statistics.staffByCity', 'Intervenants par ville'),
        render: () => (
          <HistogramChart buckets={stats.staffByCity} label={labelStaff} tokenIndex={1} />
        ),
      },
      // Deux mois au minimum : une aire tracee sur un point unique ne dessine
      // rien, et « dans le temps » ne veut rien dire sur un mois isole.
      stats.assignmentsByMonth.length > 1 && {
        cle: 'timeline',
        titre: t('portfolios.statistics.overTime', 'Rattachements dans le temps'),
        precision: t('portfolios.statistics.overTimeHint', 'Par mois, clients et intervenants'),
        render: () => (
          <TimelineChart
            points={stats.assignmentsByMonth}
            clientsLabel={labelClients}
            staffLabel={labelStaff}
          />
        ),
      },
    ] as Array<Tuile | false>
  ).filter(Boolean) as Tuile[];

  return (
    // `min-h-0` sur le conteneur ET sur la grille : sans lui, le plancher
    // `min-height: auto` d'un element flex empeche la grille de se comprimer,
    // et la hauteur mesuree serait aussitot depassee.
    <div className="flex min-h-0 flex-col gap-3">
      <KpiSection stats={stats} t={t} />

      <div
        ref={fillRef}
        style={fillHeight ? { height: fillHeight } : undefined}
        className={cn(
          'grid min-h-0 grid-cols-1 gap-3',
          // Deux puis trois colonnes : un histogramme a six villes dans un tiers
          // de 1200 px n'a plus la place d'ecrire ses libelles.
          'min-[900px]:grid-cols-2 min-[1500px]:grid-cols-3',
          // Rangees egales, et surtout un plancher a zero : sans `minmax(0, …)`
          // une rangee `auto` se dimensionne sur son contenu et deborde.
          'min-[900px]:auto-rows-[minmax(0,1fr)]',
        )}
      >
        {tuiles.map((tuile) => (
          <ChartTile key={tuile.cle} titre={tuile.titre} precision={tuile.precision}>
            {tuile.render()}
          </ChartTile>
        ))}
      </div>
    </div>
  );
};

// ─── Tuile ───────────────────────────────────────────────────────────────────

interface Tuile {
  cle: string;
  titre: string;
  precision?: string;
  render: () => React.ReactNode;
}

/**
 * Cadre d'un graphique.
 *
 * <p>Le titre est fixe (`shrink-0`) et le graphique prend le reste : c'est le
 * graphique qui doit maigrir quand la place manque, jamais son intitule.</p>
 */
const ChartTile: React.FC<{
  titre: string;
  precision?: string;
  children: React.ReactNode;
}> = ({ titre, precision, children }) => (
  <Card className="flex min-h-0 flex-col gap-2 overflow-hidden border-border p-3.5">
    <div className="min-w-0 shrink-0">
      <h3 className="m-0 truncate text-sm font-semibold tracking-tight text-foreground">{titre}</h3>
      {precision ? (
        <p className="m-0 mt-0.5 truncate text-2xs text-muted-foreground">{precision}</p>
      ) : null}
    </div>
    {/* `@container` : les anneaux passent leur legende a cote ou dessous
        selon la largeur de LA TUILE, que nulle media query ne connait. */}
    <div className="@container min-h-0 flex-1" style={{ minHeight: CHART_MIN_HEIGHT }}>
      {children}
    </div>
  </Card>
);

// ─── Bande de synthese ───────────────────────────────────────────────────────

/**
 * Les indicateurs de tête.
 *
 * <p>Quatre volumes, puis deux RATIOS que les totaux bruts ne disent pas :
 * combien d'intervenants pour tenir un logement, et quelle taille de parc par
 * client. Ce sont eux qui se comparent d'un mois sur l'autre — un total de
 * logements ne dit rien sans l'effectif en face.</p>
 *
 * <p>La jauge d'activité ne s'affiche QUE s'il y a un portefeuille inactif :
 * une barre bloquée à 100 % sur tous les écrans est une décoration, pas un
 * indicateur, et elle coûterait ici la hauteur des graphiques.</p>
 */
const KpiSection: React.FC<{ stats: PortfolioStats; t: Translate }> = ({ stats, t }) => {
  const totalPortfolios = stats.totalPortfolios;
  const inactive = stats.inactivePortfolios;
  const activeShare = totalPortfolios > 0 ? (stats.activePortfolios / totalPortfolios) * 100 : 0;

  const staffPerProperty =
    stats.totalProperties > 0 ? stats.totalTeamMembers / stats.totalProperties : null;
  const propertiesPerClient =
    stats.totalClients > 0 ? stats.totalProperties / stats.totalClients : null;

  return (
    <div className="flex shrink-0 flex-col gap-2">
      <StatTileRow columns={6}>
        <StatTile
          icon={<Business />}
          label={t('portfolios.statistics.portfolios')}
          value={totalPortfolios}
          hint={
            inactive > 0
              ? `${stats.activePortfolios} ${t('portfolios.statistics.activeShare', 'actifs')}`
              : undefined
          }
        />
        <StatTile
          icon={<People />}
          label={t('portfolios.statistics.clients')}
          value={stats.totalClients}
          iconClassName="text-success"
        />
        <StatTile
          icon={<Home />}
          label={t('portfolios.statistics.properties')}
          value={stats.totalProperties}
          iconClassName="text-info"
        />
        <StatTile
          icon={<Group />}
          label={t('portfolios.statistics.staff')}
          value={stats.totalTeamMembers}
          iconClassName="text-warning"
        />
        {/* Les ratios portent une unité : « 5,1 » seul ne se lit pas. */}
        <StatTile
          icon={<Group />}
          label={t('portfolios.statistics.staffPerProperty', 'intervenants / logement')}
          value={staffPerProperty !== null ? staffPerProperty.toFixed(1) : '—'}
          iconClassName="text-muted-foreground"
        />
        <StatTile
          icon={<Home />}
          label={t('portfolios.statistics.propertiesPerClient', 'logements / client')}
          value={propertiesPerClient !== null ? propertiesPerClient.toFixed(1) : '—'}
          iconClassName="text-muted-foreground"
        />
      </StatTileRow>

      {inactive > 0 ? (
        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-muted-foreground">
              {stats.activePortfolios}/{totalPortfolios}{' '}
              {t('portfolios.statistics.activeShare', 'actifs')}
            </span>
            <span className="font-semibold tabular-nums text-warning-ink">
              {inactive} {t('portfolios.teamManagement.inactive')}
            </span>
          </div>
          <Progress value={activeShare} className="h-1.5" />
        </div>
      ) : null}
    </div>
  );
};

// ─── Composition par portefeuille ────────────────────────────────────────────

const CompositionChart: React.FC<{
  breakdown: PortfolioStats['portfolioBreakdown'];
  t: Translate;
}> = ({ breakdown, t }) => {
  const config: ChartConfig = {
    clients: { label: t('portfolios.statistics.clientsLabel'), color: SERIES_TOKENS[0] },
    staff: { label: t('portfolios.statistics.staff'), color: SERIES_TOKENS[1] },
  };

  const data = breakdown.map((portfolio) => ({
    name: portfolio.portfolioName,
    clients: portfolio.clientCount,
    staff: portfolio.teamMemberCount,
  }));

  if (data.length === 0) {
    return (
      <p className="m-0 py-6 text-center text-xs text-muted-foreground">
        {t('portfolios.statistics.noDataAvailable')}
      </p>
    );
  }

  // Un seul portefeuille : les puces d'etat en diraient autant que le
  // graphique, et mangeraient la hauteur dont il a besoin.
  const showStates = breakdown.length > 1 || breakdown.some((p) => !p.isActive);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Barres HORIZONTALES : un nom de portefeuille tient sur une ligne, pas
          sous une colonne verticale ou il serait tronque ou pivote. */}
      <div className="min-h-0 flex-1">
        <ChartContainer config={config} className="aspect-auto h-full w-full">
          <BarChart
            accessibilityLayer
            layout="vertical"
            data={data}
            margin={{ top: 4, right: 12, bottom: 0, left: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" axisLine={false} tickLine={false} allowDecimals={false} />
            <YAxis
              type="category"
              dataKey="name"
              axisLine={false}
              tickLine={false}
              width={110}
              tickMargin={6}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="clients" fill="var(--color-clients)" radius={[0, 3, 3, 0]} maxBarSize={14} />
            <Bar dataKey="staff" fill="var(--color-staff)" radius={[0, 3, 3, 0]} maxBarSize={14} />
          </BarChart>
        </ChartContainer>
      </div>

      {/* L'etat de chaque portefeuille reste une information TEXTUELLE : une
          couleur de barre ne doit pas avoir a la porter. */}
      {showStates ? (
        <div className="flex shrink-0 flex-wrap gap-1.5">
          {breakdown.map((portfolio) => (
            <StatusChip
              key={portfolio.portfolioId}
              tone={portfolio.isActive ? 'ok' : 'neutral'}
              dot
              label={
                portfolio.isActive
                  ? portfolio.portfolioName
                  : `${portfolio.portfolioName} · ${t('portfolios.teamManagement.inactive')}`
              }
              className="h-[20px] text-[0.6rem]"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
};

export default PortfolioStatsTab;
