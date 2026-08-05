import React, { useState, useEffect, useMemo } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Spinner } from '../../components/ui';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, Separator, Skeleton } from '../../components/ui';
import {
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon,
  Build,
  CheckCircle,
  HourglassEmpty,
  PriorityHigh,
  TrendingUp,
  TrendingDown,
  Remove,
  Category,
  AttachMoney,
  Speed,
  Groups,
  TaskAlt,
  AssignmentTurnedIn,
  Apartment,
  Engineering,
  Percent,
  Timeline,
  PriceChange,
  TuneOutlined,
  Hotel,
} from '../../icons';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '../../utils/cn';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useCurrency } from '../../hooks/useCurrency';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import PeriodSegmented from './PeriodSegmented';
import StatTile from '../../components/baitly/StatTile';
import EmptyState from '../../components/EmptyState';
import DashboardErrorBoundary from '../dashboard/DashboardErrorBoundary';
import AnalyticsGlobalPerformance from '../dashboard/analytics/AnalyticsGlobalPerformance';
import AnalyticsRevenue from '../dashboard/analytics/AnalyticsRevenue';
import AnalyticsAlerts from '../dashboard/analytics/AnalyticsAlerts';
import AnalyticsRecommendations from '../dashboard/analytics/AnalyticsRecommendations';
import AnalyticsOccupancy from '../dashboard/analytics/AnalyticsOccupancy';
import AnalyticsClientAnalysis from '../dashboard/analytics/AnalyticsClientAnalysis';
import AnalyticsPropertyPerformance from '../dashboard/analytics/AnalyticsPropertyPerformance';
import AnalyticsBenchmark from '../dashboard/analytics/AnalyticsBenchmark';
import AnalyticsWidgetCard from '../dashboard/analytics/AnalyticsWidgetCard';
import { Money } from '../../components/Money';
import type { DashboardPeriod, DateFilterOption } from '../dashboard/DashboardDateFilter';
import {
  useInterventionReport,
  usePropertyReport,
  useTeamReport,
  useFinancialReport,
} from './hooks/useReportData';
import {
  useChartTokens,
  axisTick,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  renderChartLegendText,
} from './chartTheme';

// ─── Constants ──────────────────────────────────────────────────────────────

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
  { value: 'year', label: '1 an' },
];

const EMPTY_INTERVENTIONS: Array<{ estimatedCost?: number; actualCost?: number; type: string; status: string; scheduledDate?: string; createdAt?: string }> = [];

// ─── Mini chart constants (Pricing + Forecasts combined section) ────────────
// Couleurs SVG (séries/grilles/ticks) : tokens résolus via useChartTokens().
// `--card-spacing` porte le rembourrage de la carte du kit (py sur la carte,
// px sur le contenu) : c'est le report de l'ancien `p: 1.25` (7,5 px).
const MINI_CHART_CARD_CLASS = 'w-full h-[220px] [--card-spacing:7.5px]';
const MINI_CHART_CONTENT_CLASS = 'flex-1 min-h-0 flex flex-col';
// Libelle overline des mini-cartes (ex-MINI_CHART_LABEL_SX : mb 0.5 = 3 px avec spacing 6).
const MINI_CHART_LABEL_CLASS =
  'text-2xs font-bold uppercase tracking-[0.05em] text-faint mb-[3px] shrink-0';
const MINI_CHART_MARGIN = { top: 4, right: 6, left: -18, bottom: 4 } as const;

// ─── Shared sx constants ────────────────────────────────────────────────────
// Cartes : peau globale du kit (filet + rayon) — pas de transform au hover
// (anti-pattern baseline §5).

// Report en classes des anciens `sx` de cartes : hauteur pleine + rembourrage
// (ex-`p: 2` = 12 px pour les cartes hero/graphe, `p: 1.5` = 9 px pour les
// cartes secondaires).
const HERO_CARD_CLASS = 'h-full [--card-spacing:12px]';

const SECONDARY_CARD_CLASS = 'h-full [--card-spacing:9px]';

// Libelle de section overline (ex-SECTION_LABEL_SX : mb 1 = 6 px avec spacing 6).
const SECTION_LABEL_CLASS =
  'text-2xs font-bold uppercase tracking-[0.05em] text-faint mb-1.5';

// ─── Shared KPI types ───────────────────────────────────────────────────────

interface KpiItem {
  key: string;
  title: string;
  value: string;
  subtitle?: string;
  trend?: number;
  icon: React.ReactNode;
  iconColor: string;
}

// ─── Shared sub-components ──────────────────────────────────────────────────

const TrendBadge: React.FC<{ value: number }> = ({ value }) => {
  const isUp = value > 0;
  const isDown = value < 0;
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Remove;
  // Encre `-ink` : la valeur est du TEXTE, la teinte vive n'y tient pas l'AA.
  const color = isUp ? 'var(--bui-success-ink)' : isDown ? 'var(--bui-destructive-ink)' : 'var(--bui-faint)';
  return (
    <div className="inline-flex items-center gap-0.5 mt-0.5">
      <span className="inline-flex" style={{ color }}>
        <Icon size={12} strokeWidth={1.75} />
      </span>
      {/* Couleur choisie a l'execution (haut/bas/plat) : style inline, une classe
          Tailwind ne peut pas naitre d'une variable. */}
      <p className="text-2xs font-semibold tabular-nums" style={{ color }}>
        {isUp ? '+' : ''}{value}%
      </p>
    </div>
  );
};

/**
 * Adaptateur : les cartes heros de tous les onglets de rapports rendent
 * desormais la tuile de la projection (StatTile), sans changer un seul site
 * d'appel. La teinte hex/var d'icone des appelants est rabattue sur les
 * classes semantiques de la tuile ; l'indice porte tendance et sous-titre.
 */
