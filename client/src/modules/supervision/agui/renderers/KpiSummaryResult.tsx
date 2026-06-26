/* ============================================================
   KpiSummaryResult — displayHint="kpi_summary" (et forme KPI de "summary")

   Payload (get_dashboard_summary) :
     { readinessScore?, criticalFailed?, kpiCount?, capturedAt?,
       kpis: [{ id, name, value, target?, status?, critical? }] }
   → gros score readiness + grille de tuiles KPI (pastille de statut,
     valeur display tabular-nums, cible muted).
   ============================================================ */
import React from 'react';
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
    <Typography
      sx={{
        fontFamily: 'var(--font-display)',
        fontSize: '1.05rem',
        fontWeight: 600,
        lineHeight: 1.2,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--ink)',
      }}
    >
      {kpi.value ?? '—'}
    </Typography>
    {kpi.target && (
      <Typography sx={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', mt: 0.25, fontVariantNumeric: 'tabular-nums' }}>
        cible {kpi.target}
      </Typography>
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
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {scorePct !== null && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1.5,
            mb: 1.5,
            px: 2,
            py: 1.75,
            borderRadius: '12px',
            bgcolor: critical ? 'var(--err-soft)' : 'var(--ok-soft)',
          }}
        >
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
            <Box component="span" sx={{ fontSize: '1.25rem', fontWeight: 500, ml: 0.25 }}>
              %
            </Box>
          </Typography>
          <Box>
            <Overline>Readiness score</Overline>
            <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>
              {critical ? 'KPI critique en défaut' : 'Tous les KPI critiques OK'}
              {data.kpiCount !== undefined && ` · ${data.kpiCount} indicateurs`}
            </Typography>
          </Box>
        </Box>
      )}

      {kpis.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
          }}
        >
          {kpis.map((kpi, idx) => (
            <KpiTile key={kpi.id ?? idx} kpi={kpi} idx={idx} />
          ))}
        </Box>
      )}
    </Box>
  );
};
