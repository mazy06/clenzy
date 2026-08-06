import React from 'react';
import { cn } from '../../utils/cn';
import { Spinner } from '../../components/ui';
import { Card, CardContent, Progress } from '../../components/ui';
import StatusChip from '../../components/StatusChip';
import {
  Assignment,
  CheckCircle,
  HourglassEmpty,
} from '../../icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { interventionsApi } from '../../services/api/interventionsApi';
import type { Intervention } from '../../services/api';
import { extractApiList } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';
import { teamsKeys } from './useTeamsList';

interface TeamWorkloadCardProps {
  teamId: number;
  teamName: string;
}

// Couleurs data par statut — palette Baitly desaturee
const statusColors: Record<string, string> = {
  PENDING: '#D4A574',
  AWAITING_VALIDATION: '#7B68A8',
  AWAITING_PAYMENT: '#C97A7A',
  IN_PROGRESS: '#7BA3C2',
  COMPLETED: '#4A9B8E',
  CANCELLED: '#8A8378',
};

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
      <Card className="h-full">
        <CardContent className="flex justify-center items-center min-h-[300px]">
          <Spinner className="size-7" />
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

  // Charge de travail : un seul palier décidé ici, deux teintes en sortent.
  // Le POURCENTAGE est du texte → encre `-ink` (AA) ; la JAUGE est un aplat →
  // teinte vive. Confondre les deux, c'est du texte à 2,2:1 (cf. contrat §2.4).
  const workload = activeRatio > 80
    ? { tone: 'err' as const, ink: 'var(--bui-destructive-ink)', solid: 'var(--bui-destructive)', label: t('teams.workload.overloaded') }
    : activeRatio > 50
      ? { tone: 'warn' as const, ink: 'var(--bui-warning-ink)', solid: 'var(--bui-warning)', label: t('teams.workload.busy') }
      : { tone: 'ok' as const, ink: 'var(--bui-success-ink)', solid: 'var(--bui-success)', label: t('teams.workload.available') };

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

  const chartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: statusLabels[status] || status,
    value: count,
    color: statusColors[status] || '#8A8378',
  }));

  // Icône = teinte vive, valeur = encre `-ink`. Les deux sont des classes
  // écrites en clair : Tailwind émet ses utilitaires en scannant les sources.
  const metrics = [
    {
      label: t('teams.workload.active'),
      value: activeInterventions.length,
      icon: <Assignment size={24} strokeWidth={1.75} />,
      iconClassName: 'text-primary',
      valueClassName: 'text-foreground',
    },
    {
      label: t('teams.workload.completedThisMonth'),
      value: completedThisMonth.length,
      icon: <CheckCircle size={24} strokeWidth={1.75} />,
      iconClassName: 'text-success',
      valueClassName: 'text-success-ink',
    },
    {
      label: t('teams.workload.pending'),
      value: pendingInterventions.length,
      icon: <HourglassEmpty size={24} strokeWidth={1.75} />,
      iconClassName: 'text-warning',
      valueClassName: 'text-warning-ink',
    },
  ];

  return (
    <Card className="h-full">
      <CardContent className="p-[18px]">
        <div className="flex justify-between items-center mb-3">
          <h6 className="text-sm font-semibold text-foreground">
            {t('teams.workload.title')}
          </h6>
          <StatusChip tone={workload.tone} label={workload.label} pill />
        </div>

        <div className="grid grid-cols-12 gap-3 mb-[18px]">
          {metrics.map((metric) => (
            <div className="col-span-4" key={metric.label}>
              <div className="text-center p-2 rounded-xl bg-field border border-field-line">
                <span className={cn('inline-flex', metric.iconClassName)}>{metric.icon}</span>
                <h5 className={cn('font-[family-name:var(--font-display)] text-sm mt-[3px] font-semibold tabular-nums', metric.valueClassName)}>
                  {metric.value}
                </h5>
                <span className="block text-2xs text-muted-foreground">
                  {metric.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mb-4">
          <div className="flex justify-between items-center mb-0.5">
            <p className="text-xs font-medium">{t('teams.workload.capacity')}</p>
            <p className="text-xs font-semibold tabular-nums" style={{ color: workload.ink }}>{capacityPercent}%</p>
          </div>
          {/* La teinte de la jauge se decide a l'execution : elle transite par
              une variable CSS, une classe Tailwind ne peut pas naitre d'une
              valeur runtime. */}
          <Progress
            value={capacityPercent}
            className="h-2 rounded-[4px] bg-muted [&_[data-slot=progress-indicator]]:bg-[var(--workload-color)] [&_[data-slot=progress-indicator]]:rounded-[4px]"
            style={{ '--workload-color': workload.solid } as React.CSSProperties}
          />
        </div>

        {chartData.length > 0 ? (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={`cell-${entry.name}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-muted-foreground">{t('dashboard.noData')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TeamWorkloadCard;
