import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { CalendarX2, Eye, MousePointerClick, Search, ShoppingCart } from 'lucide-react';
import StatTile from '../../../../components/StatTile';
import EmptyState from '../../../../components/EmptyState';
import { useTranslation } from '../../../../hooks/useTranslation';
import { funnelApi, type FunnelAnalytics } from '../../../../services/api/funnelApi';

const NUM_SX = { fontVariantNumeric: 'tabular-nums' } as const;

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
    <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, maxWidth: 980 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {t('bookingEngine.funnel.title', 'Funnel de réservation')}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--muted)' }}>
            {t('bookingEngine.funnel.subtitle',
              'Demande captée par votre moteur de réservation — y compris la demande refusée.')}
          </Typography>
        </Box>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={days}
          onChange={(_, v) => { if (v) setDays(v); }}
        >
          <ToggleButton value={30}>30 j</ToggleButton>
          <ToggleButton value={90}>90 j</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {error && <Alert severity="error">{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' }, gap: 1.25 }}>
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
      </Box>

      <Card variant="outlined" sx={{ p: 1.5 }}>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('bookingEngine.funnel.topDeniedTitle', 'Séjours demandés sans disponibilité')}
        </Typography>
        <Typography variant="caption" sx={{ color: 'var(--muted)', display: 'block', mb: 1 }}>
          {t('bookingEngine.funnel.topDeniedHint',
            'Ces dates ont été recherchées mais aucun logement n’était disponible — un signal pour revoir prix, min-stay ou inventaire.')}
        </Typography>
        {loading ? (
          <Skeleton variant="rounded" height={160} />
        ) : (data?.topDenied.length ?? 0) === 0 ? (
          <EmptyState
            icon={<CalendarX2 />}
            title={t('bookingEngine.funnel.topDeniedEmpty', 'Aucune demande refusée sur la période')}
            variant="plain"
          />
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{t('bookingEngine.funnel.colCheckIn', 'Arrivée')}</TableCell>
                <TableCell>{t('bookingEngine.funnel.colCheckOut', 'Départ')}</TableCell>
                <TableCell align="right">{t('bookingEngine.funnel.colGuests', 'Voyageurs')}</TableCell>
                <TableCell align="right">{t('bookingEngine.funnel.colCount', 'Demandes')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data?.topDenied.map((row) => (
                <TableRow key={`${row.checkIn}-${row.checkOut}-${row.guests}`} hover>
                  <TableCell sx={NUM_SX}>{row.checkIn ?? '—'}</TableCell>
                  <TableCell sx={NUM_SX}>{row.checkOut ?? '—'}</TableCell>
                  <TableCell align="right" sx={NUM_SX}>{row.guests ?? '—'}</TableCell>
                  <TableCell align="right" sx={{ ...NUM_SX, fontWeight: 600 }}>{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Box>
  );
}
