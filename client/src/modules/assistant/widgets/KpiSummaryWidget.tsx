import React from 'react';
import { cn } from '../../../utils/cn';
import { Typography } from '@mui/material';

/**
 * Donnees attendues par {@link KpiSummaryWidget}, alignees avec le tool
 * backend {@code get_dashboard_summary}.
 */
interface KpiSummaryData {
  readinessScore?: number;
  criticalFailed?: boolean;
  capturedAt?: string;
  kpiCount?: number;
  kpis?: Array<{
    id: string;
    name: string;
    value: string;
    target?: string;
    status?: 'OK' | 'WARNING' | 'CRITICAL' | string;
    critical?: boolean;
  }>;
}

interface KpiSummaryWidgetProps {
  data: KpiSummaryData;
}

/**
 * Widget de rendu pour {@code displayHint="summary"} — snapshot KPI dashboard.
 *
 * <p>Affiche un score de readiness en grand + une grille de tiles KPI (id,
 * nom, valeur formattee, target, indicateur status). Pattern StatTile
 * « Signature » : carte plate hairline, valeur display tabular-nums,
 * label overline.</p>
 */
export const KpiSummaryWidget: React.FC<KpiSummaryWidgetProps> = ({ data }) => {
  const score = typeof data.readinessScore === 'number' ? data.readinessScore : null;
  const scorePct = score !== null ? Math.round(score * 100) : null;
  const critical = data.criticalFailed === true;
  const kpis = data.kpis ?? [];

  return (
    <div className="mt-1.5 mb-2">
      {/* Score header — gros chiffre display + statut */}
      {scorePct !== null && (
        <div className={cn('flex items-baseline gap-[9px] mb-3 px-3 py-[10.5px] rounded-[12px]', critical ? 'bg-[var(--err-soft)]' : 'bg-[var(--accent-soft)]')}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.25rem',
              fontWeight: 600,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: critical ? 'var(--err)' : 'var(--accent)',
            }}
          >
            {scorePct}
            <span className="text-[1.25rem] font-medium ms-0.5">
              %
            </span>
          </Typography>
          <div>
            <p className="cn-text-body1 block font-bold text-[var(--faint)] text-[10.5px] uppercase tracking-[.06em]">
              Readiness score
            </p>
            <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">
              {critical ? 'KPI critique en defaut' : 'Tous les KPI critiques OK'}
              {data.kpiCount !== undefined && ` · ${data.kpiCount} indicateurs`}
            </p>
          </div>
        </div>
      )}

      {/* Grille KPI : 2 colonnes sur mobile, 3 sur desktop */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] gap-1.5">
          {kpis.map((kpi) => (
            <KpiTile key={kpi.id} kpi={kpi} />
          ))}
        </div>
      )}
    </div>
  );
};

const KpiTile: React.FC<{ kpi: NonNullable<KpiSummaryData['kpis']>[number] }> = ({ kpi }) => {
  const statusColor = statusToColor(kpi.status);

  // La couleur de pastille est calculee a l'execution : elle passe par une custom
  // property inline, car une classe Tailwind ne peut pas naitre d'une variable.
  return (
    <div
      className="relative px-[7.5px] py-1.5 rounded-[10px] bg-[var(--card)] border border-solid border-[var(--line)] before:content-[''] before:absolute before:top-2 before:right-2 before:w-1.5 before:h-1.5 before:rounded-full before:bg-[var(--kpi-dot)]"
      style={{ '--kpi-dot': statusColor } as React.CSSProperties}
    >
      <p className="cn-text-body1 block text-[var(--faint)] text-[10.5px] font-bold uppercase tracking-[.05em] mb-0.5 pe-2 whitespace-nowrap overflow-hidden text-ellipsis">
        {kpi.name}
      </p>
      <p className="cn-text-body1 font-[var(--font-display)] text-[1.05rem] font-semibold leading-[1.2] tabular-nums text-[var(--ink)]">
        {kpi.value}
      </p>
      {kpi.target && (
        <p className="cn-text-body1 block text-[var(--muted)] text-[10.5px] mt-0.5 tabular-nums">
          cible {kpi.target}
        </p>
      )}
    </div>
  );
};

function statusToColor(status: string | undefined): string {
  switch (status) {
    case 'OK': return 'var(--ok)';
    case 'WARNING': return 'var(--warn)';
    case 'CRITICAL': return 'var(--err)';
    default: return 'var(--line-2)';
  }
}
