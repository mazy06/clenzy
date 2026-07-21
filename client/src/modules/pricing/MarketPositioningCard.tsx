import React from 'react';
import { Box, Chip, Paper, Skeleton, Tooltip, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Remove as Minus, Info } from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import { marketPositioningApi, type MarketPositioning } from '../../services/api/marketPositioningApi';

const NUM_SX = { fontVariantNumeric: 'tabular-nums' } as const;

const SOURCE_LABEL: Record<string, string> = {
  FIRST_PARTY: 'Réseau Baitly',
  OPEN_DATA: 'Open data',
  AIRBTICS: 'Airbtics',
  AIRROI: 'AirROI',
};

/**
 * Carte « double signal » (roadmap market data) : le RÉALISÉ du bien (prix publié
 * moyen, occupation à venir) face au MARCHÉ de sa zone, avec la provenance et la
 * confiance de la source — jamais un chiffre marché présenté comme sûr sans son
 * indice. Lecture seule ; alimente la décision tarifaire sans rien appliquer.
 */
const MarketPositioningCard: React.FC<{ propertyId: number }> = ({ propertyId }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['market-positioning', propertyId],
    queryFn: () => marketPositioningApi.get(propertyId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <Skeleton variant="rounded" height={92} sx={{ borderRadius: '12px' }} />;
  }
  if (isError || !data) {
    return null; // signal complémentaire : on ne bloque jamais l'écran de pricing
  }

  const money = (v: number | null) =>
    v == null ? '—' : `${Math.round(v).toLocaleString()} ${data.currency ?? ''}`.trim();
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v)} %`);

  const noMarket = data.positioning === 'NO_MARKET_DATA';
  const color = noMarket
    ? 'var(--muted)'
    : data.positioning === 'UNDERPRICED'
      ? 'var(--ok)'
      : data.positioning === 'OVERPRICED'
        ? 'var(--warn)'
        : 'var(--accent)';
  const Icon = data.positioning === 'UNDERPRICED'
    ? TrendingUp
    : data.positioning === 'OVERPRICED'
      ? TrendingDown
      : Minus;
  const label = noMarket
    ? t('marketPositioning.noData', 'Pas de données marché')
    : data.positioning === 'UNDERPRICED'
      ? t('marketPositioning.underpriced', 'Sous le marché')
      : data.positioning === 'OVERPRICED'
        ? t('marketPositioning.overpriced', 'Au-dessus du marché')
        : t('marketPositioning.aligned', 'Aligné sur le marché');

  return (
    <Paper variant="outlined" sx={{ p: 1.75, borderRadius: '12px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.25, flexWrap: 'wrap' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
          {t('marketPositioning.title', 'Positionnement marché')}
          {data.area ? ` — ${data.area}` : ''}
        </Typography>
        <Chip
          size="small"
          icon={<Icon size={14} />}
          label={label}
          sx={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 8%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
            fontWeight: 600,
            '& .MuiChip-icon': { color: `${color} !important` },
          }}
        />
        {!noMarket && data.source && (
          <Tooltip
            title={t('marketPositioning.sourceHint',
              'Provenance et fiabilité de la donnée marché. Le « réseau Baitly » est votre réalisé, jamais présenté comme le marché entier.')}
          >
            <Chip
              size="small"
              variant="outlined"
              icon={<Info size={13} />}
              label={`${SOURCE_LABEL[data.source] ?? data.source} · ${
                data.confidence != null ? `${Math.round(data.confidence * 100)} %` : '—'}`}
              sx={{ color: 'var(--muted)', borderColor: 'var(--line)' }}
            />
          </Tooltip>
        )}
      </Box>

      {/* Double signal : votre bien vs marché */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        <SignalBlock
          label={t('marketPositioning.yourProperty', 'Votre logement')}
          adr={money(data.propertyAdr)}
          occ={pct(data.propertyOccupancyPct)}
          adrLabel={t('marketPositioning.adr', 'ADR')}
          occLabel={t('marketPositioning.occupancy', 'Occupation')}
        />
        <SignalBlock
          label={t('marketPositioning.market', 'Marché de la zone')}
          adr={money(data.marketAdr)}
          occ={pct(data.marketOccupancyPct)}
          adrLabel={t('marketPositioning.adr', 'ADR')}
          occLabel={t('marketPositioning.occupancy', 'Occupation')}
          muted
        />
      </Box>

      <Typography variant="caption" sx={{ color: 'var(--muted)', display: 'block', mt: 1 }}>
        {data.headline}
      </Typography>
    </Paper>
  );
};

const SignalBlock: React.FC<{
  label: string;
  adr: string;
  occ: string;
  adrLabel: string;
  occLabel: string;
  muted?: boolean;
}> = ({ label, adr, occ, adrLabel, occLabel, muted }) => (
  <Box
    sx={{
      p: 1.25,
      borderRadius: '8px',
      backgroundColor: muted ? 'transparent' : 'color-mix(in srgb, var(--accent) 5%, transparent)',
      border: '1px solid var(--line)',
    }}
  >
    <Typography variant="caption" sx={{ color: 'var(--muted)', display: 'block', mb: 0.5 }}>
      {label}
    </Typography>
    <Box sx={{ display: 'flex', gap: 2 }}>
      <Box>
        <Typography variant="caption" sx={{ color: 'var(--muted)' }}>{adrLabel}</Typography>
        <Typography sx={{ ...NUM_SX, fontWeight: 700 }}>{adr}</Typography>
      </Box>
      <Box>
        <Typography variant="caption" sx={{ color: 'var(--muted)' }}>{occLabel}</Typography>
        <Typography sx={{ ...NUM_SX, fontWeight: 700 }}>{occ}</Typography>
      </Box>
    </Box>
  </Box>
);

export default MarketPositioningCard;
