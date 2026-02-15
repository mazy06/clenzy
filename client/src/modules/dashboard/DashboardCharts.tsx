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

const CHART_HEIGHT = 240;

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
      <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
        {[0, 1, 2].map((i) => (
          <Grid item xs={12} md={4} key={i}>
            <Card sx={{ height: CHART_HEIGHT }}>
              <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <CircularProgress size={28} />
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
    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
      {/* Intervention Trend Chart (Line) */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: CHART_HEIGHT }}>
          <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.5 }}>
              {t('dashboard.charts.interventionTrend')}
            </Typography>
            {byMonth.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 80 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                  <LineChart data={byMonth} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Line type="monotone" dataKey="total" name={t('dashboard.charts.total')} stroke="#6B8A9A" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="completed" name={t('dashboard.charts.completed')} stroke="#4A9B8E" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="pending" name={t('dashboard.charts.pending')} stroke="#D4A574" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Status Distribution (Donut/Pie) */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: CHART_HEIGHT }}>
          <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.5 }}>
              {t('dashboard.charts.statusDistribution')}
            </Typography>
            {byStatus.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 80 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                  <PieChart>
                    <Pie
                      data={byStatus}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="name"
                    >
                      {byStatus.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color || '#8884d8'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Revenue Overview (Bar) */}
      <Grid item xs={12} md={4}>
        <Card sx={{ height: CHART_HEIGHT }}>
          <CardContent sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', '&:last-child': { pb: 1.5 } }}>
            <Typography variant="subtitle2" sx={{ fontSize: '0.8125rem', fontWeight: 600, mb: 0.5 }}>
              {t('dashboard.charts.revenueOverview')}
            </Typography>
            {monthlyFinancials.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                  {t('dashboard.charts.noData')}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ flex: 1, minHeight: 80 }}>
                <ResponsiveContainer width="100%" height="100%" minHeight={80}>
                  <BarChart data={monthlyFinancials} margin={{ top: 5, right: 8, left: -15, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(value) => `${value} \u20AC`} />
                    <Legend wrapperStyle={{ fontSize: 10 }} iconSize={8} />
                    <Bar dataKey="revenue" name={t('dashboard.charts.revenue')} fill="#4A9B8E" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="expenses" name={t('dashboard.charts.expenses')} fill="#C97A7A" radius={[3, 3, 0, 0]} />
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
