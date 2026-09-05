import React from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import StatusChip from '../../components/StatusChip';
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Progress,
  Spinner,
  type ChartConfig,
} from '../../components/ui';
import {
  HighlightList,
  StatsBand,
  StatsLayout,
  TileGrid,
  tiles,
  SERIES_TOKENS,
  type Highlight,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import {
  portfoliosApi,
  portfoliosKeys,
  type PortfolioStats,
} from '../../services/api/portfoliosApi';
import { useTranslation } from '../../hooks/useTranslation';
import { PROPERTY_TYPES } from '../../utils/statusUtils';
import { CoverageChart, DonutChart, HistogramChart, TimelineChart } from './PortfolioCharts';

/** Le `t` du hook, plutot qu'une signature reecrite a la main qui diverge. */
type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Statistiques des portefeuilles.
 *
 * <p>Tous les graphiques sont visibles A LA FOIS, dans la hauteur disponible.
 * Le carrousel qui les faisait defiler demandait cinq gestes pour comparer deux
 * repartitions ; un tableau de bord se lit d'un seul regard.</p>
 *
 * <p>Le bandeau, la grille et les graphiques viennent de `components/stats` :
 * l'ecran Rapports tient le meme discours et doit le tenir du meme endroit.</p>
 */
const PortfolioStatsTab: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();

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

  const propertyTypeLabels = stats.propertiesByType.map((bucket) => {
    const option = PROPERTY_TYPES.find((type) => type.value === bucket.label);
    return option ? { ...bucket, label: t(option.i18nKey) } : bucket;
  });

  const tuiles = tiles([
    {
      key: 'composition',
      title: t('portfolios.statistics.composition'),
      hint: t('portfolios.statistics.chartScope', 'Clients et intervenants rattachés'),
      render: () => <CompositionChart breakdown={stats.portfolioBreakdown} t={t} />,
    },
    (stats.propertiesByCity.length > 0 || stats.staffByCity.length > 0) && {
      key: 'coverage',
      title: t('portfolios.statistics.coverage', 'Couverture par ville'),
      hint: t(
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
      key: 'trades',
      title: t('portfolios.statistics.byTrade', 'Intervenants par métier'),
      render: () => <DonutChart buckets={stats.staffByTrade} totalLabel={labelStaff} />,
    },
    stats.propertiesByType.length > 0 && {
      key: 'types',
      title: t('portfolios.statistics.byPropertyType', 'Logements par type'),
      render: () => <DonutChart buckets={propertyTypeLabels} totalLabel={labelProperties} />,
    },
    stats.staffByCity.length > 0 && {
      key: 'staffCity',
      title: t('portfolios.statistics.staffByCity', 'Intervenants par ville'),
      render: () => (
        <HistogramChart buckets={stats.staffByCity} label={labelStaff} tokenIndex={1} />
      ),
    },
    {
      key: 'reperes',
      fluid: true,
      title: t('portfolios.statistics.highlights', 'Repères'),
      hint: t('portfolios.statistics.highlightsHint', 'Les équipes, absentes des graphiques'),
      render: () => <Highlights stats={stats} t={t} />,
    },
    stats.assignmentsByMonth.length > 1 && {
      key: 'timeline',
      title: t('portfolios.statistics.overTime', 'Rattachements dans le temps'),
      hint: t('portfolios.statistics.overTimeHint', 'Par mois, clients et intervenants'),
      render: () => (
        <TimelineChart
          points={stats.assignmentsByMonth}
          clientsLabel={labelClients}
          staffLabel={labelStaff}
        />
      ),
    },
  ] as TileOrNothing[]);

  return (
    <StatsLayout>
      <SummaryBand stats={stats} t={t} />
      <TileGrid items={tuiles} />
    </StatsLayout>
  );
};

const SummaryBand: React.FC<{ stats: PortfolioStats; t: Translate }> = ({ stats, t }) => {
  const totalPortfolios = stats.totalPortfolios;
  const inactive = stats.inactivePortfolios;
  const activeShare = totalPortfolios > 0 ? (stats.activePortfolios / totalPortfolios) * 100 : 0;

  const staffPerProperty =
    stats.totalProperties > 0 ? stats.totalTeamMembers / stats.totalProperties : null;
  const propertiesPerClient =
    stats.totalClients > 0 ? stats.totalProperties / stats.totalClients : null;

  const figures: StatFigure[] = [
    { key: 'portfolios', value: totalPortfolios, label: t('portfolios.statistics.portfolios') },
    { key: 'clients', value: stats.totalClients, label: t('portfolios.statistics.clients') },
    { key: 'properties', value: stats.totalProperties, label: t('portfolios.statistics.properties') },
    { key: 'staff', value: stats.totalTeamMembers, label: t('portfolios.statistics.staff') },
  ];
  if (staffPerProperty !== null) {
    figures.push({
      key: 'staffPerProperty',
      value: staffPerProperty.toFixed(1),
      label: t('portfolios.statistics.staffPerProperty', 'intervenants / logement'),
      muted: true,
    });
  }
  if (propertiesPerClient !== null) {
    figures.push({
      key: 'propertiesPerClient',
      value: propertiesPerClient.toFixed(1),
      label: t('portfolios.statistics.propertiesPerClient', 'logements / client'),
      muted: true,
    });
  }

  return (
    <StatsBand
      figures={figures}
      footer={
        inactive > 0 ? (
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
        ) : undefined
      }
    />
  );
};

/**
 * Repères chiffrés.
 *
 * <p>La première version répétait ses voisins : « villes couvertes » se comptait
 * sur les barres de l'histogramme d'à côté, « ville la mieux dotée » en était la
 * première barre, et le rapport ménage / maintenance se lisait dans l'anneau.
 * Un tableau de bord n'a pas à dire deux fois la même chose.</p>
 *
 * <p>Ces lignes portent donc ce qu'AUCUN graphique ne montre : les ÉQUIPES. Le
 * reste de l'écran décrit des effectifs et des lieux, jamais la structure qui
 * les organise. Les équipes personnelles — celles qui ne portent que les zones
 * de couverture d'un intervenant — en sont exclues côté serveur : elles
 * n'existent pas sur le terrain.</p>
 */
const Highlights: React.FC<{ stats: PortfolioStats; t: Translate }> = ({ stats, t }) => {
  const villesAvecStaff = new Set(stats.staffByCity.map((b) => b.label));
  const villesDecouvertes = stats.propertiesByCity
    .map((b) => b.label)
    .filter((ville) => !villesAvecStaff.has(ville));

  const lignes: Highlight[] = [
    {
      label: t('portfolios.statistics.teams', 'Équipes'),
      value: `${stats.totalTeams}`,
    },
    {
      label: t('portfolios.statistics.avgTeamSize', 'Membres par équipe en moyenne'),
      value: stats.averageTeamSize.toFixed(1),
    },
    {
      label: t('portfolios.statistics.staffWithoutTeam', 'Intervenants sans équipe'),
      value: `${stats.staffWithoutTeam}`,
      alert: stats.staffWithoutTeam > 0,
    },
    {
      label: t('portfolios.statistics.emptyTeams', 'Équipes sans membre'),
      value: `${stats.teamsWithoutMembers}`,
      alert: stats.teamsWithoutMembers > 0,
    },
  ];
  if (villesDecouvertes.length > 0) {
    lignes.push({
      label: t('portfolios.statistics.citiesUncovered', 'Villes sans intervenant'),
      value: `${villesDecouvertes.length} · ${villesDecouvertes.slice(0, 2).join(', ')}`,
      alert: true,
    });
  }

  return <HighlightList items={lignes} />;
};

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

  const showStates = breakdown.length > 1 || breakdown.some((p) => !p.isActive);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
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
