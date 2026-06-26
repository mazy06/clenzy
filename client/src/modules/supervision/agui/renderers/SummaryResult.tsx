/* ============================================================
   SummaryResult — displayHint="summary"

   Couvre DEUX formes :
   1) Confirmation d'action d'écriture (create_reservation, create_invoice,
      assign_intervention, cancel_reservation, set_rate_override, …) :
        { id?, message, total?, currency?, nights?, …champs métier }
      → carte de confirmation avec coche, message en avant, montant si présent.
   2) Snapshot KPI dashboard (get_dashboard_summary) :
        { readinessScore, criticalFailed, kpiCount, kpis:[…] }
      → délègue au KpiSummaryResult (réutilisation du rendu KPI).
   ============================================================ */
import React from 'react';
import { Box, Typography } from '@mui/material';
import { Check } from '../../../../icons';
import { SurfaceCard, formatMoney, humanizeKey, humanizeStatus } from './shared';
import { KpiSummaryResult } from './KpiSummaryResult';

type Summary = Record<string, unknown>;

// Champs déjà mis en avant dans l'en-tête → exclus de la grille détail.
const HEADER_KEYS = new Set(['message', 'id', 'total', 'currency', 'status']);
const MONEY_KEYS = new Set(['total', 'amount', 'price']);
const DATE_KEYS = new Set(['checkIn', 'checkOut', 'scheduledDate', 'date']);

function isKpiSnapshot(data: Summary): boolean {
  return Array.isArray(data.kpis) || typeof data.readinessScore === 'number';
}

function detailValue(key: string, value: unknown, currency?: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (MONEY_KEYS.has(key)) return formatMoney(value, typeof currency === 'string' ? currency : undefined);
  if (key === 'status') return humanizeStatus(value);
  if (DATE_KEYS.has(key)) {
    const d = new Date(String(value));
    return Number.isNaN(d.getTime())
      ? String(value)
      : d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export const SummaryResult: React.FC<{ data: Summary }> = ({ data }) => {
  // Forme 2 : snapshot KPI → renderer dédié.
  if (isKpiSnapshot(data)) {
    return <KpiSummaryResult data={data} />;
  }

  // Forme 1 : carte de confirmation d'action.
  const message = typeof data.message === 'string' ? data.message : null;
  const hasTotal = data.total !== null && data.total !== undefined;
  const details = Object.entries(data).filter(
    ([k, v]) => !HEADER_KEYS.has(k) && v !== null && v !== undefined && v !== '',
  );

  return (
    <SurfaceCard sx={{ borderColor: 'var(--ok)' }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box
          sx={{
            flexShrink: 0,
            mt: '1px',
            width: 22,
            height: 22,
            borderRadius: '50%',
            bgcolor: 'var(--ok-soft)',
            color: 'var(--ok)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Check size={14} strokeWidth={2.5} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
            {message ?? 'Action effectuée'}
          </Typography>
          {data.id != null && (
            <Typography sx={{ fontSize: '11px', color: 'var(--faint)', mt: 0.25 }}>
              Réf. #{String(data.id)}
            </Typography>
          )}
        </Box>
        {hasTotal && (
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '16px',
              fontWeight: 600,
              color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {formatMoney(data.total, typeof data.currency === 'string' ? data.currency : undefined)}
          </Typography>
        )}
      </Box>

      {details.length > 0 && (
        <Box
          sx={{
            mt: 1.25,
            pt: 1,
            borderTop: '1px solid var(--line)',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 0.75,
          }}
        >
          {details.map(([key, value]) => (
            <Box key={key} sx={{ display: 'flex', gap: 0.75, alignItems: 'baseline', minWidth: 0 }}>
              <Typography sx={{ color: 'var(--muted)', fontSize: '11px', flexShrink: 0 }}>
                {humanizeKey(key)}
              </Typography>
              <Typography
                sx={{
                  fontSize: '12px',
                  color: 'var(--body)',
                  fontWeight: 500,
                  fontVariantNumeric: 'tabular-nums',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {detailValue(key, value, data.currency)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </SurfaceCard>
  );
};
