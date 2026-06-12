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
    <Box sx={{ mt: 1, mb: 1.5 }}>
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
            <Box component="span" sx={{ fontSize: '1.25rem', fontWeight: 500, ml: 0.25 }}>
              %
            </Box>
          </Typography>
          <Box>
            <Typography sx={{
              display: 'block', fontWeight: 700, color: 'var(--faint)',
              fontSize: '10.5px', textTransform: 'uppercase', letterSpacing: '.06em',
            }}>
              Readiness score
            </Typography>
            <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>
              {critical ? 'KPI critique en defaut' : 'Tous les KPI critiques OK'}
              {data.kpiCount !== undefined && ` · ${data.kpiCount} indicateurs`}
            </Typography>
          </Box>
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
    </Box>
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
      <Typography
        sx={{
          display: 'block',
          color: 'var(--faint)',
          fontSize: '10.5px',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          mb: 0.25,
          pr: 1.5,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {kpi.name}
      </Typography>
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
        {kpi.value}
      </Typography>
      {kpi.target && (
        <Typography
          sx={{
            display: 'block',
            color: 'var(--muted)',
            fontSize: '10.5px',
            mt: 0.25,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          cible {kpi.target}
        </Typography>
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
