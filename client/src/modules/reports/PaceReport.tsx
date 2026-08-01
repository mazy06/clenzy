import React, { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Card, MenuItem, Select, Skeleton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarMonth as CalendarIcon, TrendingUp } from '../../icons';
import StatTile from '../../components/StatTile';
import EmptyState from '../../components/EmptyState';
import { useTranslation } from '../../hooks/useTranslation';
import { paceApi } from '../../services/api/paceApi';
import {
  axisTick,
  CHART_TOOLTIP_CONTENT_STYLE,
  CHART_TOOLTIP_ITEM_STYLE,
  CHART_TOOLTIP_LABEL_STYLE,
  useChartTokens,
} from './chartTheme';

const MONTHS_AHEAD = 6;
const NUM_SX = { fontVariantNumeric: 'tabular-nums' } as const;

/**
 * Onglet « Pace » du module Reports (fondations RMS R1) — données 100 % backend
 * (`/api/analytics/pace/*`) : on-the-books des prochains mois vs same-time-last-year,
 * pickup 7/28 j, et booking curve du mois sélectionné (montée des réservations
 * au fil du lead-time, comparée à l'an dernier au même lead-time).
 */
const PaceReport: React.FC = () => {
  const { t } = useTranslation();
  const ct = useChartTokens();
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
    return {
      otb,
      pickup7,
      pacePct: stly > 0 ? Math.round(((otb - stly) * 1000) / stly) / 10 : null,
    };
  }, [months]);

  const curveData = useMemo(
    () =>
      (curveQuery.data?.points ?? []).map((p) => ({
        lead: `J-${p.daysBeforeMonthStart}`,
        otb: p.otbNights,
        stly: p.stlyOtbNights,
      })),
    [curveQuery.data],
  );

  if (summaryQuery.isError) {
    return <Alert variant="destructive">
      <TriangleAlert />
      <AlertDescription>{t('reports.pace.loadError', 'Impossible de charger le pace.')}</AlertDescription>
    </Alert>;
  }

  const loading = summaryQuery.isLoading;

  return (
    <div className="flex flex-col gap-2">
      {/* ── Tuiles de synthèse ── */}
      <div className="grid grid-cols-[1fr_1fr] min-[900px]:grid-cols-[repeat(3,_1fr)] gap-[9px]">
        <StatTile
          icon={<CalendarIcon size={18} />}
          label={t('reports.pace.otbNights', 'Nuits réservées (6 mois)')}
          value={loading ? '—' : totals.otb.toLocaleString()}
          loading={loading}
        />
        <StatTile
          icon={<TrendingUp size={18} />}
          label={t('reports.pace.pickup7', 'Pickup 7 jours')}
          value={loading ? '—' : `+${totals.pickup7.toLocaleString()}`}
          color="var(--ok)"
          loading={loading}
        />
        <StatTile
          icon={<TrendingUp size={18} />}
          label={t('reports.pace.vsLastYear', 'Pace vs N-1')}
          value={loading || totals.pacePct == null ? '—' : `${totals.pacePct > 0 ? '+' : ''}${totals.pacePct} %`}
          color={totals.pacePct != null && totals.pacePct < 0 ? 'var(--warn)' : 'var(--ok)'}
          loading={loading}
        />
      </div>

      {/* ── Tableau mensuel ── */}
      <Card variant="outlined" sx={{ p: 1.5 }}>
        <h6 className="cn-text-subtitle2 mb-1.5">
          {t('reports.pace.byMonth', 'On-the-books par mois de séjour')}
        </h6>
        {loading ? (
          <Skeleton variant="rounded" height={220} />
        ) : months.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon />}
            title={t('reports.pace.empty', 'Aucune donnée de réservation')}
            variant="plain"
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('reports.pace.month', 'Mois')}</TableCell>
                <TableCell align="right">{t('reports.pace.colOtb', 'Nuits OTB')}</TableCell>
                <TableCell align="right">{t('reports.pace.colStly', 'N-1 (même recul)')}</TableCell>
                <TableCell align="right">{t('reports.pace.colPace', 'Pace')}</TableCell>
                <TableCell align="right">{t('reports.pace.colPickup7', 'Pickup 7 j')}</TableCell>
                <TableCell align="right">{t('reports.pace.colPickup28', 'Pickup 28 j')}</TableCell>
                <TableCell align="right">{t('reports.pace.colOccupancy', 'Occupation OTB')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {months.map((m) => (
                <TableRow key={m.month} hover>
                  <TableCell sx={NUM_SX}>{m.month}</TableCell>
                  <TableCell align="right" sx={NUM_SX}>{m.otbNights}</TableCell>
                  <TableCell align="right" sx={{ ...NUM_SX, color: 'var(--muted)' }}>{m.stlyNights}</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      ...NUM_SX,
                      color: m.paceVsStlyPct == null ? 'var(--muted)'
                        : m.paceVsStlyPct < 0 ? 'var(--warn)' : 'var(--ok)',
                    }}
                  >
                    {m.paceVsStlyPct == null ? '—' : `${m.paceVsStlyPct > 0 ? '+' : ''}${m.paceVsStlyPct} %`}
                  </TableCell>
                  <TableCell align="right" sx={NUM_SX}>{m.pickup7Nights}</TableCell>
                  <TableCell align="right" sx={NUM_SX}>{m.pickup28Nights}</TableCell>
                  <TableCell align="right" sx={NUM_SX}>
                    {m.occupancyOtbPct == null ? '—' : `${m.occupancyOtbPct} %`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* ── Booking curve ── */}
      <Card variant="outlined" sx={{ p: 1.5 }}>
        <div className="flex items-center justify-between mb-1.5">
          <h6 className="cn-text-subtitle2">
            {t('reports.pace.bookingCurve', 'Montée des réservations (booking curve)')}
          </h6>
          {months.length > 0 && (
            <Select
              size="small"
              value={effectiveCurveMonth ?? ''}
              onChange={(e) => setCurveMonth(e.target.value)}
            >
              {months.map((m) => (
                <MenuItem key={m.month} value={m.month}>{m.month}</MenuItem>
              ))}
            </Select>
          )}
        </div>
        {curveQuery.isLoading ? (
          <Skeleton variant="rounded" height={240} />
        ) : curveData.length === 0 ? (
          <EmptyState
            icon={<TrendingUp />}
            title={t('reports.pace.curveEmpty', 'Pas encore de courbe pour ce mois')}
            variant="plain"
          />
        ) : (
          <div className="h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={curveData} margin={{ top: 4, right: 6, left: -18, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.line} />
                <XAxis dataKey="lead" tick={axisTick(ct)} />
                <YAxis tick={axisTick(ct)} allowDecimals={false} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_CONTENT_STYLE}
                  labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                  itemStyle={CHART_TOOLTIP_ITEM_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="otb"
                  name={t('reports.pace.curveOtb', 'Cette année')}
                  stroke={ct.accent}
                  strokeWidth={1.5}
                  dot={{ r: 2 }}
                />
                <Line
                  type="monotone"
                  dataKey="stly"
                  name={t('reports.pace.curveStly', 'N-1 au même recul')}
                  stroke={ct.info}
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
};

export default PaceReport;
