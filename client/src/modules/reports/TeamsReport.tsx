import React from 'react';
import {
  DonutChart,
  GroupedBarChart,
  HighlightList,
  HistogramChart,
  StatsBand,
  StatsLayout,
  TileGrid,
  tiles,
  type Highlight,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { useTranslation } from '../../hooks/useTranslation';
import { useTeamReport } from './hooks/useReportData';
import { ReportFrame, scaleColor } from './reportShell';

/** Cible et seuil d'alerte d'un taux de réalisation, en points de pourcentage. */
const RATE_GOOD = 70;
const RATE_FAIR = 40;

/**
 * Équipes portées au graphique de charge.
 *
 * <p>Une organisation peut compter des dizaines d'équipes : soixante-dix noms
 * pivotés sur un axe forment une bouillie illisible, et les équipes sans tâche
 * n'y apprennent rien. On montre les plus chargées ; le compte complet reste
 * dans le bandeau et les repères.</p>
 */
const MAX_TEAMS_CHARTED = 12;

/**
 * Onglet « Équipes ».
 *
 * <p>La « meilleure équipe » occupait une demi-carte pour un nom et deux
 * chiffres. Elle est redescendue dans les repères ; la place sert désormais à
 * montrer QUI est en retard — la seule information sur laquelle on agit.</p>
 */
const TeamsReport: React.FC = () => {
  const { t } = useTranslation();
  const { data, loading, error, retry } = useTeamReport();

  const teams = data?.teamPerformance ?? [];
  const totalTasks = teams.reduce((sum, tp) => sum + tp.completed + tp.inProgress + tp.pending, 0);
  const totalCompleted = teams.reduce((sum, tp) => sum + tp.completed, 0);
  const totalInProgress = teams.reduce((sum, tp) => sum + tp.inProgress, 0);
  const totalPending = teams.reduce((sum, tp) => sum + tp.pending, 0);
  const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;
  const avgPerTeam = teams.length > 0 ? Math.round(totalTasks / teams.length) : 0;

  const rates = teams
    .map((tp) => {
      const total = tp.completed + tp.inProgress + tp.pending;
      return {
        label: tp.name,
        count: total > 0 ? Math.round((tp.completed / total) * 100) : 0,
        total,
      };
    })
    .sort((a, b) => b.count - a.count);

  const charted = [...teams]
    .map((tp) => ({ ...tp, load: tp.completed + tp.inProgress + tp.pending }))
    .filter((tp) => tp.load > 0)
    .sort((a, b) => b.load - a.load)
    .slice(0, MAX_TEAMS_CHARTED);

  const top = [...teams].sort((a, b) => b.completed - a.completed)[0];
  const workingRates = rates.filter((r) => r.total > 0).slice(0, MAX_TEAMS_CHARTED);
  const lagging = rates.filter((r) => r.total > 0 && r.count < RATE_FAIR);

  const figures: StatFigure[] = [
    { key: 'teams', value: teams.length, label: t('reports.teamsTab.teams', 'équipes') },
    { key: 'tasks', value: totalTasks, label: t('reports.teamsTab.tasks', 'tâches') },
    {
      key: 'rate',
      value: `${completionRate} %`,
      label: t('reports.teamsTab.completionRate', 'de réalisation'),
    },
    {
      key: 'pending',
      value: totalPending,
      label: t('reports.charts.pending').toLowerCase(),
    },
    {
      key: 'avg',
      value: avgPerTeam,
      label: t('reports.teamsTab.perTeam', 'tâches par équipe'),
      muted: true,
    },
  ];

  const repere: Highlight[] = [
    {
      label: t('reports.teamsTab.topPerformer', 'Équipe la plus productive'),
      value: top ? `${top.name} · ${top.completed}` : '—',
    },
    {
      label: t('reports.teamsTab.lagging', 'Équipes sous 40 % de réalisation'),
      value: `${lagging.length}`,
      alert: lagging.length > 0,
    },
    {
      label: t('reports.teamsTab.idle', 'Équipes sans tâche'),
      value: `${rates.filter((r) => r.total === 0).length}`,
      alert: rates.some((r) => r.total === 0),
    },
    {
      label: t('reports.teamsTab.backlog', 'Reste à traiter'),
      value: `${totalPending + totalInProgress}`,
    },
  ];

  const items = tiles([
    charted.length > 0 && {
      key: 'load',
      title: t('reports.charts.teamPerformance'),
      // Pas de « Les 1 équipes » : le rapport se lit sans accord à gérer.
      hint:
        teams.length > charted.length
          ? `${t('reports.teamsTab.loadHintTop', 'Les plus chargées')} · ${charted.length}/${teams.length}`
          : t('reports.teamsTab.loadHint', 'Charge empilée par équipe'),
      span: 2,
      render: () => (
        <GroupedBarChart
          angled
          data={charted.map((tp) => ({ label: tp.name, ...tp }))}
          series={[
            {
              key: 'completed',
              label: t('reports.charts.completed'),
              tone: 'success',
              stackId: 'tasks',
            },
            {
              key: 'inProgress',
              label: t('reports.charts.inProgress'),
              tone: 'info',
              stackId: 'tasks',
            },
            {
              key: 'pending',
              label: t('reports.charts.pending'),
              tone: 'warning',
              stackId: 'tasks',
            },
          ]}
        />
      ),
    },
    workingRates.length > 0 && {
      key: 'rate',
      title: t('reports.teamsTab.rateByTeam', 'Taux de réalisation par équipe'),
      hint: t('reports.teamsTab.rateHint', 'Rouge sous 40 %, ambre sous 70 %'),
      render: () => (
        <HistogramChart
          buckets={workingRates}
          label={t('reports.teamsTab.completionRate', 'Réalisation')}
          formatValue={(v) => `${v} %`}
          colorFor={(bucket) => scaleColor(bucket.count, RATE_GOOD, RATE_FAIR)}
          labelWidth={132}
        />
      ),
    },
    totalTasks > 0 && {
      key: 'status',
      title: t('reports.teamsTab.taskStatus', 'Statut des tâches'),
      render: () => (
        <DonutChart
          buckets={[
            { label: t('reports.charts.completed'), count: totalCompleted },
            { label: t('reports.charts.inProgress'), count: totalInProgress },
            { label: t('reports.charts.pending'), count: totalPending },
          ]}
          totalLabel={t('reports.teamsTab.tasks', 'tâches')}
          otherLabel={t('reports.charts.others', 'Autres')}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.teamsTab.highlights', 'Repères'),
      render: () => <HighlightList items={repere} />,
    },
  ] as TileOrNothing[]);

  return (
    <ReportFrame loading={loading} error={error} onRetry={retry}>
      <StatsLayout>
        <StatsBand figures={figures} />
        <TileGrid items={items} />
      </StatsLayout>
    </ReportFrame>
  );
};

export default TeamsReport;
