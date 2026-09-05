import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { NativeSelect, NativeSelectOption } from '../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../components/ui';
import {
  GroupedBarChart,
  HighlightList,
  HistogramChart,
  StatsBand,
  StatsLayout,
  TileGrid,
  TrendLineChart,
  tiles,
  type Highlight,
  type StatFigure,
  type TileOrNothing,
} from '../../components/stats';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { paceApi } from '../../services/api/paceApi';
import { ReportFrame, TileScroll } from './reportShell';

const MONTHS_AHEAD = 6;

/**
 * Onglet « Pace » du module Rapports (fondations RMS R1) — données 100 % backend
 * (`/api/analytics/pace/*`) : on-the-books des prochains mois vs same-time-last-year,
 * pickup 7/28 j, et booking curve du mois sélectionné (montée des réservations
 * au fil du lead-time, comparée à l'an dernier au même lead-time).
 *
 * <p>Le tableau reste — il porte sept colonnes qu'aucun graphique ne remplace —
 * mais il cohabite désormais avec les lectures graphiques dans la même grille de
 * tuiles que le reste des rapports. La grille ne se cale pas sur la hauteur de
 * la fenêtre ici : un tableau de six lignes écrasé à 180 px ne se lit plus.</p>
 */
const PaceReport: React.FC = () => {
  const { t } = useTranslation();
  const [curveMonth, setCurveMonth] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ['pace-summary', MONTHS_AHEAD],
    queryFn: () => paceApi.getSummary(MONTHS_AHEAD),
    staleTime: 5 * 60 * 1000,
  });

  const months = summaryQuery.data?.months ?? [];
  const effectiveCurveMonth = curveMonth ?? months[1]?.month ?? months[0]?.month ?? null;

  const curveQuery = useQuery({
    queryKey: ['pace-curve', effectiveCurveMonth],
    queryFn: () => paceApi.getBookingCurve(effectiveCurveMonth as string),
    enabled: effectiveCurveMonth != null,
    staleTime: 5 * 60 * 1000,
  });

  const totals = useMemo(() => {
    const otb = months.reduce((sum, m) => sum + m.otbNights, 0);
    const stly = months.reduce((sum, m) => sum + m.stlyNights, 0);
    const pickup7 = months.reduce((sum, m) => sum + m.pickup7Nights, 0);
    const pickup28 = months.reduce((sum, m) => sum + m.pickup28Nights, 0);
    return {
      otb,
      stly,
      pickup7,
      pickup28,
      pacePct: stly > 0 ? Math.round(((otb - stly) * 1000) / stly) / 10 : null,
    };
  }, [months]);

  const curveData = useMemo(
    () =>
      (curveQuery.data?.points ?? []).map((p) => ({
        label: `J-${p.daysBeforeMonthStart}`,
        otb: p.otbNights,
        stly: p.stlyOtbNights,
      })),
    [curveQuery.data],
  );

  const behind = months.filter((m) => (m.paceVsStlyPct ?? 0) < 0);
  const occupancies = months.filter((m) => m.occupancyOtbPct != null);
  const avgOccupancy =
    occupancies.length > 0
      ? Math.round(
          occupancies.reduce((sum, m) => sum + (m.occupancyOtbPct as number), 0) /
            occupancies.length,
        )
      : null;

  const figures: StatFigure[] = [
    {
      key: 'otb',
      value: totals.otb.toLocaleString(),
      label: t('reports.pace.otbNights', 'nuits réservées (6 mois)'),
      delta: totals.pacePct,
    },
    {
      key: 'stly',
      value: totals.stly.toLocaleString(),
      label: t('reports.pace.stlyNights', 'nuits à N-1, même recul'),
      muted: true,
    },
    {
      key: 'pickup7',
      value: `+${totals.pickup7.toLocaleString()}`,
      label: t('reports.pace.pickup7', 'de pickup à 7 jours'),
    },
    {
      key: 'pickup28',
      value: `+${totals.pickup28.toLocaleString()}`,
      label: t('reports.pace.pickup28', 'à 28 jours'),
      muted: true,
    },
    ...(avgOccupancy != null
      ? [
          {
            key: 'occ',
            value: `${avgOccupancy} %`,
            label: t('reports.pace.avgOccupancy', "d'occupation OTB moyenne"),
            muted: true,
          } as StatFigure,
        ]
      : []),
  ];

  const repere: Highlight[] = [
    {
      label: t('reports.pace.monthsBehind', 'Mois en retard sur N-1'),
      value: `${behind.length}`,
      alert: behind.length > 0,
    },
    {
      label: t('reports.pace.worstMonth', 'Mois le plus en retard'),
      value:
        behind.length > 0
          ? (() => {
              const worst = [...behind].sort(
                (a, b) => (a.paceVsStlyPct ?? 0) - (b.paceVsStlyPct ?? 0),
              )[0];
              return `${worst.month} · ${worst.paceVsStlyPct} %`;
            })()
          : '—',
      alert: behind.length > 0,
    },
    {
      label: t('reports.pace.bestMonth', 'Mois le mieux engagé'),
      value:
        months.length > 0
          ? (() => {
              const best = [...months].sort((a, b) => b.otbNights - a.otbNights)[0];
              return `${best.month} · ${best.otbNights}`;
            })()
          : '—',
    },
    {
      label: t('reports.pace.horizon', 'Horizon suivi'),
      value: `${months.length} ${t('reports.pace.monthsUnit', 'mois')}`,
    },
  ];

  const items = tiles([
    months.length > 0 && {
      key: 'otbVsStly',
      title: t('reports.pace.otbVsStly', 'On-the-books vs N-1'),
      hint: t('reports.pace.otbVsStlyHint', 'Par mois de séjour, au même recul'),
      span: 2,
      render: () => (
        <GroupedBarChart
          data={months.map((m) => ({ label: m.month, otb: m.otbNights, stly: m.stlyNights }))}
          series={[
            { key: 'otb', label: t('reports.pace.curveOtb', 'Cette année'), tokenIndex: 0 },
            { key: 'stly', label: t('reports.pace.curveStly', 'N-1'), tokenIndex: 3 },
          ]}
        />
      ),
    },
    months.some((m) => m.paceVsStlyPct != null) && {
      key: 'pace',
      title: t('reports.pace.paceByMonth', 'Pace par mois'),
      hint: t('reports.pace.paceHint', 'Écart en pourcentage face à N-1'),
      render: () => (
        <HistogramChart
          buckets={months
            .filter((m) => m.paceVsStlyPct != null)
            .map((m) => ({ label: m.month, count: m.paceVsStlyPct as number }))}
          label={t('reports.pace.colPace', 'Pace')}
          formatValue={(v) => `${v > 0 ? '+' : ''}${v} %`}
          colorFor={(bucket) =>
            bucket.count >= 0 ? 'var(--bui-success)' : 'var(--bui-destructive)'
          }
          labelWidth={72}
        />
      ),
    },
    curveData.length > 0 && {
      key: 'curve',
      title: t('reports.pace.bookingCurve', 'Montée des réservations'),
      hint: t('reports.pace.curveHint', 'Cumul des nuits au fil du lead-time'),
      action:
        months.length > 0 ? (
          <NativeSelect
            size="sm"
            aria-label={t('reports.pace.month', 'Mois')}
            value={effectiveCurveMonth ?? ''}
            onChange={(e) => setCurveMonth(e.target.value)}
          >
            {months.map((m) => (
              <NativeSelectOption key={m.month} value={m.month}>
                {m.month}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : undefined,
      render: () => (
        <TrendLineChart
          data={curveData}
          series={[
            { key: 'otb', label: t('reports.pace.curveOtb', 'Cette année'), tokenIndex: 0 },
            {
              key: 'stly',
              label: t('reports.pace.curveStly', 'N-1 au même recul'),
              tokenIndex: 3,
              dashed: true,
            },
          ]}
        />
      ),
    },
    months.length > 0 && {
      key: 'pickup',
      title: t('reports.pace.pickupByMonth', 'Pickup récent par mois'),
      hint: t('reports.pace.pickupHint', 'Nuits prises sur les 7 et 28 derniers jours'),
      render: () => (
        <GroupedBarChart
          data={months.map((m) => ({
            label: m.month,
            pickup7: m.pickup7Nights,
            pickup28: m.pickup28Nights,
          }))}
          series={[
            { key: 'pickup7', label: t('reports.pace.colPickup7', 'Pickup 7 j'), tone: 'success' },
            { key: 'pickup28', label: t('reports.pace.colPickup28', 'Pickup 28 j'), tokenIndex: 1 },
          ]}
        />
      ),
    },
    {
      key: 'highlights',
      fluid: true,
      title: t('reports.pace.highlights', 'Repères'),
      render: () => <HighlightList items={repere} />,
    },
    months.length > 0 && {
      key: 'table',
      fluid: true,
      title: t('reports.pace.byMonth', 'On-the-books par mois de séjour'),
      hint: t('reports.pace.tableHint', 'Le détail chiffré, colonne par colonne'),
      span: 3,
      render: () => (
        <TileScroll>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('reports.pace.month', 'Mois')}</TableHead>
                <TableHead className="text-end">{t('reports.pace.colOtb', 'Nuits OTB')}</TableHead>
                <TableHead className="text-end">
                  {t('reports.pace.colStly', 'N-1 (même recul)')}
                </TableHead>
                <TableHead className="text-end">{t('reports.pace.colPace', 'Pace')}</TableHead>
                <TableHead className="text-end">
                  {t('reports.pace.colPickup7', 'Pickup 7 j')}
                </TableHead>
                <TableHead className="text-end">
                  {t('reports.pace.colPickup28', 'Pickup 28 j')}
                </TableHead>
                <TableHead className="text-end">
                  {t('reports.pace.colOccupancy', 'Occupation OTB')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month}>
                  <TableCell className="tabular-nums">{m.month}</TableCell>
                  <TableCell className="text-end tabular-nums">{m.otbNights}</TableCell>
                  <TableCell className="text-end tabular-nums text-muted-foreground">
                    {m.stlyNights}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-end tabular-nums',
                      m.paceVsStlyPct == null
                        ? 'text-muted-foreground'
                        : m.paceVsStlyPct < 0
                          ? 'text-warning-ink'
                          : 'text-success-ink',
                    )}
                  >
                    {m.paceVsStlyPct == null
                      ? '—'
                      : `${m.paceVsStlyPct > 0 ? '+' : ''}${m.paceVsStlyPct} %`}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">{m.pickup7Nights}</TableCell>
                  <TableCell className="text-end tabular-nums">{m.pickup28Nights}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {m.occupancyOtbPct == null ? '—' : `${m.occupancyOtbPct} %`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TileScroll>
      ),
    },
  ] as TileOrNothing[]);

  return (
    <ReportFrame
      loading={summaryQuery.isLoading}
      error={
        summaryQuery.isError ? t('reports.pace.loadError', 'Impossible de charger le pace.') : null
      }
      onRetry={() => summaryQuery.refetch()}
    >
      <StatsLayout>
        <StatsBand figures={figures} />
        <TileGrid items={items} fill={false} />
      </StatsLayout>
    </ReportFrame>
  );
};

export default PaceReport;
