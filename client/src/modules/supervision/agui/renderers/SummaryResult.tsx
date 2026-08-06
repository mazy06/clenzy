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
    <SurfaceCard className="border-success">
      <div className="flex items-start gap-2">
        <span className="mt-px inline-flex size-[22px] shrink-0 items-center justify-center rounded-full bg-success-soft text-success-ink">
          <Check size={14} strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-balance text-foreground">
            {message ?? 'Action effectuée'}
          </p>
          {data.id != null && (
            <p className="mt-0.5 text-2xs tabular-nums text-muted-foreground">
              Réf. #{String(data.id)}
            </p>
          )}
        </div>
        {hasTotal && (
          <p className="whitespace-nowrap text-base font-semibold tabular-nums text-foreground font-[family-name:var(--font-display)]">
            {formatMoney(data.total, typeof data.currency === 'string' ? data.currency : undefined)}
          </p>
        )}
      </div>

      {details.length > 0 && (
        <dl className="m-0 mt-2 grid grid-cols-1 gap-1 border-t border-border pt-1.5 min-[600px]:grid-cols-2">
          {details.map(([key, value]) => (
            <div className="flex min-w-0 items-baseline gap-1" key={key}>
              <dt className="shrink-0 text-2xs text-muted-foreground">{humanizeKey(key)}</dt>
              <dd className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-xs font-medium tabular-nums text-foreground">
                {detailValue(key, value, data.currency)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SurfaceCard>
  );
};
