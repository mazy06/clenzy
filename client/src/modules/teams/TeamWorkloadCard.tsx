import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import {
  Assignment,
  CheckCircle,
  HourglassEmpty,
} from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { interventionsApi } from '../../services/api';
import type { Intervention } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { teamsKeys } from './useTeamsList';

interface TeamWorkloadCardProps {
  teamId: number;
  teamName: string;
}

const TeamWorkloadCard: React.FC<TeamWorkloadCardProps> = ({ teamId, teamName }) => {
  const { t } = useTranslation();

  // ─── Team interventions query ───────────────────────────────────────────
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
          <CircularProgress size={28} />
        </CardContent>
      </Card>
    );
  }

  // Compute metrics
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const activeInterventions = interventions.filter((i) => i.status === 'IN_PROGRESS');
  const completedThisMonth = interventions.filter((i) => {
    if (i.status !== 'COMPLETED') return false;
    const updatedDate = i.updatedAt ? new Date(i.updatedAt) : new Date(i.createdAt);
    return updatedDate.getMonth() === currentMonth && updatedDate.getFullYear() === currentYear;
  });
  const pendingInterventions = interventions.filter(
    (i) => i.status === 'PENDING' || i.status === 'AWAITING_VALIDATION' || i.status === 'AWAITING_PAYMENT'
  );

  const total = interventions.length;
  const completedTotal = interventions.filter((i) => i.status === 'COMPLETED').length;
  const capacityPercent = total > 0 ? Math.round((completedTotal / total) * 100) : 0;

  const activeRatio = total > 0 ? (activeInterventions.length / total) * 100 : 0;
  const getWorkloadColor = () => {
    if (activeRatio > 80) return 'error.main';
    if (activeRatio > 50) return 'warning.main';
    return 'success.main';
  };

  const getWorkloadLabel = () => {
    if (activeRatio > 80) return t('teams.workload.overloaded');
    if (activeRatio > 50) return t('teams.workload.busy');
    return t('teams.workload.available');
  };

  // Chart data
  const statusCounts: Record<string, number> = {};
  interventions.forEach((i) => {
    statusCounts[i.status] = (statusCounts[i.status] || 0) + 1;
  });

  const statusLabels: Record<string, string> = {
    PENDING: t('interventions.statuses.PENDING'),
    AWAITING_VALIDATION: t('interventions.statuses.AWAITING_VALIDATION'),
    AWAITING_PAYMENT: t('interventions.statuses.AWAITING_PAYMENT'),
    IN_PROGRESS: t('interventions.statuses.IN_PROGRESS'),
    COMPLETED: t('interventions.statuses.COMPLETED'),
    CANCELLED: t('interventions.statuses.CANCELLED'),
  };

  const statusColors: Record<string, string> = {
    PENDING: '#FF9800',
    AWAITING_VALIDATION: '#9C27B0',
    AWAITING_PAYMENT: '#E91E63',
    IN_PROGRESS: '#2196F3',
    COMPLETED: '#4CAF50',
    CANCELLED: '#9E9E9E',
  };

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
    color: statusColors[status] || '#666',
  }));

  const metrics = [
    {
      label: t('teams.workload.active'),
      value: activeInterventions.length,
      icon: <Assignment sx={{ fontSize: 24, color: 'primary.main' }} />,
      color: 'primary.main',
    },
    {
      label: t('teams.workload.completedThisMonth'),
      value: completedThisMonth.length,
      icon: <CheckCircle sx={{ fontSize: 24, color: 'success.main' }} />,
      color: 'success.main',
    },
    {
      label: t('teams.workload.pending'),
      value: pendingInterventions.length,
      icon: <HourglassEmpty sx={{ fontSize: 24, color: 'warning.main' }} />,
      color: 'warning.main',
    },
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ color: 'primary.main', fontWeight: 600 }}>
            {t('teams.workload.title')}
          </Typography>
          <Box sx={{ px: 1.5, py: 0.5, borderRadius: 1, bgcolor: getWorkloadColor(), color: 'white' }}>
            <Typography variant="caption" fontWeight={600}>{getWorkloadLabel()}</Typography>
          </Box>
        </Box>

        <Grid container spacing={2} sx={{ mb: 3 }}>
          {metrics.map((metric, index) => (
            <Grid item xs={4} key={index}>
              <Box sx={{ textAlign: 'center', p: 1.5, borderRadius: 1, bgcolor: 'grey.50', border: '1px solid', borderColor: 'grey.200' }}>
                {metric.icon}
                <Typography variant="h5" fontWeight={700} sx={{ color: metric.color, mt: 0.5 }}>
                  {metric.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                  {metric.label}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>

        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>{t('teams.workload.capacity')}</Typography>
            <Typography variant="body2" fontWeight={600} color={getWorkloadColor()}>{capacityPercent}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={capacityPercent}
            sx={{
              height: 8,
              borderRadius: 4,
              bgcolor: 'grey.200',
              '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: getWorkloadColor() },
            }}
          />
        </Box>

        {chartData.length > 0 ? (
          <Box sx={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography variant="body2" color="text.secondary">{t('dashboard.noData')}</Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamWorkloadCard;
