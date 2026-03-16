import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Skeleton,
  Divider,
} from '@mui/material';
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
} from '@mui/icons-material';
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
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { useAnalyticsEngine } from '../../hooks/useAnalyticsEngine';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import DashboardDateFilter from '../dashboard/DashboardDateFilter';
import DashboardErrorBoundary from '../dashboard/DashboardErrorBoundary';
import {
  AnalyticsGlobalPerformance,
  AnalyticsRevenue,
  AnalyticsAlerts,
  AnalyticsRecommendations,
  AnalyticsOccupancy,
  AnalyticsClientAnalysis,
  AnalyticsPropertyPerformance,
  AnalyticsBenchmark,
} from '../dashboard/analytics';
import AnalyticsWidgetCard from '../dashboard/analytics/AnalyticsWidgetCard';
import type { DashboardPeriod, DateFilterOption } from '../dashboard/DashboardDateFilter';
import {
  useInterventionReport,
  usePropertyReport,
  useTeamReport,
  useFinancialReport,
} from './hooks/useReportData';

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = ['#4A9B8E', '#6B8A9A', '#D4A574', '#C97A7A', '#7B68A8', '#5BA4CF', '#795548', '#607d8b'];

const PERIOD_OPTIONS: DateFilterOption<DashboardPeriod>[] = [
  { value: 'week', label: '7j' },
  { value: 'month', label: '30j' },
  { value: 'quarter', label: '90j' },
  { value: 'year', label: '1 an' },
];

const EMPTY_INTERVENTIONS: Array<{ estimatedCost?: number; actualCost?: number; type: string; status: string; scheduledDate?: string; createdAt?: string }> = [];

// ─── Mini chart constants (Pricing + Forecasts combined section) ────────────
const MINI_AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
const MINI_TOOLTIP_STYLE = { fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0', boxShadow: 'none' } as const;
const MINI_GRID_STROKE = '#F1F5F9';
const MINI_CHART_CARD_SX = { width: '100%', height: 220 } as const;
const MINI_CHART_CONTENT_SX = { p: 1.25, height: '100%', display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.25 } } as const;
const MINI_CHART_LABEL_SX = { fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.04em', color: 'text.secondary', mb: 0.5, flexShrink: 0 } as const;
const MINI_CHART_MARGIN = { top: 4, right: 6, left: -18, bottom: 4 } as const;

// ─── Shared sx constants ────────────────────────────────────────────────────

const HERO_CARD_SX = {
  height: '100%',
  transition: 'border-color 0.2s ease, transform 0.2s ease',
  '&:hover': { borderColor: 'primary.main', transform: 'translateY(-2px)' },
} as const;

const SECONDARY_CARD_SX = {
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const SECTION_LABEL_SX = {
  fontSize: '0.6875rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'text.disabled',
  mb: 1,
} as const;

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
  const color = isUp ? 'success.main' : isDown ? 'error.main' : 'text.disabled';
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}>
      <Icon sx={{ fontSize: 12, color }} />
      <Typography sx={{ fontSize: '0.625rem', fontWeight: 600, color, fontVariantNumeric: 'tabular-nums' }}>
        {isUp ? '+' : ''}{value}%
      </Typography>
    </Box>
  );
};

const HeroKpiCard: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <Card sx={HERO_CARD_SX}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      {loading ? (
        <Box>
          <Skeleton variant="text" width="50%" height={14} />
          <Skeleton variant="text" width="70%" height={28} sx={{ mt: 0.5 }} />
          <Skeleton variant="text" width="40%" height={12} sx={{ mt: 0.5 }} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.75 }}>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 32, height: 32, borderRadius: 1,
                bgcolor: `${item.iconColor}12`,
                '& .MuiSvgIcon-root': { fontSize: 18, color: item.iconColor },
              }}
            >
              {item.icon}
            </Box>
            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.secondary', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
              {item.title}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </Typography>
          {item.subtitle && (
            <Typography sx={{ fontSize: '0.5625rem', color: 'text.disabled', mt: 0.25, lineHeight: 1.2 }}>
              {item.subtitle}
            </Typography>
          )}
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </CardContent>
  </Card>
);

