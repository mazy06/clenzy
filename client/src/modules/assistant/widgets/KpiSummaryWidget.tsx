import React from 'react';
import { Box, Typography } from '@mui/material';

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
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1.5,
            mb: 2,
            px: 2,
            py: 1.75,
            borderRadius: '12px',
            bgcolor: critical ? 'var(--err-soft)' : 'var(--accent-soft)',
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
        </Box>
      )}

      {/* Grille KPI : 2 colonnes sur mobile, 3 sur desktop */}
      {kpis.length > 0 && (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 1,
          }}
        >
          {kpis.map((kpi) => (
            <KpiTile key={kpi.id} kpi={kpi} />
          ))}
        </Box>
      )}
    </div>
  );
};

const KpiTile: React.FC<{ kpi: NonNullable<KpiSummaryData['kpis']>[number] }> = ({ kpi }) => {
  const statusColor = statusToColor(kpi.status);

  return (
    <Box
      sx={{
        position: 'relative',
        px: 1.25,
        py: 1,
        borderRadius: '10px',
        bgcolor: 'var(--card)',
        border: '1px solid var(--line)',
        // Pastille status en haut-droite, pas de border-stripe
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 8,
          right: 8,
          width: 6,
          height: 6,
          borderRadius: '50%',
          bgcolor: statusColor,
        },
      }}
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
    </Box>
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
