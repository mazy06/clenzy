import React from 'react';
import { Box, Typography, useTheme, alpha, Chip } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  TrendingUp as TrendIcon,
  Warning as WarningIcon,
  Lightbulb as RecommendationIcon,
  ReportProblem as AnomalyIcon,
} from '../../../icons';

interface InsightItem {
  /** Type : ANOMALY | TREND | RECOMMENDATION | WARNING */
  type: string;
  /** Severity : LOW | MEDIUM | HIGH | CRITICAL */
  severity: string;
  title: string;
  description: string;
  recommendation?: string;
}

interface InsightsData {
  items?: InsightItem[];
  count?: number;
  propertyId?: number;
  from?: string;
  to?: string;
  title?: string;
}

interface InsightsWidgetProps {
  data: InsightsData;
}

/**
 * Widget de rendu pour {@code displayHint="insights"} — liste d'insights AI
 * strategiques retournes par {@code get_business_insights}.
 *
 * <p>Chaque insight est rendu comme une carte avec :
 * <ul>
 *   <li>Icone selon type (anomalie, tendance, recommandation, warning)</li>
 *   <li>Couleur selon severity (LOW = info, CRITICAL = error)</li>
 *   <li>Titre + description</li>
 *   <li>Recommandation actionnable en bloc separe (si fournie)</li>
 * </ul>
 *
 * <p>Design borderless avec bg tonal — aligne avec la directive design du chat.</p>
 */
export const InsightsWidget: React.FC<InsightsWidgetProps> = ({ data }) => {
  const theme = useTheme();
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 3, borderRadius: 2,
          bgcolor: alpha(theme.palette.success.main, 0.08),
          textAlign: 'center',
        }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.success.dark }}>
            Aucun insight detecte — tout va bien sur cette propriete.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {data.title && (
        <Typography variant="caption" sx={{
          display: 'block', mb: 0.5, fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title}
        </Typography>
      )}

      {items.map((item, idx) => (
        <InsightCard key={`insight-${idx}`} item={item} />
      ))}
    </Box>
  );
};

// ─── InsightCard ──────────────────────────────────────────────────────────

const InsightCard: React.FC<{ item: InsightItem }> = ({ item }) => {
  const theme = useTheme();
  const sevColor = severityColor(item.severity, theme);
  const TypeIcon = typeIcon(item.type);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 2,
        bgcolor: alpha(sevColor, 0.06),
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: 1,
            bgcolor: alpha(sevColor, 0.18),
            color: sevColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: 0.125,
          }}
        >
          <TypeIcon size={16} strokeWidth={2} />
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25, flexWrap: 'wrap' }}>
            <Typography sx={{
              fontSize: '0.875rem', fontWeight: 600, color: theme.palette.text.primary,
              lineHeight: 1.3,
            }}>
              {item.title}
            </Typography>
            <Chip
              label={humanizeSeverity(item.severity)}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.625rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                bgcolor: alpha(sevColor, 0.18),
                color: sevColor,
                border: 'none',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
          <Typography variant="body2" sx={{
            fontSize: '0.8125rem',
            lineHeight: 1.5,
            color: theme.palette.text.secondary,
          }}>
            {item.description}
          </Typography>
        </Box>
      </Box>

      {/* Recommandation actionnable */}
      {item.recommendation && (
        <Box sx={{
          ml: 4.5, // align avec le texte (icone 28px + gap 1)
          mt: 0.75,
          px: 1.25, py: 0.75,
          borderRadius: 1.25,
          bgcolor: alpha(theme.palette.text.primary, 0.045),
        }}>
          <Typography variant="caption" sx={{
            display: 'block',
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: theme.palette.text.secondary,
            mb: 0.25,
          }}>
            Action recommandee
          </Typography>
          <Typography variant="body2" sx={{
            fontSize: '0.8125rem',
            lineHeight: 1.45,
            color: theme.palette.text.primary,
          }}>
            {item.recommendation}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────────────

type LucideIconComponent = React.ComponentType<{
  size?: number | string;
  strokeWidth?: number | string;
}>;

function typeIcon(type: string): LucideIconComponent {
  switch (type?.toUpperCase()) {
    case 'ANOMALY': return AnomalyIcon;
    case 'TREND': return TrendIcon;
    case 'RECOMMENDATION': return RecommendationIcon;
    case 'WARNING': return WarningIcon;
    default: return RecommendationIcon;
  }
}

function severityColor(severity: string, theme: Theme): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return theme.palette.error.main;
    case 'HIGH': return theme.palette.error.light;
    case 'MEDIUM': return theme.palette.warning.main;
    case 'LOW':
    default:
      return theme.palette.info.main;
  }
}

function humanizeSeverity(severity: string): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return 'Critique';
    case 'HIGH': return 'Eleve';
    case 'MEDIUM': return 'Moyen';
    case 'LOW': return 'Faible';
    default: return severity || 'Info';
  }
}