const SecondaryKpiRow: React.FC<{ item: KpiItem; loading: boolean }> = ({ item, loading }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 0.5 }}>
    <Box
      sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 28, height: 28, borderRadius: 0.75, flexShrink: 0,
        bgcolor: `${item.iconColor}10`,
        '& .MuiSvgIcon-root': { fontSize: 15, color: item.iconColor },
      }}
    >
      {item.icon}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', fontWeight: 500, lineHeight: 1.2 }}>
        {item.title}
      </Typography>
    </Box>
    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
      {loading ? (
        <Skeleton variant="text" width={48} height={18} />
      ) : (
        <>
          <Typography sx={{ fontSize: '0.875rem', fontWeight: 700, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' }}>
            {item.value}
          </Typography>
          {item.trend !== undefined && <TrendBadge value={item.trend} />}
        </>
      )}
    </Box>
  </Box>
);

// ─── Custom Tooltip ─────────────────────────────────────────────────────────

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color?: string; dataKey?: string }>;
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <Paper sx={{ p: 1.5, boxShadow: 3 }}>
      {label && (
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, fontSize: '0.8125rem' }}>
          {label}
        </Typography>
      )}
      {payload.map((entry, index) => (
        <Typography
          key={index}
          variant="caption"
          sx={{ display: 'block', color: entry.color, fontSize: '0.75rem' }}
        >
          {entry.name}: {entry.value}
        </Typography>
      ))}
    </Paper>
  );
};

// ─── Chart Card Wrapper ─────────────────────────────────────────────────────

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

const ChartCard: React.FC<ChartCardProps> = ({ title, children }) => (
  <Card sx={{ height: '100%', transition: 'border-color 0.15s ease', '&:hover': { borderColor: 'text.secondary' } }}>
    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, mb: 2, color: 'text.primary' }}>
        {title}
      </Typography>
      {children}
    </CardContent>
  </Card>
);

// ─── Empty State ────────────────────────────────────────────────────────────

interface EmptyChartStateProps {
  message: string;
  description?: string;
}

const EmptyChartState: React.FC<EmptyChartStateProps> = ({ message, description }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
    <BarChartIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '0.875rem' }}>
      {message}
    </Typography>
    {description && (
      <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.75rem', mt: 0.5 }}>
        {description}
      </Typography>
    )}
  </Box>
);

// ─── Report: Interventions ──────────────────────────────────────────────────

