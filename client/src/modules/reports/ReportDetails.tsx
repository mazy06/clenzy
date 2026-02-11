import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
  Euro as EuroIcon,
  Schedule as ScheduleIcon,
  People as PeopleIcon,
  Home as HomeIcon,
  BarChart as BarChartIcon,
} from '@mui/icons-material';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import PageHeader from '../../components/PageHeader';
import DataFetchWrapper from '../../components/DataFetchWrapper';
import {
  useInterventionReport,
  usePropertyReport,
  useTeamReport,
  useFinancialReport,
} from './hooks/useReportData';

// ─── Constants ──────────────────────────────────────────────────────────────

const CHART_COLORS = ['#2196f3', '#4caf50', '#ff9800', '#f44336', '#9c27b0', '#00bcd4', '#795548', '#607d8b'];

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
  <Card sx={{ height: '100%', '&:hover': { boxShadow: 3 } }}>
    <CardContent>
      <Typography variant="h6" sx={{ fontSize: '0.95rem', fontWeight: 600, mb: 2 }}>
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

// ─── Report Sections ────────────────────────────────────────────────────────

const InterventionsReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useInterventionReport();

  return (
    <DataFetchWrapper
      loading={loading}
      error={error}
      onRetry={retry}
      loadingMessage={t('reports.charts.loadingData')}
    >
      {data ? (
        <Grid container spacing={2}>
          {/* Pie Chart: Interventions by Status */}
          <Grid item xs={12} md={6}>
            <ChartCard title={t('reports.charts.interventionsByStatus')}>
              {data.byStatus.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.byStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={true}
                    >
                      {data.byStatus.map((entry, index) => (
                        <Cell
                          key={`status-${index}`}
                          fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>

          {/* Bar Chart: Interventions by Type */}
          <Grid item xs={12} md={6}>
            <ChartCard title={t('reports.charts.interventionsByType')}>
              {data.byType.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.byType}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name={t('reports.charts.interventions')} radius={[4, 4, 0, 0]}>
                      {data.byType.map((entry, index) => (
                        <Cell
                          key={`type-${index}`}
                          fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>

          {/* Line Chart: Interventions by Month */}
          <Grid item xs={12}>
            <ChartCard title={t('reports.charts.interventionsByMonth')}>
              {data.byMonth.some((m) => m.total > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.byMonth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name={t('reports.charts.total')}
                      stroke="#2196f3"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name={t('reports.charts.completed')}
                      stroke="#4caf50"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pending"
                      name={t('reports.charts.pending')}
                      stroke="#ff9800"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>

          {/* Bar Chart: Interventions by Priority */}
          <Grid item xs={12} md={6}>
            <ChartCard title={t('reports.charts.interventionsByPriority')}>
              {data.byPriority.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.byPriority} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name={t('reports.charts.interventions')} radius={[0, 4, 4, 0]}>
                      {data.byPriority.map((entry, index) => (
                        <Cell
                          key={`priority-${index}`}
                          fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      ) : (
        <EmptyChartState
          message={t('reports.charts.noData')}
          description={t('reports.charts.noDataDescription')}
        />
      )}
    </DataFetchWrapper>
  );
};

const TeamsReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useTeamReport();

  return (
    <DataFetchWrapper
      loading={loading}
      error={error}
      onRetry={retry}
      loadingMessage={t('reports.charts.loadingData')}
    >
      {data ? (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ChartCard title={t('reports.charts.teamPerformance')}>
              {data.teamPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.teamPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={60} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar
                      dataKey="completed"
                      name={t('reports.charts.completed')}
                      fill="#4caf50"
                      stackId="stack"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="inProgress"
                      name={t('reports.charts.inProgress')}
                      fill="#2196f3"
                      stackId="stack"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="pending"
                      name={t('reports.charts.pending')}
                      fill="#ff9800"
                      stackId="stack"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      ) : (
        <EmptyChartState
          message={t('reports.charts.noData')}
          description={t('reports.charts.noDataDescription')}
        />
      )}
    </DataFetchWrapper>
  );
};

const PropertiesReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = usePropertyReport();

  return (
    <DataFetchWrapper
      loading={loading}
      error={error}
      onRetry={retry}
      loadingMessage={t('reports.charts.loadingData')}
    >
      {data ? (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <ChartCard title={t('reports.charts.interventionsPerProperty')}>
              {data.propertyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={data.propertyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-25}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 12 }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value: number) => `${value}\u00A0\u20AC`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Bar
                      yAxisId="left"
                      dataKey="interventions"
                      name={t('reports.charts.interventions')}
                      fill="#2196f3"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="cost"
                      name={t('reports.charts.cost')}
                      fill="#ff9800"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      ) : (
        <EmptyChartState
          message={t('reports.charts.noData')}
          description={t('reports.charts.noDataDescription')}
        />
      )}
    </DataFetchWrapper>
  );
};

const FinancialReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useFinancialReport();

  return (
    <DataFetchWrapper
      loading={loading}
      error={error}
      onRetry={retry}
      loadingMessage={t('reports.charts.loadingData')}
    >
      {data ? (
        <Grid container spacing={2}>
          {/* Line Chart: Revenue by Month */}
          <Grid item xs={12}>
            <ChartCard title={t('reports.charts.revenueByMonth')}>
              {data.monthlyFinancials.some((m) => m.revenue > 0 || m.expenses > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.monthlyFinancials}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value: number) => `${value}\u00A0\u20AC`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name={t('reports.charts.revenue')}
                      stroke="#4caf50"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name={t('reports.charts.expenses')}
                      stroke="#f44336"
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      name={t('reports.charts.profit')}
                      stroke="#2196f3"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>

          {/* Pie Chart: Cost Breakdown */}
          <Grid item xs={12} md={6}>
            <ChartCard title={t('reports.charts.costBreakdown')}>
              {data.costBreakdown.length > 0 && data.costBreakdown.some((c) => c.value > 0) ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.costBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }: { name?: string; percent?: number }) =>
                        `${name || ''} (${((percent || 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={true}
                    >
                      {data.costBreakdown.map((entry, index) => (
                        <Cell
                          key={`cost-${index}`}
                          fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <EmptyChartState
                  message={t('reports.charts.noData')}
                  description={t('reports.charts.noDataDescription')}
                />
              )}
            </ChartCard>
          </Grid>
        </Grid>
      ) : (
        <EmptyChartState
          message={t('reports.charts.noData')}
          description={t('reports.charts.noDataDescription')}
        />
      )}
    </DataFetchWrapper>
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
