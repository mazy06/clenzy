import React, { useState, useEffect } from 'react';
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
import { reportsApi } from '../../services/api';
import type { InterventionReportData, FinancialReportData } from '../../services/api';

const DashboardCharts: React.FC = () => {
  const { t } = useTranslation();
  const [interventionData, setInterventionData] = useState<InterventionReportData | null>(null);
  const [financialData, setFinancialData] = useState<FinancialReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [intData, finData] = await Promise.all([
          reportsApi.getInterventionStats().catch(() => null),
          reportsApi.getFinancialStats().catch(() => null),
        ]);
        if (intData) setInterventionData(intData);
        if (finData) setFinancialData(finData);
      } catch {
        // Graceful fallback - charts will show "no data"
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  if (loading) {
    return (
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[0, 1, 2].map((i) => (
          <Grid item xs={12} md={4} key={i}>
            <Card sx={{ height: 300 }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={32} />
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
    <Grid container spacing={2} sx={{ mb: 2 }}>
      {/* Intervention Trend Chart (Line) */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: 300 }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
              {t('dashboard.charts.interventionTrend')}
            </Typography>
            {byMonth.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 100 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                  <LineChart data={byMonth} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      name={t('dashboard.charts.total')}
                      stroke="#2196f3"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="completed"
                      name={t('dashboard.charts.completed')}
                      stroke="#4caf50"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="pending"
                      name={t('dashboard.charts.pending')}
                      stroke="#ff9800"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Status Distribution (Donut/Pie) */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: 300 }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
              {t('dashboard.charts.statusDistribution')}
            </Typography>
            {byStatus.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 100 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Legend
                      wrapperStyle={{ fontSize: 11 }}
                      iconSize={10}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Revenue Overview (Bar) */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: 300 }}>
          <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" sx={{ fontSize: '0.875rem', fontWeight: 600, mb: 1 }}>
              {t('dashboard.charts.revenueOverview')}
            </Typography>
            {monthlyFinancials.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 100 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={100}>
                  <BarChart data={monthlyFinancials} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value) => `${value} \u20AC`}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconSize={10} />
                    <Bar
                      dataKey="revenue"
                      name={t('dashboard.charts.revenue')}
                      fill="#4caf50"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="expenses"
                      name={t('dashboard.charts.expenses')}
                      fill="#f44336"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
};

export default DashboardCharts;
