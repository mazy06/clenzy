/* ============================================================
   QuoteResult — displayHint="quote"

   Payload backend (get_price_quote) :
     { propertyId, propertyName, from, to, nights, total, currency,
       perNight: [{ date, price }] }
   → carte devis : total en avant, période + nb de nuits, détail
     prix par nuit (replié au-delà de quelques nuits).
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';
import { SurfaceCard, Overline, formatMoney } from './shared';

interface PerNight {
  date: string;
  price: number | string;
}
interface QuoteData {
  propertyName?: string;
  from?: string;
  to?: string;
  nights?: number;
  total?: number | string;
  currency?: string;
  perNight?: PerNight[];
}

function formatRange(from?: string, to?: string): string {
  if (!from || !to) return '';
  const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  const f = new Date(from);
  const t = new Date(to);
  if (Number.isNaN(f.getTime()) || Number.isNaN(t.getTime())) return `${from} → ${to}`;
  return `${f.toLocaleDateString('fr-FR', opts)} → ${t.toLocaleDateString('fr-FR', opts)}`;
}

export const QuoteResult: React.FC<{ data: QuoteData }> = ({ data }) => {
  const perNight = Array.isArray(data.perNight) ? data.perNight : [];
  const nights = data.nights ?? perNight.length;

  return (
    <SurfaceCard sx={{ borderColor: 'var(--accent)' }}>
      {/* En-tête : libellé + total */}
      <Box sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 1.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Overline>Devis{data.propertyName ? ` · ${data.propertyName}` : ''}</Overline>
          <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums', mt: 0.25 }}>
            {formatRange(data.from, data.to)}
            {nights > 0 && ` · ${nights} nuit${nights > 1 ? 's' : ''}`}
          </Typography>
        </Box>
        <Typography
          sx={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.5rem',
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
            fontVariantNumeric: 'tabular-nums',
            whiteSpace: 'nowrap',
          }}
        >
          {formatMoney(data.total, data.currency)}
        </Typography>
      </Box>

      {/* Détail par nuit */}
      {perNight.length > 0 && (
        <Box sx={{ mt: 1.25, pt: 1, borderTop: '1px solid var(--line)' }}>
          {perNight.map((night) => (
            <Box
              key={night.date}
              sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', py: 0.4 }}
            >
              <Typography sx={{ fontSize: '12px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {new Date(night.date).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
              </Typography>
              <Typography
                sx={{ fontSize: '12.5px', color: 'var(--body)', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}
              >
                {formatMoney(night.price, data.currency)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </SurfaceCard>
  );
};
