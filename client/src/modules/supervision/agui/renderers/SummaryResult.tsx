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
import { Box } from '@mui/material';
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
      <div className="flex items-start gap-1.5">
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
        <div className="min-w-0 flex-1">
          <p className="cn-text-body1 text-[13px] font-semibold text-[var(--ink)] leading-[1.4]">
            {message ?? 'Action effectuée'}
          </p>
          {data.id != null && (
            <p className="cn-text-body1 text-[11px] text-[var(--faint)] mt-0.5">
              Réf. #{String(data.id)}
            </p>
          )}
        </div>
        {hasTotal && (
          <p className="cn-text-body1 font-[var(--font-display)] text-[16px] font-semibold text-[var(--ink)] tabular-nums whitespace-nowrap">
            {formatMoney(data.total, typeof data.currency === 'string' ? data.currency : undefined)}
          </p>
        )}
      </div>

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
            <div className="flex gap-1 items-baseline min-w-0" key={key}>
              <p className="cn-text-body1 text-[var(--muted)] text-[11px] shrink-0">
                {humanizeKey(key)}
              </p>
              <p className="cn-text-body1 text-[12px] text-[var(--body)] font-medium tabular-nums overflow-hidden text-ellipsis whitespace-nowrap">
                {detailValue(key, value, data.currency)}
              </p>
            </div>
          ))}
        </Box>
      )}
    </SurfaceCard>
  );
};
