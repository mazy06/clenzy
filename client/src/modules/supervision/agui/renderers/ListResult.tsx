/* ============================================================
   ListResult — displayHint="list"

   Payload backend (list_reservations, list_properties, list_invoices,
   list_reviews, list_guests, get_owner_payout_summary, …) :
     { items: [...], count, totalMatching?, truncated?, from?, to? }
   Les items ont des clés variables → on dérive 2–4 colonnes depuis le
   1er item (en sautant les *Id techniques) et on rend une liste compacte.
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';
import {
  SurfaceCard,
  Overline,
  StatusChip,
  formatDateShort,
  formatMoney,
  humanizeKey,
  humanizeStatus,
  statusTone,
} from './shared';

type Item = Record<string, unknown>;

interface ListData {
  items?: Item[];
  count?: number;
  totalMatching?: number;
  totalElements?: number;
  truncated?: boolean;
  from?: string;
  to?: string;
}

const MAX_ROWS = 8;
const DATE_KEYS = new Set(['checkIn', 'checkOut', 'scheduledDate', 'date', 'dueDate', 'issuedAt']);
const MONEY_KEYS = new Set(['totalPrice', 'amount', 'total', 'payout', 'price']);

/** Dérive jusqu'à 4 clés d'affichage depuis le 1er item (saute id/*Id/createdAt). */
function deriveColumns(sample: Item | undefined): string[] {
  if (!sample) return [];
  return Object.keys(sample)
    .filter((k) => k !== 'id' && k !== 'createdAt' && !k.endsWith('Id'))
    .slice(0, 4);
}

function renderCell(key: string, value: unknown, currency?: unknown): React.ReactNode {
  if (value === null || value === undefined || value === '') return '—';
  if (key === 'status') return <StatusChip label={humanizeStatus(value)} tone={statusTone(value)} />;
  if (DATE_KEYS.has(key)) return formatDateShort(value);
  if (MONEY_KEYS.has(key)) return formatMoney(value, typeof currency === 'string' ? currency : undefined);
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const ListResult: React.FC<{ data: ListData }> = ({ data }) => {
  const items = Array.isArray(data.items) ? data.items : [];
  const columns = deriveColumns(items[0]);
  const visible = items.slice(0, MAX_ROWS);
  const totalKnown = data.totalMatching ?? data.totalElements ?? items.length;
  const hidden = Math.max(totalKnown - visible.length, items.length - visible.length);

  if (items.length === 0) {
    return (
      <SurfaceCard sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '12.5px', color: 'var(--muted)' }}>
          Aucun résultat
          {data.from && data.to && ` du ${formatDateShort(data.from)} au ${formatDateShort(data.to)}`}.
        </Typography>
      </SurfaceCard>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {data.from && data.to && (
        <Typography
          sx={{ display: 'block', mb: 0.75, fontSize: '11.5px', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}
        >
          Période : {formatDateShort(data.from)} → {formatDateShort(data.to)}
        </Typography>
      )}

      <Box sx={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
        {/* En-têtes */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
            gap: 1,
            px: 1.5,
            py: 0.75,
            bgcolor: 'var(--surface-2)',
            borderBottom: '1px solid var(--line)',
          }}
        >
          {columns.map((col) => (
            <Overline key={col} sx={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {humanizeKey(col)}
            </Overline>
          ))}
        </Box>

        {/* Lignes */}
        {visible.map((item, idx) => (
          <Box
            key={String(item.id ?? idx)}
            sx={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
              gap: 1,
              px: 1.5,
              py: 1,
              alignItems: 'center',
              borderTop: idx > 0 ? '1px solid var(--line)' : 'none',
              transition: 'background .12s',
              '&:hover': { bgcolor: 'var(--hover)' },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            {columns.map((col) => (
              <Typography
                key={col}
                component="div"
                sx={{
                  fontSize: '12.5px',
                  color: 'var(--body)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {renderCell(col, item[col], item.currency)}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>

      {hidden > 0 && (
        <Typography sx={{ display: 'block', mt: 0.75, fontSize: '11.5px', color: 'var(--muted)', fontStyle: 'italic' }}>
          + {hidden} de plus
        </Typography>
      )}
    </Box>
  );
};
