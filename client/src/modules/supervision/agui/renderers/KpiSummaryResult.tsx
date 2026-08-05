/* ============================================================
   KpiSummaryResult — displayHint="kpi_summary" (et forme KPI de "summary")

   Payload (get_dashboard_summary) :
     { readinessScore?, criticalFailed?, kpiCount?, capturedAt?,
       kpis: [{ id, name, value, target?, status?, critical? }] }
   → gros score readiness + grille de tuiles KPI (pastille de statut,
     valeur display tabular-nums, cible muted).
   ============================================================ */
import React from 'react';
import { cn } from '../../../../utils/cn';

import { Overline } from './shared';

interface Kpi {
  id?: string;
  name?: string;
  value?: string | number;
  target?: string;
  status?: string;
  critical?: boolean;
}

interface KpiData {
  readinessScore?: number;
  criticalFailed?: boolean;
  kpiCount?: number;
  capturedAt?: string;
  kpis?: Kpi[];
}

/** Pastille décorative : teinte vive (elle ne porte pas de texte). */
function statusDotClass(status?: string): string {
  switch ((status ?? '').toUpperCase()) {
    case 'OK':
      return 'bg-success';
    case 'WARNING':
      return 'bg-warning';
    case 'CRITICAL':
      return 'bg-destructive';
    default:
      return 'bg-border';
  }
}

const KpiTile: React.FC<{ kpi: Kpi; idx: number }> = ({ kpi, idx }) => (
  <div className="relative rounded-lg border border-border bg-card px-2 py-1.5">
    <span
      aria-hidden
      className={cn('absolute end-2 top-2 size-1.5 rounded-full', statusDotClass(kpi.status))}
    />
    <Overline className="mb-0.5 truncate pe-2.5">
      {kpi.name ?? kpi.id ?? `KPI ${idx + 1}`}
    </Overline>
    <p className="text-[1.05rem] font-semibold leading-tight tabular-nums text-foreground font-[family-name:var(--font-display)]">
      {kpi.value ?? '—'}
    </p>
    {kpi.target && (
      <p className="mt-0.5 block text-2xs tabular-nums text-muted-foreground">cible {kpi.target}</p>
    )}
  </div>
);

export const KpiSummaryResult: React.FC<{ data: KpiData }> = ({ data }) => {
  const score = typeof data.readinessScore === 'number' ? data.readinessScore : null;
  // Le score backend est une fraction (0–1) ; tolère aussi un pourcentage déjà 0–100.
  const scorePct = score === null ? null : Math.round(score <= 1 ? score * 100 : score);
  const critical = data.criticalFailed === true;
  const kpis = Array.isArray(data.kpis) ? data.kpis : [];

  return (
    <div className="mt-1.5 mb-2">
      {scorePct !== null && (
        <div
          className={cn(
            'mb-2 flex items-baseline gap-2.5 rounded-xl px-3 py-2.5',
            critical ? 'bg-destructive-soft' : 'bg-success-soft',
          )}
        >
          <p
            className={cn(
              'text-[2.25rem] font-semibold leading-none tracking-tight tabular-nums font-[family-name:var(--font-display)]',
              critical ? 'text-destructive-ink' : 'text-success-ink',
            )}
          >
            {scorePct}
            <span className="ms-0.5 text-[1.25rem] font-medium">%</span>
          </p>
          <div>
            <Overline>Readiness score</Overline>
            <p className="text-2xs text-muted-foreground">
              {critical ? 'KPI critique en défaut' : 'Tous les KPI critiques OK'}
              {data.kpiCount !== undefined && ` · ${data.kpiCount} indicateurs`}
            </p>
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5 min-[900px]:grid-cols-3">
          {kpis.map((kpi, idx) => (
            <KpiTile key={kpi.id ?? idx} kpi={kpi} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
};
