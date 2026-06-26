/* ============================================================
   DetailsResult — displayHint="details"

   Payload backend (get_reservation_details, get_property_details,
   get_billing_overview) : un objet plat clé/valeur.
   Rendu en liste de paires lisibles, avec mise en forme spéciale
   pour status / dates / montants, et un titre dérivé du nom métier.
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  SurfaceCard,
  StatusChip,
  formatMoney,
  humanizeKey,
  humanizeStatus,
  statusTone,
} from './shared';

type Details = Record<string, unknown>;

const DATE_KEYS = new Set(['checkIn', 'checkOut', 'scheduledDate', 'date', 'dueDate', 'issuedAt']);
const MONEY_KEYS = new Set(['totalPrice', 'amount', 'total', 'price', 'balance', 'paidAmount']);
// Clés utilisées pour le titre / sous-titre plutôt que dans la grille.
const TITLE_KEYS = ['name', 'propertyName', 'guestName', 'title'];
const SKIP_KEYS = new Set(['id']);

function formatValue(key: string, value: unknown, currency?: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status' || key === 'paymentStatus') {
    return <StatusChip label={humanizeStatus(value)} tone={statusTone(value)} />;
  }
  if (DATE_KEYS.has(key)) {
    return new Date(String(value)).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
  if (MONEY_KEYS.has(key)) {
    return formatMoney(value, typeof currency === 'string' ? currency : undefined);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const DetailsResult: React.FC<{ data: Details }> = ({ data }) => {
  const titleKey = TITLE_KEYS.find((k) => typeof data[k] === 'string' && data[k] !== '');
  const title = titleKey ? String(data[titleKey]) : data.id != null ? `#${String(data.id)}` : 'Détail';

  const entries = Object.entries(data).filter(
    ([k, v]) =>
      !SKIP_KEYS.has(k) &&
      k !== titleKey &&
      v !== null &&
      v !== undefined &&
      v !== '' &&
      k !== 'currency',
  );

  return (
    <SurfaceCard>
      <Typography
        sx={{
          fontFamily: 'var(--font-display)',
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--ink)',
          mb: 1,
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {entries.map(([key, value], idx) => (
          <Box
            key={key}
            sx={{
              display: 'flex',
              gap: 1.5,
              py: 0.75,
              alignItems: 'baseline',
              borderTop: idx > 0 ? '1px solid var(--line)' : 'none',
            }}
          >
            <Typography
              sx={{ flex: '0 0 38%', color: 'var(--muted)', fontSize: '11.5px', fontWeight: 500 }}
            >
              {humanizeKey(key)}
            </Typography>
            <Typography
              component="div"
              sx={{
                flex: 1,
                fontSize: '12.5px',
                color: 'var(--body)',
                fontWeight: 500,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatValue(key, value, data.currency)}
            </Typography>
          </Box>
        ))}
      </Box>
    </SurfaceCard>
  );
};
