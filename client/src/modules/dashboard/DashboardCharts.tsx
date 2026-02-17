import React from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress
} from '@mui/material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from 'recharts';
import { useTranslation } from '../../hooks/useTranslation';
import type { InterventionReportData, FinancialReportData } from '../../services/api/reportsApi';

// ─── Props ───────────────────────────────────────────────────────────────────

interface DashboardChartsProps {
  charts: {
    interventionData: InterventionReportData | null;
    financialData: FinancialReportData | null;
  };
  loading: boolean;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const CARD_CONTENT_SX = {
  p: 1.25,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  '&:last-child': { pb: 1.25 },
} as const;

const SECTION_TITLE_SX = {
  fontSize: '0.75rem',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.04em',
  color: 'text.secondary',
  mb: 0.5,
  flexShrink: 0,
} as const;

const NO_DATA_SX = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
} as const;

const NO_DATA_TEXT_SX = {
  fontSize: '0.75rem',
  letterSpacing: '0.01em',
} as const;

const CHART_BOX_SX = { flex: 1, minHeight: 0 } as const;

// ─── Chart styling constants ─────────────────────────────────────────────────

const AXIS_TICK = { fontSize: 10, fill: '#94A3B8' } as const;
const TOOLTIP_STYLE = { fontSize: 11, borderRadius: 6, border: '1px solid #E2E8F0', boxShadow: 'none' } as const;
const LEGEND_STYLE = { fontSize: 10, letterSpacing: '0.02em' } as const;
const GRID_STROKE = '#F1F5F9';

// Clenzy palette for charts
const CHART_PRIMARY = '#6B8A9A';
const CHART_SUCCESS = '#4A9B8E';
const CHART_WARNING = '#D4A574';
const CHART_ERROR = '#C97A7A';

const DashboardCharts: React.FC<DashboardChartsProps> = React.memo(({ charts, loading }) => {
  const { t } = useTranslation();

  const interventionData = charts.interventionData;
  const financialData = charts.financialData;

  if (loading) {
    return (
      <Grid container spacing={1} sx={{ height: '100%' }}>
        {[0, 1, 2].map((i) => (
          <Grid item xs={12} md={4} key={i} sx={{ height: '100%' }}>
            <Card sx={{ height: '100%' }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={20} />
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  const byMonth = interventionData?.byMonth || [];
  const byStatus = interventionData?.byStatus || [];
  const monthlyFinancials = financialData?.monthlyFinancials || [];

  return (
    <Grid container spacing={1} sx={{ height: '100%' }}>
      {/* Intervention Trend Chart (Line) */}
      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={CARD_CONTENT_SX}>
            <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
              {t('dashboard.charts.interventionTrend')}
            </Typography>
            {byMonth.length === 0 ? (
              <Box sx={NO_DATA_SX}>
                <Typography variant="body2" color="text.secondary" sx={NO_DATA_TEXT_SX}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={CHART_BOX_SX}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={byMonth} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="month" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} allowDecimals={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="total" name={t('dashboard.charts.total')} stroke={CHART_PRIMARY} strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 3 }} />
                    <Line type="monotone" dataKey="completed" name={t('dashboard.charts.completed')} stroke={CHART_SUCCESS} strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 3 }} />
                    <Line type="monotone" dataKey="pending" name={t('dashboard.charts.pending')} stroke={CHART_WARNING} strokeWidth={1.5} dot={{ r: 2 }} activeDot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Status Distribution (Donut/Pie) */}
      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={CARD_CONTENT_SX}>
            <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
              {t('dashboard.charts.statusDistribution')}
            </Typography>
            {byStatus.length === 0 ? (
              <Box sx={NO_DATA_SX}>
                <Typography variant="body2" color="text.secondary" sx={NO_DATA_TEXT_SX}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={CHART_BOX_SX}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={byStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius="38%"
                      outerRadius="58%"
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || CHART_PRIMARY} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={LEGEND_STYLE} iconSize={6} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Revenue Overview (Bar) */}
      <Grid item xs={12} md={4} sx={{ height: '100%' }}>
        <Card sx={{ height: '100%' }}>
          <CardContent sx={CARD_CONTENT_SX}>
            <Typography variant="subtitle2" sx={SECTION_TITLE_SX}>
              {t('dashboard.charts.revenueOverview')}
            </Typography>
            {monthlyFinancials.length === 0 ? (
              <Box sx={NO_DATA_SX}>
                <Typography variant="body2" color="text.secondary" sx={NO_DATA_TEXT_SX}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={CHART_BOX_SX}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyFinancials} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                    <XAxis dataKey="month" tick={AXIS_TICK} />
                    <YAxis tick={AXIS_TICK} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => `${value} \u20AC`} />
                    <Legend wrapperStyle={LEGEND_STYLE} iconSize={6} />
                    <Bar dataKey="revenue" name={t('dashboard.charts.revenue')} fill={CHART_SUCCESS} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name={t('dashboard.charts.expenses')} fill={CHART_ERROR} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
});

DashboardCharts.displayName = 'DashboardCharts';

export default DashboardCharts;