const InterventionsReport: React.FC = () => {
  const { t } = useTranslation();
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
        <Box>
          {/* ─── Hero KPIs ───────────────────────────────────────── */}
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            {([
              {
                key: 'total', title: t('reports.kpi.totalInterventions', 'Total interventions'),
                value: `${kpis?.totalInterventions ?? 0}`, icon: <Build />, iconColor: '#4A9B8E',
                trend: kpis?.monthTrend,
              },
              {
                key: 'completion', title: t('reports.kpi.completionRate', 'Taux de completion'),
                value: `${kpis?.completionRate ?? 0}%`, icon: <CheckCircle />, iconColor: '#4A9B8E',
              },
              {
                key: 'pending', title: t('reports.kpi.pending', 'En attente'),
                value: `${kpis?.pending ?? 0}`, icon: <HourglassEmpty />, iconColor: '#D4A574',
              },
              {
                key: 'avgMonth', title: t('reports.kpi.avgPerMonth', 'Moy. / mois'),
                value: `${kpis?.avgPerMonth ?? 0}`, icon: <Speed />, iconColor: '#6B8A9A',
              },
            ] as KpiItem[]).map((kpi) => (
              <Grid item xs={6} sm={3} key={kpi.key}>
                <HeroKpiCard item={kpi} loading={false} />
              </Grid>
            ))}
          </Grid>

          {/* ─── Secondary KPIs (status breakdown + type breakdown) ── */}
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            <Grid item xs={12} md={6}>
              <Card sx={SECONDARY_CARD_SX}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography sx={SECTION_LABEL_SX}>
                    {t('reports.kpi.statusBreakdown', 'Repartition par statut')}
                  </Typography>
                  {data.byStatus.map((item, i) => (
                    <React.Fragment key={item.name}>
                      {i > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                      <SecondaryKpiRow
                        item={{
                          key: item.name, title: item.name, value: `${item.value}`,
                          icon: <AssignmentTurnedIn />, iconColor: item.color || CHART_COLORS[i % CHART_COLORS.length],
                        }}
                        loading={false}
                      />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={SECONDARY_CARD_SX}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography sx={SECTION_LABEL_SX}>
                    {t('reports.kpi.typeBreakdown', 'Repartition par type')}
                  </Typography>
                  {data.byType.map((item, i) => (
                    <React.Fragment key={item.name}>
                      {i > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                      <SecondaryKpiRow
                        item={{
                          key: item.name, title: item.name, value: `${item.value}`,
                          icon: <Category />, iconColor: item.color || CHART_COLORS[i % CHART_COLORS.length],
                        }}
                        loading={false}
                      />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ─── Charts: Status pie + Type bar side by side ─────── */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={12} md={6}>
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
                          <Cell key={`status-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={6}>
              <ChartCard title={t('reports.charts.interventionsByType')}>
                {data.byType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={data.byType}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t('reports.charts.interventions')} radius={[4, 4, 0, 0]}>
                        {data.byType.map((entry, index) => (
                          <Cell key={`type-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── Chart: Monthly trend (full width area chart) ───── */}
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid item xs={12}>
              <ChartCard title={t('reports.charts.interventionsByMonth')}>
                {data.byMonth.some((m) => m.total > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.byMonth}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4A9B8E" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#4A9B8E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6B8A9A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#6B8A9A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                      <Area type="monotone" dataKey="total" name={t('reports.charts.total')} stroke="#4A9B8E" strokeWidth={2} fill="url(#gradTotal)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="completed" name={t('reports.charts.completed')} stroke="#6B8A9A" strokeWidth={2} fill="url(#gradCompleted)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="pending" name={t('reports.charts.pending')} stroke="#D4A574" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
          </Grid>

          {/* ─── Chart: Priority (horizontal bar) ───────────────── */}
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <ChartCard title={t('reports.charts.interventionsByPriority')}>
                {data.byPriority.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.byPriority} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="value" name={t('reports.charts.interventions')} radius={[0, 4, 4, 0]}>
                        {data.byPriority.map((entry, index) => (
                          <Cell key={`priority-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
      )}
    </DataFetchWrapper>
  );
};

// ─── Report: Teams ──────────────────────────────────────────────────────────

const TeamsReport: React.FC = () => {
  const { t } = useTranslation();
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
        <Box>
          {/* ─── Hero KPIs ───────────────────────────────────────── */}
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            {([
              {
                key: 'teams', title: t('reports.kpi.totalTeams', 'Equipes'),
                value: `${kpis?.totalTeams ?? 0}`, icon: <Groups />, iconColor: '#4A9B8E',
              },
              {
                key: 'tasks', title: t('reports.kpi.totalTasks', 'Total taches'),
                value: `${kpis?.totalTasks ?? 0}`, icon: <TaskAlt />, iconColor: '#6B8A9A',
              },
              {
                key: 'rate', title: t('reports.kpi.completionRate', 'Taux de completion'),
                value: `${kpis?.completionRate ?? 0}%`, icon: <Percent />, iconColor: '#4A9B8E',
              },
              {
                key: 'avg', title: t('reports.kpi.avgTasksPerTeam', 'Moy. taches / equipe'),
                value: `${kpis?.avgTasksPerTeam ?? 0}`, icon: <Speed />, iconColor: '#7B68A8',
              },
            ] as KpiItem[]).map((kpi) => (
              <Grid item xs={6} sm={3} key={kpi.key}>
                <HeroKpiCard item={kpi} loading={false} />
              </Grid>
            ))}
          </Grid>

          {/* ─── Secondary KPIs (task status + top performer) ────── */}
          <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
            <Grid item xs={12} md={6}>
              <Card sx={SECONDARY_CARD_SX}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography sx={SECTION_LABEL_SX}>
                    {t('reports.kpi.taskStatus', 'Statut des taches')}
                  </Typography>
                  {([
                    { key: 'completed', title: t('reports.charts.completed'), value: `${kpis?.totalCompleted ?? 0}`, icon: <CheckCircle />, iconColor: '#4A9B8E' },
                    { key: 'inProgress', title: t('reports.charts.inProgress'), value: `${kpis?.totalInProgress ?? 0}`, icon: <Engineering />, iconColor: '#6B8A9A' },
                    { key: 'pending', title: t('reports.charts.pending'), value: `${kpis?.totalPending ?? 0}`, icon: <HourglassEmpty />, iconColor: '#D4A574' },
                  ] as KpiItem[]).map((kpi, i) => (
                    <React.Fragment key={kpi.key}>
                      {i > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                      <SecondaryKpiRow item={kpi} loading={false} />
                    </React.Fragment>
                  ))}
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card sx={SECONDARY_CARD_SX}>
                <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Typography sx={SECTION_LABEL_SX}>
                    {t('reports.kpi.topPerformer', 'Meilleure equipe')}
                  </Typography>
                  {kpis?.topPerformer ? (
                    <Box sx={{ py: 1.5, textAlign: 'center' }}>
                      <Typography sx={{ fontSize: '1.25rem', fontWeight: 800, color: '#4A9B8E', mb: 0.5 }}>
                        {kpis.topPerformer.name}
                      </Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                        {kpis.topPerformer.completed} {t('reports.charts.completed').toLowerCase()}
                        {' / '}
                        {kpis.topPerformer.completed + kpis.topPerformer.inProgress + kpis.topPerformer.pending} {t('reports.kpi.totalTasks', 'total').toLowerCase()}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography sx={{ fontSize: '0.75rem', color: 'text.disabled', textAlign: 'center', py: 2 }}>
                      {t('reports.charts.noData')}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* ─── Charts: Stacked performance + Completion rates ──── */}
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={7}>
              <ChartCard title={t('reports.charts.teamPerformance')}>
                {data.teamPerformance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={data.teamPerformance}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={55} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                      <Bar dataKey="completed" name={t('reports.charts.completed')} fill="#4A9B8E" stackId="stack" />
                      <Bar dataKey="inProgress" name={t('reports.charts.inProgress')} fill="#6B8A9A" stackId="stack" />
                      <Bar dataKey="pending" name={t('reports.charts.pending')} fill="#D4A574" stackId="stack" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={5}>
              <ChartCard title={t('reports.kpi.completionRateByTeam', 'Taux de completion par equipe')}>
                {teamCompletionRates.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={teamCompletionRates} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="completionRate" name={t('reports.kpi.completionRate', 'Completion')} radius={[0, 4, 4, 0]}>
                        {teamCompletionRates.map((entry, index) => (
                          <Cell key={`cr-${index}`} fill={entry.completionRate >= 70 ? '#4A9B8E' : entry.completionRate >= 40 ? '#D4A574' : '#C97A7A'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
          </Grid>
        </Box>
      ) : (
        <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
      )}
    </DataFetchWrapper>
  );
};

// ─── Report: Properties ─────────────────────────────────────────────────────

const PropertiesReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = usePropertyReport();
  const [period, setPeriod] = useState<DashboardPeriod>('month');

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
      {/* ─── Period filter ─── */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <DashboardDateFilter<DashboardPeriod>
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />
      </Box>

      {/* ─── Hero KPIs from operational data ───────────────────── */}
      <DataFetchWrapper loading={loading} error={error} onRetry={retry} loadingMessage={t('reports.charts.loadingData')}>
        {data ? (
          <Box>
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              {([
                {
                  key: 'properties', title: t('reports.kpi.totalProperties', 'Proprietes'),
                  value: `${kpis?.totalProperties ?? 0}`, icon: <Apartment />, iconColor: '#4A9B8E',
                },
                {
                  key: 'interventions', title: t('reports.kpi.totalInterventions', 'Interventions'),
                  value: `${kpis?.totalInterventions ?? 0}`, icon: <Build />, iconColor: '#6B8A9A',
                },
                {
                  key: 'cost', title: t('reports.kpi.totalCost', 'Cout total'),
                  value: `${(kpis?.totalCost ?? 0).toLocaleString('fr-FR')} €`, icon: <AttachMoney />, iconColor: '#D4A574',
                },
                {
                  key: 'avgCost', title: t('reports.kpi.avgCostPerProperty', 'Cout moy. / bien'),
                  value: `${(kpis?.avgCostPerProperty ?? 0).toLocaleString('fr-FR')} €`, icon: <EuroIcon />, iconColor: '#7B68A8',
                },
              ] as KpiItem[]).map((kpi) => (
                <Grid item xs={6} sm={3} key={kpi.key}>
                  <HeroKpiCard item={kpi} loading={false} />
                </Grid>
              ))}
            </Grid>

            {/* ─── Secondary KPIs ─── */}
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid item xs={12} md={6}>
                <Card sx={SECONDARY_CARD_SX}>
                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Typography sx={SECTION_LABEL_SX}>
                      {t('reports.kpi.operationalMetrics', 'Indicateurs operationnels')}
                    </Typography>
                    {([
                      { key: 'avgInt', title: t('reports.kpi.avgInterventions', 'Moy. interventions / bien'), value: `${kpis?.avgInterventionsPerProperty ?? 0}`, icon: <Speed />, iconColor: '#6B8A9A' },
                      { key: 'topProp', title: t('reports.kpi.mostActive', 'Bien le plus actif'), value: kpis?.topProperty?.name ?? '-', icon: <PriorityHigh />, iconColor: '#C97A7A' },
                    ] as KpiItem[]).map((kpi, i) => (
                      <React.Fragment key={kpi.key}>
                        {i > 0 && <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}
                        <SecondaryKpiRow item={kpi} loading={false} />
                      </React.Fragment>
                    ))}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* ─── Chart: Interventions + cost per property ─────── */}
            <Grid container spacing={1.5} sx={{ mb: 3 }}>
              <Grid item xs={12}>
                <ChartCard title={t('reports.charts.interventionsPerProperty')}>
                  {data.propertyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={data.propertyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={80} />
                        <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value}\u00A0€`} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="bottom" height={36} />
                        <Bar yAxisId="left" dataKey="interventions" name={t('reports.charts.interventions')} fill="#4A9B8E" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="cost" name={t('reports.charts.cost')} fill="#D4A574" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChartState message={t('reports.charts.noData')} />
                  )}
                </ChartCard>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <EmptyChartState message={t('reports.charts.noData')} description={t('reports.charts.noDataDescription')} />
        )}
      </DataFetchWrapper>

      {/* ─── Analytics widgets ─── */}
      <Divider sx={{ my: 2.5 }} />
      <Typography sx={{ ...SECTION_LABEL_SX, mb: 2 }}>
        {t('reports.charts.analyticsInsights', 'Analyses avancees')}
      </Typography>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <DashboardErrorBoundary widgetName="Occupation">
            <AnalyticsOccupancy data={analytics?.occupancy ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardErrorBoundary widgetName="Analyse Clientele">
            <AnalyticsClientAnalysis data={analytics?.clients ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </Grid>
      </Grid>

      <Grid container spacing={1.5}>
        <Grid item xs={12} md={6}>
          <DashboardErrorBoundary widgetName="Performance par Logement">
            <AnalyticsPropertyPerformance data={analytics?.properties ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardErrorBoundary widgetName="Benchmark">
            <AnalyticsBenchmark data={analytics?.benchmark ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </Grid>
      </Grid>
    </>
  );
};

// ─── Report: Financial ──────────────────────────────────────────────────────

const FinancialReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useFinancialReport();
  const [period, setPeriod] = useState<DashboardPeriod>('month');

  const { analytics, loading: analyticsLoading } = useAnalyticsEngine({
    period,
    interventions: EMPTY_INTERVENTIONS,
  });

  return (
    <>
      {/* ─── Period filter ─── */}
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end' }}>
        <DashboardDateFilter<DashboardPeriod>
          value={period}
          onChange={setPeriod}
          options={PERIOD_OPTIONS}
        />
      </Box>

      {/* ─── Vue d'ensemble — KPIs globaux ─── */}
      <DashboardErrorBoundary widgetName="Performance Globale">
        <AnalyticsGlobalPerformance data={analytics?.global ?? null} loading={analyticsLoading} />
      </DashboardErrorBoundary>

      {/* ─── Alerts & Recommendations side by side ─── */}
      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <DashboardErrorBoundary widgetName="Alertes Business">
            <AnalyticsAlerts data={analytics?.alerts ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </Grid>
        <Grid item xs={12} md={6}>
          <DashboardErrorBoundary widgetName="Recommandations">
            <AnalyticsRecommendations data={analytics?.recommendations ?? null} loading={analyticsLoading} />
          </DashboardErrorBoundary>
        </Grid>
      </Grid>

      {/* ─── Revenue & tarifs ─── */}
      <DashboardErrorBoundary widgetName="Revenus">
        <AnalyticsRevenue data={analytics?.revenue ?? null} loading={analyticsLoading} />
      </DashboardErrorBoundary>

      {/* ─── Pricing + Forecasts combined: 3 charts + 6 KPIs ─── */}
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ ...SECTION_LABEL_SX, mb: 1.5 }}>
          {t('reports.charts.pricingAndForecasts', 'Tarifs & Prévisions')}
        </Typography>
        <Grid container spacing={1.5}>
          {/* Left: 3 charts on same line */}
          <Grid item xs={12} md={8}>
            <Grid container spacing={1.5}>
              {/* Chart 1: Prix Moyen vs RevPAN */}
              <Grid item xs={12} sm={4}>
                <Card sx={MINI_CHART_CARD_SX}>
                  <CardContent sx={MINI_CHART_CONTENT_SX}>
                    <Typography sx={MINI_CHART_LABEL_SX}>
                      {t('dashboard.analytics.priceVsRevPAN')}
                    </Typography>
                    {analyticsLoading || !analytics?.pricing ? (
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.disabled">...</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.pricing.avgPriceVsRevPAN} margin={MINI_CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke={MINI_GRID_STROKE} />
                            <XAxis dataKey="month" tick={MINI_AXIS_TICK} />
                            <YAxis tick={MINI_AXIS_TICK} />
                            <Tooltip contentStyle={MINI_TOOLTIP_STYLE} formatter={(v) => `${v} €`} />
                            <Line type="monotone" dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} stroke="#6B8A9A" strokeWidth={1.5} dot={{ r: 2 }} />
                            <Line type="monotone" dataKey="revPAN" name="RevPAN" stroke="#4A9B8E" strokeWidth={1.5} dot={{ r: 2 }} strokeDasharray="5 3" />
                          </LineChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Chart 2: Prix par Type */}
              <Grid item xs={12} sm={4}>
                <Card sx={MINI_CHART_CARD_SX}>
                  <CardContent sx={MINI_CHART_CONTENT_SX}>
                    <Typography sx={MINI_CHART_LABEL_SX}>
                      {t('dashboard.analytics.priceByType')}
                    </Typography>
                    {analyticsLoading || !analytics?.pricing ? (
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.disabled">...</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={analytics.pricing.byPropertyType} margin={MINI_CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke={MINI_GRID_STROKE} />
                            <XAxis dataKey="type" tick={MINI_AXIS_TICK} />
                            <YAxis tick={MINI_AXIS_TICK} />
                            <Tooltip contentStyle={MINI_TOOLTIP_STYLE} formatter={(v) => `${v} €`} />
                            <Bar dataKey="avgPrice" name={t('dashboard.analytics.avgPrice')} fill="#D4A574" radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              {/* Chart 3: Projection des Revenus */}
              <Grid item xs={12} sm={4}>
                <Card sx={MINI_CHART_CARD_SX}>
                  <CardContent sx={MINI_CHART_CONTENT_SX}>
                    <Typography sx={MINI_CHART_LABEL_SX}>
                      {t('dashboard.analytics.forecastChart')}
                    </Typography>
                    {analyticsLoading || !analytics?.forecast ? (
                      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption" color="text.disabled">...</Typography>
                      </Box>
                    ) : (
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={analytics.forecast.chartData} margin={MINI_CHART_MARGIN}>
                            <CartesianGrid strokeDasharray="3 3" stroke={MINI_GRID_STROKE} />
                            <XAxis dataKey="month" tick={MINI_AXIS_TICK} />
                            <YAxis tick={MINI_AXIS_TICK} />
                            <Tooltip contentStyle={MINI_TOOLTIP_STYLE} formatter={(v) => `${Number(v).toLocaleString('fr-FR')} €`} />
                            <Area type="monotone" dataKey="upper" stroke="none" fill="#6B8A9A" fillOpacity={0.08} />
                            <Area type="monotone" dataKey="lower" stroke="none" fill="#ffffff" fillOpacity={1} />
                            <Line type="monotone" dataKey="actual" name={t('dashboard.analytics.actual')} stroke="#6B8A9A" strokeWidth={2} dot={{ r: 3 }} />
                            <Line type="monotone" dataKey="forecast" name={t('dashboard.analytics.forecastLabel')} stroke="#4A9B8E" strokeWidth={1.5} strokeDasharray="6 3" dot={{ r: 2 }} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* Scenarios below charts */}
            {analytics?.forecast && !analyticsLoading && (
              <Card sx={{ width: '100%', mt: 1.5 }}>
                <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
                  <Typography sx={MINI_CHART_LABEL_SX}>
                    {t('dashboard.analytics.scenarios')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 3, mt: 0.5 }}>
                    {[analytics.forecast.scenarios.optimistic, analytics.forecast.scenarios.realistic, analytics.forecast.scenarios.pessimistic].map((s, i) => {
                      const colors = ['#4A9B8E', '#6B8A9A', '#C97A7A'];
                      return (
                        <Box key={s.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: colors[i], flexShrink: 0 }} />
                          <Box>
                            <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: 'text.primary', lineHeight: 1.2 }}>
                              {s.label}
                            </Typography>
                            <Typography sx={{ fontSize: '0.5625rem', color: 'text.secondary' }}>
                              {s.revenue.toLocaleString('fr-FR')} € &bull; {s.occupancy}% occ.
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </CardContent>
              </Card>
            )}
          </Grid>

          {/* Right: 6 KPIs in 2 columns of 3 */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={1.5}>
              <Grid item xs={6}>
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecast30d')}
                  value={analytics?.forecast ? `${analytics.forecast.revenue30d.toLocaleString('fr-FR')} €` : '-'}
                  subtitle={t('dashboard.analytics.next30days')}
                  icon={<Timeline color="primary" />}
                  loading={analyticsLoading}
                />
              </Grid>
              <Grid item xs={6}>
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.optimalPrice')}
                  value={analytics?.pricing ? `${analytics.pricing.optimalPrice} €` : '-'}
                  subtitle={t('dashboard.analytics.optimalPriceDesc')}
                  icon={<PriceChange color="success" />}
                  loading={analyticsLoading}
                />
              </Grid>
              <Grid item xs={6}>
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecast90d')}
                  value={analytics?.forecast ? `${analytics.forecast.revenue90d.toLocaleString('fr-FR')} €` : '-'}
                  subtitle={t('dashboard.analytics.next90days')}
                  icon={<Timeline color="info" />}
                  loading={analyticsLoading}
                />
              </Grid>
              <Grid item xs={6}>
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.elasticity')}
                  value={analytics?.pricing ? `${analytics.pricing.elasticity.toFixed(2)}` : '-'}
                  subtitle={t('dashboard.analytics.elasticityDesc')}
                  icon={<TuneOutlined color="info" />}
                  loading={analyticsLoading}
                />
              </Grid>
              <Grid item xs={6}>
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecast365d')}
                  value={analytics?.forecast ? `${analytics.forecast.revenue365d.toLocaleString('fr-FR')} €` : '-'}
                  subtitle={t('dashboard.analytics.next365days')}
                  icon={<Timeline color="success" />}
                  loading={analyticsLoading}
                />
              </Grid>
              <Grid item xs={6}>
                <AnalyticsWidgetCard
                  title={t('dashboard.analytics.forecastOccupancy', 'Occupation prévisionnelle')}
                  value={analytics?.forecast ? `${analytics.forecast.occupancy30d}%` : '-'}
                  subtitle={t('dashboard.analytics.next30days')}
                  icon={<Hotel color="warning" />}
                  loading={analyticsLoading}
                />
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Box>

      {/* ─── Donnees operationnelles ─── */}
      <Divider sx={{ my: 2.5 }} />
      <Typography sx={{ ...SECTION_LABEL_SX, mb: 2 }}>
        {t('reports.charts.operationalData', 'Donnees operationnelles')}
      </Typography>

      <DataFetchWrapper
        loading={loading}
        error={error}
        onRetry={retry}
        loadingMessage={t('reports.charts.loadingData')}
      >
        {data ? (
          <Grid container spacing={1.5}>
            <Grid item xs={12} md={6}>
              <ChartCard title={t('reports.charts.revenueByMonth')}>
                {data.monthlyFinancials.some((m) => m.revenue > 0 || m.expenses > 0) ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={data.monthlyFinancials}>
                      <defs>
                        <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4A9B8E" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#4A9B8E" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradExpenses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#C97A7A" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#C97A7A" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={(value: number) => `${value}\u00A0€`} />
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                      <Area type="monotone" dataKey="revenue" name={t('reports.charts.revenue')} stroke="#4A9B8E" strokeWidth={2} fill="url(#gradRevenue)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Area type="monotone" dataKey="expenses" name={t('reports.charts.expenses')} stroke="#C97A7A" strokeWidth={2} fill="url(#gradExpenses)" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="profit" name={t('reports.charts.profit')} stroke="#6B8A9A" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
            <Grid item xs={12} md={6}>
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
                          <Cell key={`cost-${index}`} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<CustomTooltip />} />
                      <Legend verticalAlign="bottom" height={36} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState message={t('reports.charts.noData')} />
                )}
              </ChartCard>
            </Grid>
          </Grid>
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
      <Box>
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('reports.invalidType')}
        </Alert>
        <PageHeader
          title={t('reports.title')}
          subtitle=""
          backPath="/reports"
          showBackButton={true}
        />
      </Box>
    );
  }

  // Auth loading
  if (authLoading || !permissionChecked) {
    return (
      <Box>
        <PageHeader
          title={currentReportType.title}
          subtitle={t('reports.sections.' + type + '.description')}
          backPath="/reports"
          showBackButton={true}
        />
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  // Permission error
  if (permissionError) {
    return (
      <Box>
        <PageHeader
          title={currentReportType.title}
          subtitle={t('reports.sections.' + type + '.description')}
          backPath="/reports"
          showBackButton={true}
        />
        <Alert severity="error" sx={{ mb: 2 }}>
          {permissionError}
        </Alert>
        <Box sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="body1" color="text.secondary">
            {t('reports.noPermissionMessage')}
          </Typography>
        </Box>
      </Box>
    );
  }

  // Render the report charts
  const ReportComponent = currentReportType.component;

  return (
    <Box>
      <PageHeader
        title={currentReportType.title}
        subtitle={t('reports.sections.' + type + '.description')}
        backPath="/reports"
        showBackButton={true}
      />
      <ReportComponent />
    </Box>
  );
};

export default ReportDetails;

// Named exports for tab-based rendering in Reports.tsx
export { FinancialReport, InterventionsReport, TeamsReport, PropertiesReport };
