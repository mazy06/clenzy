import { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '../../../../components/ui';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../../../../components/ui';
import { TriangleAlert } from 'lucide-react';
import { Card, Skeleton, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { CalendarX2, Eye, MousePointerClick, Search, ShoppingCart } from 'lucide-react';
import StatTile from '../../../../components/StatTile';
import EmptyState from '../../../../components/EmptyState';
import { useTranslation } from '../../../../hooks/useTranslation';
import { funnelApi, type FunnelAnalytics } from '../../../../services/api/funnelApi';

const isoDate = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Section « Funnel » du Studio (fondations RMS R1) — org-level, comme la section
 * Croissance : recherches, demande refusée (SEARCH_NO_RESULT = dates demandées
 * sans disponibilité), vues, checkouts, conversion. Le tableau « séjours demandés
 * sans résultat » est le signal prix/min-stay à revoir.
 */
export default function FunnelAnalyticsPanel() {
  const { t } = useTranslation();
  const [days, setDays] = useState<30 | 90>(30);
  const [data, setData] = useState<FunnelAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    funnelApi.get(isoDate(from), isoDate(to))
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : 'Chargement impossible'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [days]);

  const steps = [
    {
      icon: <Search size={18} />,
      label: t('bookingEngine.funnel.searches', 'Recherches'),
      value: data?.searches,
      color: 'var(--accent)',
    },
    {
      icon: <CalendarX2 size={18} />,
      label: t('bookingEngine.funnel.denied', 'Sans disponibilité'),
      value: data?.deniedSearches,
      color: 'var(--warn)',
      hint: data?.deniedPct != null
        ? t('bookingEngine.funnel.deniedPct', '{{pct}} % des recherches', { pct: data.deniedPct })
        : undefined,
    },
    {
      icon: <Eye size={18} />,
      label: t('bookingEngine.funnel.views', 'Fiches consultées'),
      value: data?.propertyViews,
      color: 'var(--info)',
    },
    {
      icon: <ShoppingCart size={18} />,
      label: t('bookingEngine.funnel.checkouts', 'Checkouts initiés'),
      value: data?.checkoutStarts,
      color: 'var(--accent)',
    },
    {
      icon: <MousePointerClick size={18} />,
      label: t('bookingEngine.funnel.confirmed', 'Réservations directes'),
      value: data?.confirmed,
      color: 'var(--ok)',
      hint: data?.conversionPct != null
        ? t('bookingEngine.funnel.conversionPct', 'Conversion {{pct}} %', { pct: data.conversionPct })
        : undefined,
    },
  ];

  return (
    <div className="p-3 flex flex-col gap-2 max-w-[980px]">
      <div className="flex items-center justify-between">
        <div>
          <h6 className="cn-text-subtitle1 font-semibold">
            {t('bookingEngine.funnel.title', 'Funnel de réservation')}
          </h6>
          <span className="cn-text-caption text-[var(--muted)]">
            {t('bookingEngine.funnel.subtitle',
              'Demande captée par votre moteur de réservation — y compris la demande refusée.')}
          </span>
        </div>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={days}
          onChange={(_, v) => { if (v) setDays(v); }}
        >
          <ToggleButton value={30}>30 j</ToggleButton>
          <ToggleButton value={90}>90 j</ToggleButton>
        </ToggleButtonGroup>
      </div>

      {error && <Alert variant="destructive">
        <TriangleAlert />
        <AlertDescription>{error}</AlertDescription>
      </Alert>}

      <div className="grid grid-cols-[1fr_1fr] min-[900px]:grid-cols-[repeat(5,_1fr)] gap-[7.5px]">
        {steps.map((s) => (
          <StatTile
            key={s.label}
            icon={s.icon}
            label={s.label}
            value={loading || s.value == null ? '—' : s.value.toLocaleString()}
            color={s.color}
            hint={s.hint}
            loading={loading}
          />
        ))}
      </div>

      <Card variant="outlined" sx={{ p: 1.5 }}>
        <h6 className="cn-text-subtitle2 mb-1.5">
          {t('bookingEngine.funnel.topDeniedTitle', 'Séjours demandés sans disponibilité')}
        </h6>
        <span className="cn-text-caption text-[var(--muted)] block mb-1.5">
          {t('bookingEngine.funnel.topDeniedHint',
            'Ces dates ont été recherchées mais aucun logement n’était disponible — un signal pour revoir prix, min-stay ou inventaire.')}
        </span>
        {loading ? (
          <Skeleton variant="rounded" height={160} />
        ) : (data?.topDenied.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CalendarX2 />}
            title={t('bookingEngine.funnel.topDeniedEmpty', 'Aucune demande refusée sur la période')}
            variant="plain"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('bookingEngine.funnel.colCheckIn', 'Arrivée')}</TableHead>
                <TableHead>{t('bookingEngine.funnel.colCheckOut', 'Départ')}</TableHead>
                <TableHead className="text-end">{t('bookingEngine.funnel.colGuests', 'Voyageurs')}</TableHead>
                <TableHead className="text-end">{t('bookingEngine.funnel.colCount', 'Demandes')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.topDenied.map((row) => (
                <TableRow key={`${row.checkIn}-${row.checkOut}-${row.guests}`}>
                  <TableCell className="tabular-nums">{row.checkIn ?? '—'}</TableCell>
                  <TableCell className="tabular-nums">{row.checkOut ?? '—'}</TableCell>
                  <TableCell className="text-end tabular-nums">{row.guests ?? '—'}</TableCell>
                  <TableCell className="text-end tabular-nums font-semibold">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
