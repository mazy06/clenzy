import React from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from '../../components/ui';
import { Card, CardContent, Grid } from '@mui/material';
import {
  TrendingUp,
  CalendarMonth,
  Speed,
} from '../../icons';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { interventionsApi } from '../../services/api/interventionsApi';
import type { Intervention } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { teamsKeys } from './useTeamsList';

interface TeamPerformanceChartProps {
  teamId: number;
  teamName: string;
}

const TeamPerformanceChart: React.FC<TeamPerformanceChartProps> = ({ teamId, teamName }) => {
  const { t } = useTranslation();

  // ─── Team interventions query (shared key with workload for caching) ────
  const interventionsQuery = useQuery({
    queryKey: teamsKeys.workload(teamName),
    queryFn: async () => {
      const data = await interventionsApi.getAll();
      const list = extractApiList<Intervention>(data);
      return list.filter(
        (i) => i.assignedToType === 'team' && i.assignedToName === teamName
      );
    },
    staleTime: 30_000,
  });

  const interventions = interventionsQuery.data ?? [];
  const loading = interventionsQuery.isLoading;

  if (loading) {
    return (
      <Card sx={{ height: '100%' }}>
        <CardContent sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
          <Spinner className="size-7" />
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

  const totalCompleted = completedInterventions.length;
  const totalInterventions = interventions.length;
  const monthsWithData = chartData.filter((d) => d.completed > 0).length;
  const averagePerMonth = monthsWithData > 0 ? Math.round((totalCompleted / 6) * 10) / 10 : 0;
  const completionRate = totalInterventions > 0 ? Math.round((totalCompleted / totalInterventions) * 100) : 0;

  const summaryStats = [
    {
      label: t('teams.performance.totalCompleted'),
      value: totalCompleted.toString(),
      icon: <span className="inline-flex text-[var(--ok)]"><TrendingUp size={22} strokeWidth={1.75} /></span>,
      color: 'var(--ok)',
    },
    {
      label: t('teams.performance.averagePerMonth'),
      value: averagePerMonth.toString(),
      icon: <span className="inline-flex text-[var(--info)]"><CalendarMonth size={22} strokeWidth={1.75} /></span>,
      color: 'var(--info)',
    },
    {
      label: t('teams.performance.completionRate'),
      value: `${completionRate}%`,
      icon: <span className="inline-flex text-[var(--accent)]"><Speed size={22} strokeWidth={1.75} /></span>,
      color: 'var(--accent)',
    },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <h6 className="cn-text-h6 text-[var(--ink)] font-semibold mb-3">
          {t('teams.performance.title')}
        </h6>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {summaryStats.map((stat) => (
            <Grid item xs={4} key={stat.label}>
              <div className="text-center p-2 rounded-[12px] bg-[var(--field)] border border-[var(--field-line)]">
                {stat.icon}
                <h5 className="cn-text-h5 font-bold mt-[3px]" style={{ color: stat.color }}>
                  {stat.value}
                </h5>
                <span className="cn-text-caption text-muted-foreground text-[0.7rem]">
                  {stat.label}
                </span>
              </div>
            </Grid>
          ))}
        </Grid>

        <p className="cn-text-body2 font-medium mb-1.5">
          {t('teams.performance.monthlyTrend')}
        </p>

        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="completed"
                stroke="#4A9B8E"
                strokeWidth={2}
                dot={{ fill: '#4A9B8E', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamPerformanceChart;