const KPI_ICON_CLASS: Record<string, string | undefined> = {
  'var(--bui-success)': 'text-success',
  'var(--bui-warning)': 'text-warning',
  'var(--bui-destructive)': 'text-destructive',
  'var(--bui-info)': 'text-info',
  'var(--bui-primary)': undefined,
};

const HeroKpiCard: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <StatTile
    icon={item.icon}
    label={item.title}
    value={item.value}
    iconClassName={KPI_ICON_CLASS[item.iconColor]}
    loading={loading}
    className="h-full"
    hint={
      item.trend !== undefined ? (
        // Meme forme textuelle que le TrendHint du Dashboard : le <b> est
        // style par la tuile elle-meme. TrendBadge rendrait un div dans le
        // span du hint — HTML invalide.
        <>
          <b>{item.trend > 0 ? '+' : ''}{item.trend} %</b>
          {item.subtitle ? ` · ${item.subtitle}` : ''}
        </>
      ) : (
        item.subtitle
      )
    }
  />
);

const SecondaryKpiRow: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <div className="flex items-center gap-2 py-1.5 px-0.5">
    <div
      className="flex items-center justify-center size-7 rounded-md shrink-0 text-[var(--kpi-icon)] bg-[color-mix(in_srgb,_var(--kpi-icon)_10%,_transparent)] [&_svg]:size-3.5"
      style={{ '--kpi-icon': item.iconColor } as React.CSSProperties}
    >
      {item.icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[11.5px] text-muted-foreground font-medium leading-[1.2]">
        {item.title}
      </p>
    </div>
    <div className="text-end shrink-0">
      {loading ? (
        <Skeleton className="h-[18px] w-12 rounded-[4px]" />
      ) : (
        <>
          <p className="font-[family-name:var(--font-display)] text-sm font-semibold leading-[1.2] text-foreground tabular-nums">
            {item.value}
          </p>
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </div>
  </div>
);

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; dataKey?: string }>;
  label?: string;
}

// Tooltip en encre inversée : fond `foreground`, texte `background`, r8, 11.5px fw600.
const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="px-2 py-1 rounded-md bg-foreground text-background">
      {label && (
        <p className="font-bold mb-0.5 text-[11.5px] text-background">
          {label}
        </p>
      )}
      {payload.map((entry) => (
        <div className="flex items-center gap-1" key={entry.name}>
          <div className="w-[8px] h-[8px] rounded-[2px] shrink-0" style={{ backgroundColor: entry.color || 'var(--bui-primary)' }} />
          <p className="text-[11.5px] font-semibold text-background tabular-nums">
            {entry.name}: {entry.value}
          </p>
        </div>
      ))}
    </div>
  );
};

// ─── Chart Card Wrapper ─────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

// Carte de graphe : peau globale du kit (filet + rayon) + titre overline.
const ChartCard: React.FC<ChartCardProps> = ({ title, children }) => (
  <Card className={HERO_CARD_CLASS}>
    <CardContent>
      <p className="text-2xs font-bold mb-3 text-faint uppercase tracking-[0.05em]">
        {title}
      </p>
      {children}
    </CardContent>
  </Card>
);

// ─── Empty State ────────────────────────────────────────────────────────────

interface EmptyChartStateProps {
  message: string;
  description?: string;
}

// La carte de graphe porte déjà sa bordure : variante `transparent` pour ne pas
// empiler deux cadres. L'icône hero et son échelle responsive viennent du
// primitive partagé, plus d'un `size` figé.
const EmptyChartState: React.FC<EmptyChartStateProps> = ({ message, description }) => (
  <EmptyState
    icon={<BarChartIcon />}
    title={message}
    description={description}
    variant="transparent"
  />
);

// ─── Report: Interventions ──────────────────────────────────────────────────

