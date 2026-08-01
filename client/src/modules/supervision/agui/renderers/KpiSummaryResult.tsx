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
import { Box, Typography } from '@mui/material';
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

function statusColor(status?: string): string {
  switch ((status ?? '').toUpperCase()) {
    case 'OK':
      return 'var(--ok)';
    case 'WARNING':
      return 'var(--warn)';
    case 'CRITICAL':
      return 'var(--err)';
    default:
      return 'var(--line-2)';
  }
}

const KpiTile: React.FC<{ kpi: Kpi; idx: number }> = ({ kpi, idx }) => (
  <Box
    sx={{
      position: 'relative',
      px: 1.25,
      py: 1,
      borderRadius: '10px',
      bgcolor: 'var(--card)',
      border: '1px solid var(--line)',
      '&::before': {
        content: '""',
        position: 'absolute',
        top: 8,
        right: 8,
        width: 6,
        height: 6,
        borderRadius: '50%',
        bgcolor: statusColor(kpi.status),
      },
    }}
  >
    <Overline
      sx={{
        mb: 0.25,
        pr: 1.5,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}
    >
      {kpi.name ?? kpi.id ?? `KPI ${idx + 1}`}
    </Overline>
    <p className="cn-text-body1 font-[var(--font-display)] text-[1.05rem] font-semibold leading-[1.2] tabular-nums text-[var(--ink)]">
      {kpi.value ?? '—'}
    </p>
    {kpi.target && (
      <p className="cn-text-body1 block text-[var(--muted)] text-[10.5px] mt-0.5 tabular-nums">
        cible {kpi.target}
      </p>
    )}
  </Box>
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
        <div className={cn('flex items-baseline gap-[9px] mb-[9px] px-3 py-[10.5px] rounded-[12px]', critical ? 'bg-[var(--err-soft)]' : 'bg-[var(--ok-soft)]')}>
          <Typography
            sx={{
              fontFamily: 'var(--font-display)',
              fontSize: '2.25rem',
              fontWeight: 600,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: critical ? 'var(--err)' : 'var(--ok)',
            }}
          >
            {scorePct}
            <span className="text-[1.25rem] font-medium ms-0.5">
              %
            </span>
          </Typography>
          <div>
            <Overline>Readiness score</Overline>
            <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">
              {critical ? 'KPI critique en défaut' : 'Tous les KPI critiques OK'}
              {data.kpiCount !== undefined && ` · ${data.kpiCount} indicateurs`}
            </p>
          </div>
        </div>
      )}

      {kpis.length > 0 && (
        <div className="grid grid-cols-[repeat(2,_1fr)] min-[900px]:grid-cols-[repeat(3,_1fr)] gap-1.5">
          {kpis.map((kpi, idx) => (
            <KpiTile key={kpi.id ?? idx} kpi={kpi} idx={idx} />
          ))}
        </div>
      )}
    </div>
  );
};
