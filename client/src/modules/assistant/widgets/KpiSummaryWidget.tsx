import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import type { Theme } from '@mui/material/styles';

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
 * nom, valeur formattee, target, indicateur status). Design borderless, bg
 * tonal, conforme au registre product de Clenzy.</p>
 */
export const KpiSummaryWidget: React.FC<KpiSummaryWidgetProps> = ({ data }) => {
  const theme = useTheme();
  const score = typeof data.readinessScore === 'number' ? data.readinessScore : null;
  const scorePct = score !== null ? Math.round(score * 100) : null;
  const critical = data.criticalFailed === true;
  const kpis = data.kpis ?? [];

  return (
    <Box sx={{ mt: 1, mb: 1.5 }}>
      {/* Score header — gros chiffre + statut */}
      {scorePct !== null && (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 1.5,
            mb: 2,
            px: 2,
            py: 1.75,
            borderRadius: 2,
            bgcolor: critical
              ? alpha(theme.palette.error.main, 0.08)
              : alpha(theme.palette.primary.main, 0.06),
          }}
        >
          <Typography
            sx={{
              fontSize: '2.25rem',
              fontWeight: 700,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
              color: critical ? theme.palette.error.dark : theme.palette.primary.dark,
            }}
          >
            {scorePct}
            <Box component="span" sx={{ fontSize: '1.25rem', fontWeight: 500, ml: 0.25 }}>
              %
            </Box>
          </Typography>
          <Box>
            <Typography variant="caption" sx={{
              display: 'block', fontWeight: 600, color: theme.palette.text.primary,
              textTransform: 'uppercase', letterSpacing: 0.4,
            }}>
              Readiness score
            </Typography>
            <Typography variant="caption" color="text.secondary">
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
  const theme = useTheme();
  const statusColor = statusToColor(kpi.status, theme);

  return (
    <Box
      sx={{
        position: 'relative',
        px: 1.25,
        py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.text.primary, 0.035),
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
        variant="caption"
        sx={{
          display: 'block',
          color: theme.palette.text.secondary,
          fontSize: '0.7rem',
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
          fontSize: '1.05rem',
          fontWeight: 600,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: theme.palette.text.primary,
        }}
      >
        {kpi.value}
      </Typography>
      {kpi.target && (
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            color: theme.palette.text.disabled,
            fontSize: '0.65rem',
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

function statusToColor(status: string | undefined, theme: Theme): string {
  switch (status) {
    case 'OK': return theme.palette.success.main;
    case 'WARNING': return theme.palette.warning.main;
    case 'CRITICAL': return theme.palette.error.main;
    default: return theme.palette.text.disabled;
  }
}