const InterventionsReport: React.FC = () => {
  const { t } = useTranslation();
  const ct = useChartTokens();
  const { data, loading, error, retry } = useInterventionReport();

  // Compute KPI values from data
  const kpis = useMemo(() => {
    if (!data) return null;
    const totalInterventions = data.byStatus.reduce((s, i) => s + i.value, 0);
    const completed = data.byStatus.find((s) => s.name === 'COMPLETED')?.value ?? 0;
    const pending = data.byStatus.find((s) => s.name === 'PENDING')?.value ?? 0;
    const inProgress = data.byStatus.find((s) => s.name === 'IN_PROGRESS')?.value ?? 0;
    const completionRate = totalInterventions > 0 ? Math.round((completed / totalInterventions) * 100) : 0;
    const avgPerMonth = data.byMonth.length > 0
      ? Math.round(data.byMonth.reduce((s, m) => s + m.total, 0) / data.byMonth.length)
      : 0;
    const lastMonth = data.byMonth.length >= 2 ? data.byMonth[data.byMonth.length - 1] : null;
    const prevMonth = data.byMonth.length >= 2 ? data.byMonth[data.byMonth.length - 2] : null;
    const monthTrend = prevMonth && prevMonth.total > 0
      ? Math.round(((lastMonth!.total - prevMonth.total) / prevMonth.total) * 100)
      : 0;
    return { totalInterventions, completed, pending, inProgress, completionRate, avgPerMonth, monthTrend };
  }, [data]);

  return (
    <DataFetchWrapper
      loading={loading}
      error={error}
      onRetry={retry}
      loadingMessage={t('reports.charts.loadingData')}
    >
      {data ? (
        <div>
          {/* ─── Hero KPIs ───────────────────────────────────────── */}
          <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
            {([
              {
                key: 'total', title: t('reports.kpi.totalInterventions', 'Total interventions'),
                value: `${kpis?.totalInterventions ?? 0}`, icon: <Build />, iconColor: 'var(--bui-primary)',
                trend: kpis?.monthTrend,
              },
              {
                key: 'completion', title: t('reports.kpi.completionRate', 'Taux de completion'),
                value: `${kpis?.completionRate ?? 0}%`, icon: <CheckCircle />, iconColor: 'var(--bui-success)',
              },
              {
                key: 'pending', title: t('reports.kpi.pending', 'En attente'),
                value: `${kpis?.pending ?? 0}`, icon: <HourglassEmpty />, iconColor: 'var(--bui-warning)',
              },
              {
                key: 'avgMonth', title: t('reports.kpi.avgPerMonth', 'Moy. / mois'),
                value: `${kpis?.avgPerMonth ?? 0}`, icon: <Speed />, iconColor: 'var(--bui-info)',
              },
            ] as KpiItem[]).map((kpi) => (
              <div className="col-span-6 min-[600px]:col-span-3" key={kpi.key}>
                <HeroKpiCard item={kpi} loading={false} />
              </div>
            ))}
          </div>

          {/* ─── Secondary KPIs (status breakdown + type breakdown) ── */}
          <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
            <div className="col-span-12 min-[900px]:col-span-6">
              <Card className={SECONDARY_CARD_CLASS}>
                <CardContent>
                  <p className={SECTION_LABEL_CLASS}>
                    {t('reports.kpi.statusBreakdown', 'Repartition par statut')}
                  </p>
                  {data.byStatus.map((item, i) => (
                    <React.Fragment key={item.name}>
                      {i > 0 && <div className="border-t border-border" />}
                      <SecondaryKpiRow
                        item={{
                          key: item.name, title: item.name, value: `${item.value}`,
                          icon: <AssignmentTurnedIn />, iconColor: item.color || ct.series[i % ct.series.length],
                        }}
                        loading={false}
                      />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <Card className={SECONDARY_CARD_CLASS}>
                <CardContent>
                  <p className={SECTION_LABEL_CLASS}>
                    {t('reports.kpi.typeBreakdown', 'Repartition par type')}
                  </p>
                  {data.byType.map((item, i) => (
                    <React.Fragment key={item.name}>
                      {i > 0 && <div className="border-t border-border" />}
                      <SecondaryKpiRow
                        item={{
                          key: item.name, title: item.name, value: `${item.value}`,
                          icon: <Category />, iconColor: item.color || ct.series[i % ct.series.length],
                        }}
                        loading={false}
                      />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ─── Charts: Status pie + Type bar side by side ─────── */}
          <div className="grid grid-cols-12 gap-[9px] mb-3">
            <div className="col-span-12 min-[900px]:col-span-6">
              <ChartCard title={t('reports.charts.interventionsByStatus')}>
                {data.byStatus.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.byStatus} cx="50%" cy="50%"
                        innerRadius={55} outerRadius={90} paddingAngle={3}
                        dataKey="value" nameKey="name"
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`
                        }
                        labelLine={true}
                      >
                        {data.byStatus.map((entry, index) => (
                          <Cell key={`status-${entry.name}`} fill={entry.color || ct.series[index % ct.series.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={9} formatter={renderChartLegendText} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <ChartCard title={t('reports.charts.interventionsByType')}>
                {data.byType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.byType}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                      <XAxis dataKey="name" tick={axisTick(ct)} />
                      <YAxis allowDecimals={false} tick={axisTick(ct)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t('reports.charts.interventions')} radius={[4, 4, 0, 0]}>
                        {data.byType.map((entry, index) => (
                          <Cell key={`type-${entry.name}`} fill={entry.color || ct.series[index % ct.series.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
          </div>

          {/* ─── Chart: Monthly trend (full width area chart) ───── */}
          <div className="grid grid-cols-12 gap-[9px] mb-3">
            <div className="col-span-12">
              <ChartCard title={t('reports.charts.interventionsByMonth')}>
                {data.byMonth.some((m) => m.total > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.byMonth}>
                      <defs>
                        {/* Fondu d'aire accent → transparent (réf. .wk-area, opacité .22→0) */}
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ct.accent} stopOpacity={0.22} />
                          <stop offset="95%" stopColor={ct.accent} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ct.ok} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={ct.ok} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                      <XAxis dataKey="month" tick={axisTick(ct)} />
                      <YAxis allowDecimals={false} tick={axisTick(ct)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={9} formatter={renderChartLegendText} />
                      <Area type="monotone" dataKey="total" name={t('reports.charts.total')} stroke={ct.accent} strokeWidth={2} fill="url(#gradTotal)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="completed" name={t('reports.charts.completed')} stroke={ct.ok} strokeWidth={2} fill="url(#gradCompleted)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="pending" name={t('reports.charts.pending')} stroke={ct.warn} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
          </div>

          {/* ─── Chart: Priority (horizontal bar) ───────────────── */}
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12 min-[900px]:col-span-6">
              <ChartCard title={t('reports.charts.interventionsByPriority')}>
                {data.byPriority.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.byPriority} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick(ct)} />
                      <YAxis type="category" dataKey="name" tick={axisTick(ct)} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t('reports.charts.interventions')} radius={[0, 4, 4, 0]}>
                        {data.byPriority.map((entry, index) => (
                          <Cell key={`priority-${entry.name}`} fill={entry.color || ct.series[index % ct.series.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
          </div>
        </div>
      ) : (
        <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
      )}
    </DataFetchWrapper>
  );
};

// ─── Report: Teams ──────────────────────────────────────────────────────────

const TeamsReport: React.FC = () => {
  const { t } = useTranslation();
  const ct = useChartTokens();
  const { data, loading, error, retry } = useTeamReport();

  // Compute KPI values
  const kpis = useMemo(() => {
    if (!data || data.teamPerformance.length === 0) return null;
    const teams = data.teamPerformance;
    const totalTeams = teams.length;
    const totalTasks = teams.reduce((s, tp) => s + tp.completed + tp.inProgress + tp.pending, 0);
    const totalCompleted = teams.reduce((s, tp) => s + tp.completed, 0);
    const totalPending = teams.reduce((s, tp) => s + tp.pending, 0);
    const totalInProgress = teams.reduce((s, tp) => s + tp.inProgress, 0);
    const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
    const avgTasksPerTeam = totalTeams > 0 ? Math.round(totalTasks / totalTeams) : 0;
    // Top performer = team with highest completion count
    const topPerformer = [...teams].sort((a, b) => b.completed - a.completed)[0];

    return { totalTeams, totalTasks, totalCompleted, totalPending, totalInProgress, completionRate, avgTasksPerTeam, topPerformer };
  }, [data]);

  // Per-team completion rate for chart
  const teamCompletionRates = useMemo(() => {
    if (!data) return [];
    return data.teamPerformance.map((tp) => {
      const total = tp.completed + tp.inProgress + tp.pending;
      return {
        name: tp.name,
        completionRate: total > 0 ? Math.round((tp.completed / total) * 100) : 0,
        total,
      };
    }).sort((a, b) => b.completionRate - a.completionRate);
  }, [data]);

  return (
    <DataFetchWrapper
      loading={loading}
      error={error}
      onRetry={retry}
      loadingMessage={t('reports.charts.loadingData')}
    >
      {data ? (
        <div>
          {/* ─── Hero KPIs ───────────────────────────────────────── */}
          <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
            {([
              {
                key: 'teams', title: t('reports.kpi.totalTeams', 'Equipes'),
                value: `${kpis?.totalTeams ?? 0}`, icon: <Groups />, iconColor: 'var(--bui-primary)',
              },
              {
                key: 'tasks', title: t('reports.kpi.totalTasks', 'Total taches'),
                value: `${kpis?.totalTasks ?? 0}`, icon: <TaskAlt />, iconColor: 'var(--bui-info)',
              },
              {
                key: 'rate', title: t('reports.kpi.completionRate', 'Taux de completion'),
                value: `${kpis?.completionRate ?? 0}%`, icon: <Percent />, iconColor: 'var(--bui-success)',
              },
              {
                key: 'avg', title: t('reports.kpi.avgTasksPerTeam', 'Moy. taches / equipe'),
                value: `${kpis?.avgTasksPerTeam ?? 0}`, icon: <Speed />, iconColor: 'var(--bui-warning)',
              },
            ] as KpiItem[]).map((kpi) => (
              <div className="col-span-6 min-[600px]:col-span-3" key={kpi.key}>
                <HeroKpiCard item={kpi} loading={false} />
              </div>
            ))}
          </div>

          {/* ─── Secondary KPIs (task status + top performer) ────── */}
          <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
            <div className="col-span-12 min-[900px]:col-span-6">
              <Card className={SECONDARY_CARD_CLASS}>
                <CardContent>
                  <p className={SECTION_LABEL_CLASS}>
                    {t('reports.kpi.taskStatus', 'Statut des taches')}
                  </p>
                  {([
                    { key: 'completed', title: t('reports.charts.completed'), value: `${kpis?.totalCompleted ?? 0}`, icon: <CheckCircle />, iconColor: 'var(--bui-success)' },
                    { key: 'inProgress', title: t('reports.charts.inProgress'), value: `${kpis?.totalInProgress ?? 0}`, icon: <Engineering />, iconColor: 'var(--bui-info)' },
                    { key: 'pending', title: t('reports.charts.pending'), value: `${kpis?.totalPending ?? 0}`, icon: <HourglassEmpty />, iconColor: 'var(--bui-warning)' },
                  ] as KpiItem[]).map((kpi, i) => (
                    <React.Fragment key={kpi.key}>
                      {i > 0 && <div className="border-t border-border" />}
                      <SecondaryKpiRow item={kpi} loading={false} />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <Card className={SECONDARY_CARD_CLASS}>
                <CardContent>
                  <p className={SECTION_LABEL_CLASS}>
                    {t('reports.kpi.topPerformer', 'Meilleure equipe')}
                  </p>
                  {kpis?.topPerformer ? (
                    <div className="py-2 text-center">
                      <p className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-[-0.015em] text-primary mb-0.5">
                        {kpis.topPerformer.name}
                      </p>
                      <p className="text-[11.5px] text-muted-foreground tabular-nums">
                        {kpis.topPerformer.completed} {t('reports.charts.completed').toLowerCase()}
                        {' / '}
                        {kpis.topPerformer.completed + kpis.topPerformer.inProgress + kpis.topPerformer.pending} {t('reports.kpi.totalTasks', 'total').toLowerCase()}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-faint text-center py-3">
                      {t('reports.charts.noData')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ─── Charts: Stacked performance + Completion rates ──── */}
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12 min-[900px]:col-span-7">
              <ChartCard title={t('reports.charts.teamPerformance')}>
                {data.teamPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data.teamPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                      <XAxis dataKey="name" tick={axisTick(ct)} angle={-20} textAnchor="end" height={55} />
                      <YAxis allowDecimals={false} tick={axisTick(ct)} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={9} formatter={renderChartLegendText} />
                      <Bar dataKey="completed" name={t('reports.charts.completed')} fill={ct.ok} stackId="stack" />
                      <Bar dataKey="inProgress" name={t('reports.charts.inProgress')} fill={ct.info} stackId="stack" />
                      <Bar dataKey="pending" name={t('reports.charts.pending')} fill={ct.warn} stackId="stack" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
            <div className="col-span-12 min-[900px]:col-span-5">
              <ChartCard title={t('reports.kpi.completionRateByTeam', 'Taux de completion par equipe')}>
                {teamCompletionRates.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={teamCompletionRates} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                      <XAxis type="number" domain={[0, 100]} tick={axisTick(ct)} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={axisTick(ct)} width={90} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="completionRate" name={t('reports.kpi.completionRate', 'Completion')} radius={[0, 4, 4, 0]}>
                        {teamCompletionRates.map((entry) => (
                          <Cell key={`cr-${entry.name}`} fill={entry.completionRate >= 70 ? ct.ok : entry.completionRate >= 40 ? ct.warn : ct.err} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
          </div>
        </div>
      ) : (
        <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
      )}
    </DataFetchWrapper>
  );
};

// ─── Report: Properties ─────────────────────────────────────────────────────

interface PeriodControlProps {
  period?: DashboardPeriod;
  onPeriodChange?: (period: DashboardPeriod) => void;
}

const PropertiesReport: React.FC<PeriodControlProps> = ({ period: periodProp, onPeriodChange }) => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();
  const ct = useChartTokens();
  const { data, loading, error, retry } = usePropertyReport();
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>('month');
  const period = periodProp ?? internalPeriod;
  const setPeriod = onPeriodChange ?? setInternalPeriod;
  const showInlineFilter = periodProp === undefined;

  const { analytics, loading: analyticsLoading } = useAnalyticsEngine({
    period,
    interventions: EMPTY_INTERVENTIONS,
  });

  // Compute KPIs from property data
  const kpis = useMemo(() => {
    if (!data || data.propertyStats.length === 0) return null;
    const stats = data.propertyStats;
    const totalProperties = stats.length;
    const totalInterventions = stats.reduce((s, p) => s + p.interventions, 0);
    const totalCost = stats.reduce((s, p) => s + p.cost, 0);
    const avgCostPerProperty = totalProperties > 0 ? Math.round(totalCost / totalProperties) : 0;
    const avgInterventionsPerProperty = totalProperties > 0 ? +(totalInterventions / totalProperties).toFixed(1) : 0;
    const topProperty = [...stats].sort((a, b) => b.interventions - a.interventions)[0];
    return { totalProperties, totalInterventions, totalCost, avgCostPerProperty, avgInterventionsPerProperty, topProperty };
  }, [data]);

  return (
    <>
      {showInlineFilter && (
        <div className="mb-3 flex justify-end">
          <PeriodSegmented<DashboardPeriod>
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            ariaLabel={t('reports.periodFilter', 'Période')}
          />
        </div>
      )}

      {/* ─── Hero KPIs from operational data ───────────────────── */}
      <DataFetchWrapper loading={loading} error={error} onRetry={retry} loadingMessage={t('reports.charts.loadingData')}>
        {data ? (
          <div>
            <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
              {([
                {
                  key: 'properties', title: t('reports.kpi.totalProperties', 'Proprietes'),
                  value: `${kpis?.totalProperties ?? 0}`, icon: <Apartment />, iconColor: 'var(--bui-primary)',
                },
                {
                  key: 'interventions', title: t('reports.kpi.totalInterventions', 'Interventions'),
                  value: `${kpis?.totalInterventions ?? 0}`, icon: <Build />, iconColor: 'var(--bui-info)',
                },
                {
                  key: 'cost', title: t('reports.kpi.totalCost', 'Cout total'),
                  value: convertAndFormat(kpis?.totalCost ?? 0, 'EUR'), icon: <AttachMoney />, iconColor: 'var(--bui-warning)',
                },
                {
                  key: 'avgCost', title: t('reports.kpi.avgCostPerProperty', 'Cout moy. / bien'),
                  value: convertAndFormat(kpis?.avgCostPerProperty ?? 0, 'EUR'), icon: <EuroIcon />, iconColor: 'var(--bui-success)',
                },
              ] as KpiItem[]).map((kpi) => (
                <div className="col-span-6 min-[600px]:col-span-3" key={kpi.key}>
                  <HeroKpiCard item={kpi} loading={false} />
                </div>
              ))}
            </div>

            {/* ─── Secondary KPIs ─── */}
            <div className="grid grid-cols-12 gap-[9px] mb-[15px]">
              <div className="col-span-12 min-[900px]:col-span-6">
                <Card className={SECONDARY_CARD_CLASS}>
                  <CardContent>
                    <p className={SECTION_LABEL_CLASS}>
                      {t('reports.kpi.operationalMetrics', 'Indicateurs operationnels')}
                    </p>
                    {([
                      { key: 'avgInt', title: t('reports.kpi.avgInterventions', 'Moy. interventions / bien'), value: `${kpis?.avgInterventionsPerProperty ?? 0}`, icon: <Speed />, iconColor: 'var(--bui-info)' },
                      { key: 'topProp', title: t('reports.kpi.mostActive', 'Bien le plus actif'), value: kpis?.topProperty?.name ?? '-', icon: <PriorityHigh />, iconColor: 'var(--bui-destructive)' },
                    ] as KpiItem[]).map((kpi, i) => (
                      <React.Fragment key={kpi.key}>
                        {i > 0 && <div className="border-t border-border" />}
                        <SecondaryKpiRow item={kpi} loading={false} />
                      </React.Fragment>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ─── Chart: Interventions + cost per property ─────── */}
            <div className="grid grid-cols-12 gap-[9px] mb-[18px]">
              <div className="col-span-12">
                <ChartCard title={t('reports.charts.interventionsPerProperty')}>
                  {data.propertyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={data.propertyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                        <XAxis dataKey="name" tick={axisTick(ct)} angle={-25} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" allowDecimals={false} tick={axisTick(ct)} />
                        <YAxis yAxisId="right" orientation="right" tick={axisTick(ct)} tickFormatter={(value: number) => convertAndFormat(value, 'EUR')} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={9} formatter={renderChartLegendText} />
                        <Bar yAxisId="left" dataKey="interventions" name={t('reports.charts.interventions')} fill={ct.accent} radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="cost" name={t('reports.charts.cost')} fill={ct.warn} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState message={t('reports.charts.noData')} />
                  )}
                </ChartCard>
              </div>
            </div>
          </div>
        ) : (
          <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
        )}
      </DataFetchWrapper>

      {/* ─── Analytics widgets ─── */}
      <Separator className="my-[15px]" />
      <p className={cn(SECTION_LABEL_CLASS, 'mb-3')}>
        {t('reports.charts.analyticsInsights', 'Analyses avancees')}
      </p>

      <div className="grid grid-cols-12 gap-[9px] mb-3">
        <div className="col-span-12 min-[900px]:col-span-6">
          <DashboardErrorBoundary widgetName="Occupation">
            <AnalyticsOccupancy data={analytics?.occupancy ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </div>
        <div className="col-span-12 min-[900px]:col-span-6">
          <DashboardErrorBoundary widgetName="Analyse Clientele">
            <AnalyticsClientAnalysis data={analytics?.clients ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-[9px]">
        <div className="col-span-12 min-[900px]:col-span-6">
          <DashboardErrorBoundary widgetName="Performance par Logement">
            <AnalyticsPropertyPerformance period={period} />
          </DashboardErrorBoundary>
        </div>
        <div className="col-span-12 min-[900px]:col-span-6">
          <DashboardErrorBoundary widgetName="Benchmark">
            <AnalyticsBenchmark data={analytics?.benchmark ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </div>
      </div>
    </>
  );
};

// ─── Report: Financial ──────────────────────────────────────────────────────

const FinancialReport: React.FC<PeriodControlProps> = ({ period: periodProp, onPeriodChange }) => {
  const { t } = useTranslation();
  const { convertAndFormat } = useCurrency();
  const ct = useChartTokens();
  const { data, loading, error, retry } = useFinancialReport();
  const [internalPeriod, setInternalPeriod] = useState<DashboardPeriod>('month');
  const period = periodProp ?? internalPeriod;
  const setPeriod = onPeriodChange ?? setInternalPeriod;
  const showInlineFilter = periodProp === undefined;

  const { analytics, loading: analyticsLoading } = useAnalyticsEngine({
    period,
    interventions: EMPTY_INTERVENTIONS,
  });

  return (
    <>
      {showInlineFilter && (
        <div className="mb-3 flex justify-end">
          <PeriodSegmented<DashboardPeriod>
            value={period}
            onChange={setPeriod}
            options={PERIOD_OPTIONS}
            ariaLabel={t('reports.periodFilter', 'Période')}
          />
        </div>
      )}

      {/* ─── Vue d'ensemble — KPIs globaux ─── */}
      <DashboardErrorBoundary widgetName="Performance Globale">
        <AnalyticsGlobalPerformance data={analytics?.global ?? null} loading={analyticsLoading} />
      </DashboardErrorBoundary>

      {/* ─── Alerts & Recommendations side by side ─── */}
      <div className="grid grid-cols-12 gap-[9px] mb-3">
        <div className="col-span-12 min-[900px]:col-span-6">
          <DashboardErrorBoundary widgetName="Alertes Business">
            <AnalyticsAlerts data={analytics?.alerts ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </div>
        <div className="col-span-12 min-[900px]:col-span-6">
          <DashboardErrorBoundary widgetName="Recommandations">
            <AnalyticsRecommendations data={analytics?.recommendations ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </div>
      </div>

      {/* ─── Revenue & tarifs ─── */}
      <DashboardErrorBoundary widgetName="Revenus">
        <AnalyticsRevenue data={analytics?.revenue ?? null} loading={analyticsLoading} />
      </DashboardErrorBoundary>

      {/* ─── Pricing + Forecasts combined: 3 charts + 6 KPIs ─── */}
      <div className="mb-3">
        <p className={cn(SECTION_LABEL_CLASS, 'mb-[9px]')}>
          {t('reports.charts.pricingAndForecasts', 'Tarifs & Prévisions')}
        </p>
        <div className="grid grid-cols-12 gap-[9px]">
          {/* Left: 3 charts on same line */}
          <div className="col-span-12 min-[900px]:col-span-8">
            <div className="grid grid-cols-12 gap-[9px]">
              {/* Chart 1: Prix Moyen vs RevPAN */}
              <div className="col-span-12 min-[600px]:col-span-4">
                <Card className={MINI_CHART_CARD_CLASS}>
                  <CardContent className={MINI_CHART_CONTENT_CLASS}>
                    <p className={MINI_CHART_LABEL_CLASS}>
                      {t('dashboard.analytics.priceVsRevPAN')}
                    </p>
                    {analyticsLoading || !analytics?.pricing ? (
                      <Skeleton className="flex-1 rounded-md" />
                    ) : (
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.pricing.avgPriceVsRevPAN} margin={MINI_CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                            <XAxis dataKey="month" tick={axisTick(ct)} />
                            <YAxis tick={axisTick(ct)} />
                            <Tooltip contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} formatter={(v) => convertAndFormat(Number(v), 'EUR')} />
                            <Line type="monotone" dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} stroke={ct.accent} strokeWidth={1.5} dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="revPAN" name="RevPAN" stroke={ct.info} strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 3" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Chart 2: Prix par Type */}
              <div className="col-span-12 min-[600px]:col-span-4">
                <Card className={MINI_CHART_CARD_CLASS}>
                  <CardContent className={MINI_CHART_CONTENT_CLASS}>
                    <p className={MINI_CHART_LABEL_CLASS}>
                      {t('dashboard.analytics.priceByType')}
                    </p>
                    {analyticsLoading || !analytics?.pricing ? (
                      <Skeleton className="flex-1 rounded-md" />
                    ) : (
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.pricing.byPropertyType} margin={MINI_CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                            <XAxis dataKey="type" tick={axisTick(ct)} />
                            <YAxis tick={axisTick(ct)} />
                            <Tooltip contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} formatter={(v) => convertAndFormat(Number(v), 'EUR')} />
                            <Bar dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} fill={ct.accent} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Chart 3: Projection des Revenus */}
              <div className="col-span-12 min-[600px]:col-span-4">
                <Card className={MINI_CHART_CARD_CLASS}>
                  <CardContent className={MINI_CHART_CONTENT_CLASS}>
                    <p className={MINI_CHART_LABEL_CLASS}>
                      {t('dashboard.analytics.forecastChart')}
                    </p>
                    {analyticsLoading || !analytics?.forecast ? (
                      <Skeleton className="flex-1 rounded-md" />
                    ) : (
                      <div className="flex-1 min-h-0">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={analytics.forecast.chartData} margin={MINI_CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                            <XAxis dataKey="month" tick={axisTick(ct)} />
                            <YAxis tick={axisTick(ct)} />
                            <Tooltip contentStyle={CHART_TOOLTIP_CONTENT_STYLE} labelStyle={CHART_TOOLTIP_LABEL_STYLE} itemStyle={CHART_TOOLTIP_ITEM_STYLE} formatter={(v) => convertAndFormat(Number(v), 'EUR')} />
                            <Area type="monotone" dataKey="upper" stroke="none" fill={ct.info} fillOpacity={0.08} />
                            {/* Masque de la bande basse : surface carte (jamais de blanc pur — dark ok) */}
                            <Area type="monotone" dataKey="lower" stroke="none" fill={ct.card} fillOpacity={1} />
                            <Line type="monotone" dataKey="actual" name={t('dashboard.analytics.actual')} stroke={ct.accent} strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="forecast" name={t('dashboard.analytics.forecastLabel')} stroke={ct.info} strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 2 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Scenarios below charts */}
            {analytics?.forecast && !analyticsLoading && (
              <Card className="w-full mt-[9px] [--card-spacing:7.5px]">
                <CardContent>
                  <p className={MINI_CHART_LABEL_CLASS}>
                    {t('dashboard.analytics.scenarios')}
                  </p>
                  <div className="flex gap-4 mt-0.5">
                    {[analytics.forecast.scenarios.optimistic, analytics.forecast.scenarios.realistic, analytics.forecast.scenarios.pessimistic].map((s, i) => {
                      // Réf. SCEN (widget-board) : optimiste --ok, réaliste --info, pessimiste --warn
                      const colors = ['var(--bui-success)', 'var(--bui-info)', 'var(--bui-warning)'];
                      return (
                        <div className="flex items-center gap-1" key={s.label}>
                          <div className="w-[9px] h-[9px] rounded-[3px] shrink-0" style={{ backgroundColor: colors[i] }} />
                          <div>
                            <p className="text-[11.5px] font-semibold text-foreground leading-[1.2]">
                              {s.label}
                            </p>
                            <p className="text-2xs text-muted-foreground tabular-nums">
                              <Money value={s.revenue} from="EUR" /> &bull; {s.occupancy}% occ.
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right: 6 KPIs in 2 columns of 3 */}
          <div className="col-span-12 min-[900px]:col-span-4">
            <div className="grid grid-cols-12 gap-[9px]">
              <div className="col-span-6">
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecast30d')}
                  value={analytics?.forecast ? convertAndFormat(analytics.forecast.revenue30d, 'EUR') : '-'}
                  subtitle={t('dashboard.analytics.next30days')}
                  icon={<Timeline color="primary" />}
                  loading={analyticsLoading}
                />
              </div>
              <div className="col-span-6">
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.optimalPrice')}
                  value={analytics?.pricing ? convertAndFormat(analytics.pricing.optimalPrice, 'EUR') : '-'}
                  subtitle={t('dashboard.analytics.optimalPriceDesc')}
                  icon={<PriceChange color="success" />}
                  loading={analyticsLoading}
                />
              </div>
              <div className="col-span-6">
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecast90d')}
                  value={analytics?.forecast ? convertAndFormat(analytics.forecast.revenue90d, 'EUR') : '-'}
                  subtitle={t('dashboard.analytics.next90days')}
                  icon={<Timeline color="info" />}
                  loading={analyticsLoading}
                />
              </div>
              <div className="col-span-6">
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.elasticity')}
                  value={analytics?.pricing ? `${analytics.pricing.elasticity.toFixed(2)}` : '-'}
                  subtitle={t('dashboard.analytics.elasticityDesc')}
                  icon={<TuneOutlined color="info" />}
                  loading={analyticsLoading}
                />
              </div>
              <div className="col-span-6">
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecast365d')}
                  value={analytics?.forecast ? convertAndFormat(analytics.forecast.revenue365d, 'EUR') : '-'}
                  subtitle={t('dashboard.analytics.next365days')}
                  icon={<Timeline color="success" />}
                  loading={analyticsLoading}
                />
              </div>
              <div className="col-span-6">
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecastOccupancy', 'Occupation prévisionnelle')}
                  value={analytics?.forecast ? `${analytics.forecast.occupancy30d}%` : '-'}
                  subtitle={t('dashboard.analytics.next30days')}
                  icon={<Hotel color="warning" />}
                  loading={analyticsLoading}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Donnees operationnelles ─── */}
      <Separator className="my-[15px]" />
      <p className={cn(SECTION_LABEL_CLASS, 'mb-3')}>
        {t('reports.charts.operationalData', 'Donnees operationnelles')}
      </p>

      <DataFetchWrapper
        loading={loading}
        error={error}
        onRetry={retry}
        loadingMessage={t('reports.charts.loadingData')}
      >
        {data ? (
          <div className="grid grid-cols-12 gap-[9px]">
            <div className="col-span-12 min-[900px]:col-span-6">
              <ChartCard title={t('reports.charts.revenueByMonth')}>
                {data.monthlyFinancials.some((m) => m.revenue > 0 || m.expenses > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.monthlyFinancials}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ct.ok} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={ct.ok} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ct.err} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={ct.err} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                      <XAxis dataKey="month" tick={axisTick(ct)} />
                      <YAxis tick={axisTick(ct)} tickFormatter={(value: number) => convertAndFormat(value, 'EUR')} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={9} formatter={renderChartLegendText} />
                      <Area type="monotone" dataKey="revenue" name={t('reports.charts.revenue')} stroke={ct.ok} strokeWidth={2} fill="url(#gradRevenue)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="expenses" name={t('reports.charts.expenses')} stroke={ct.err} strokeWidth={2} fill="url(#gradExpenses)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="profit" name={t('reports.charts.profit')} stroke={ct.accent} strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
            <div className="col-span-12 min-[900px]:col-span-6">
              <ChartCard title={t('reports.charts.costBreakdown')}>
                {data.costBreakdown.length > 0 && data.costBreakdown.some((c) => c.value > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.costBreakdown} cx="50%" cy="50%"
                        innerRadius={55} outerRadius={90} paddingAngle={3}
                        dataKey="value" nameKey="name"
                        label={({ name, percent }: { name?: string; percent?: number }) =>
                          `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`
                        }
                        labelLine={true}
                      >
                        {data.costBreakdown.map((entry, index) => (
                          <Cell key={`cost-${entry.name}`} fill={entry.color || ct.series[index % ct.series.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} iconType="square" iconSize={9} formatter={renderChartLegendText} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </div>
          </div>
        ) : (
          <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
        )}
      </DataFetchWrapper>
    </>
  );
};

// ─── Report Type Configuration ──────────────────────────────────────────────

interface ReportTypeConfig {
  title: string;
  icon: React.ReactNode;
  permission: string;
  component: React.FC;
}

// ─── Main Component ─────────────────────────────────────────────────────────

const ReportDetails: React.FC = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user, hasPermissionAsync, loading: authLoading } = useAuth();
  const { t } = useTranslation();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [permissionChecked, setPermissionChecked] = useState(false);

  const reportTypes: Record<string, ReportTypeConfig> = {
    financial: {
      title: t('reports.sections.financial.title'),
      icon: <EuroIcon color="primary" />,
      permission: 'reports:view',
      component: FinancialReport,
    },
    interventions: {
      title: t('reports.sections.interventions.title'),
      icon: <ScheduleIcon color="success" />,
      permission: 'reports:view',
      component: InterventionsReport,
    },
    teams: {
      title: t('reports.sections.teams.title'),
      icon: <PeopleIcon color="info" />,
      permission: 'teams:view',
      component: TeamsReport,
    },
    properties: {
      title: t('reports.sections.properties.title'),
      icon: <HomeIcon color="warning" />,
      permission: 'reports:view',
      component: PropertiesReport,
    },
  };

  const currentReportType = type ? reportTypes[type] : undefined;

  useEffect(() => {
    if (authLoading || !user) return;

    if (!currentReportType) {
      setPermissionError(t('reports.invalidType'));
      setPermissionChecked(true);
      return;
    }

    const checkPermission = async () => {
      if (!user) {
        setPermissionError(t('reports.noPermission'));
        setPermissionChecked(true);
        return;
      }

      try {
        const hasPermission = await hasPermissionAsync(currentReportType.permission);
        if (!hasPermission) {
          setPermissionError(t('reports.noPermission'));
        } else {
          setPermissionError(null);
        }
      } catch {
        setPermissionError(t('reports.noPermission'));
      } finally {
        setPermissionChecked(true);
      }
    };

    checkPermission();
  }, [type, currentReportType, hasPermissionAsync, t, user, authLoading]);

  // Invalid type
  if (!currentReportType) {
    return (
      <div>
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{t('reports.invalidType')}</AlertDescription>
        </Alert>
        <PageHeader
          title={t('reports.title')}
          subtitle=""
          backPath="/reports"
          showBackButton={true}
        />
      </div>
    );
  }

  // Auth loading
  if (authLoading || !permissionChecked) {
    return (
      <div>
        <PageHeader
          title={currentReportType.title}
          subtitle={t('reports.sections.' + type + '.description')}
          backPath="/reports"
          showBackButton={true}
        />
        <div className="flex justify-center p-6">
          <Spinner className="size-10" />
        </div>
      </div>
    );
  }

  // Permission error
  if (permissionError) {
    return (
      <div>
        <PageHeader
          title={currentReportType.title}
          subtitle={t('reports.sections.' + type + '.description')}
          backPath="/reports"
          showBackButton={true}
        />
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>{permissionError}</AlertDescription>
        </Alert>
        <div className="text-center p-6">
          <p className="text-sm text-muted-foreground">
            {t('reports.noPermissionMessage')}
          </p>
        </div>
      </div>
    );
  }

  // Render the report charts
  const ReportComponent = currentReportType.component;

  return (
    <div>
      <PageHeader
        title={currentReportType.title}
        subtitle={t('reports.sections.' + type + '.description')}
        backPath="/reports"
        showBackButton={true}
      />
      <ReportComponent />
    </div>
  );
};

export default ReportDetails;

// Named exports for tab-based rendering in Reports.tsx
export { FinancialReport, InterventionsReport, TeamsReport, PropertiesReport };
