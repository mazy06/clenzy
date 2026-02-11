import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  CalendarMonth,
  Speed,
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { interventionsApi } from '../../services/api';
import type { Intervention } from '../../services/api';
import { useTranslation } from '../../hooks/useTranslation';

interface TeamPerformanceChartProps {
  teamId: number;
  teamName: string;
}

const TeamPerformanceChart: React.FC<TeamPerformanceChartProps> = ({ teamId, teamName }) => {
  const { t } = useTranslation();
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadInterventions = async () => {
      setLoading(true);
      try {
        const data = await interventionsApi.getAll();
        const list = Array.isArray(data) ? data : (data as any).content || [];
        const teamInterventions = list.filter(
          (i: Intervention) => i.assignedToType === 'team' && i.assignedToName === teamName
        );
        setInterventions(teamInterventions);
      } catch {
        setInterventions([]);
      } finally {
        setLoading(false);
      }
    };

    loadInterventions();
  }, [teamId, teamName]);

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <CircularProgress size={28} />
        </CardContent>
      </Card>
    );
  }

  // Get last 6 months
  const now = new Date();
  const months: { key: string; label: string; month: number; year: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
    months.push({ key: monthKey, label, month: d.getMonth(), year: d.getFullYear() });
  }

  // Group completed interventions by month
  const completedByMonth: Record<string, number> = {};
  months.forEach((m) => { completedByMonth[m.key] = 0; });

  const completedInterventions = interventions.filter((i) => i.status === 'COMPLETED');

  completedInterventions.forEach((intervention) => {
    const date = intervention.updatedAt ? new Date(intervention.updatedAt) : new Date(intervention.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    if (completedByMonth[key] !== undefined) {
      completedByMonth[key]++;
    }
  });

  const chartData = months.map((m) => ({
    name: m.label,
    completed: completedByMonth[m.key] || 0,
  }));

  // Summary stats
  const totalCompleted = completedInterventions.length;
  const totalInterventions = interventions.length;
  const monthsWithData = chartData.filter((d) => d.completed > 0).length;
  const averagePerMonth = monthsWithData > 0 ? Math.round((totalCompleted / 6) * 10) / 10 : 0;
  const completionRate = totalInterventions > 0 ? Math.round((totalCompleted / totalInterventions) * 100) : 0;

  const summaryStats = [
    {
      label: t('teams.performance.totalCompleted'),
      value: totalCompleted.toString(),
      icon: <TrendingUp sx={{ fontSize: 22, color: 'success.main' }} />,
      color: 'success.main',
    },
    {
      label: t('teams.performance.averagePerMonth'),
      value: averagePerMonth.toString(),
      icon: <CalendarMonth sx={{ fontSize: 22, color: 'info.main' }} />,
      color: 'info.main',
    },
    {
      label: t('teams.performance.completionRate'),
      value: `${completionRate}%`,
      icon: <Speed sx={{ fontSize: 22, color: 'primary.main' }} />,
      color: 'primary.main',
    },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        {/* Title */}
        <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600, mb: 2 }}>
          {t('teams.performance.title')}
        </Typography>

        {/* Summary stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {summaryStats.map((stat, index) => (
            <Grid item xs={4} key={index}>
              <Box
                sx={{
                  textAlign: 'center',
                  p: 1.5,
                  borderRadius: 1,
                  bgcolor: 'grey.50',
                  border: '1px solid',
                  borderColor: 'grey.200',
                }}
              >
                {stat.icon}
                <Typography variant="h5" fontWeight={700} sx={{ color: stat.color, mt: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {stat.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        {/* Monthly trend label */}
        <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
          {t('teams.performance.monthlyTrend')}
        </Typography>

        {/* Line chart */}
        <Box sx={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#4CAF50"
                strokeWidth={2}
                dot={{ fill: '#4CAF50', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </CardContent>
    </Card>
  );
};

export default TeamPerformanceChart;
