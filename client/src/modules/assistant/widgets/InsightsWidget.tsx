import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
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
  const items = data.items ?? [];

  if (items.length === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 3, borderRadius: '12px',
          bgcolor: 'var(--ok-soft)',
          textAlign: 'center',
        }}>
          <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--ok)' }}>
            Aucun insight detecte — tout va bien sur cette propriete.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
      {data.title && (
        <Typography sx={{
          display: 'block', mb: 0.5, fontSize: '10.5px', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '.05em',
          color: 'var(--faint)',
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
  const [sevColor, sevSoft] = severityColors(item.severity);
  const TypeIcon = typeIcon(item.type);

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: '12px',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
      }}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mb: 0.75 }}>
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '9px',
            bgcolor: sevSoft,
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
              fontSize: '13.5px', fontWeight: 600, color: 'var(--ink)',
              lineHeight: 1.3,
            }}>
              {item.title}
            </Typography>
            <Chip
              label={humanizeSeverity(item.severity)}
              size="small"
              sx={{
                height: 18,
                fontSize: '10.5px',
                fontWeight: 700,
                letterSpacing: '.04em',
                textTransform: 'uppercase',
                bgcolor: sevSoft,
                color: sevColor,
                border: 'none',
                '& .MuiChip-label': { px: 0.75 },
              }}
            />
          </Box>
          <Typography sx={{
            fontSize: '12.5px',
            lineHeight: 1.5,
            color: 'var(--muted)',
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
          borderRadius: '9px',
          bgcolor: 'var(--field)',
        }}>
          <Typography sx={{
            display: 'block',
            fontSize: '10.5px',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            color: 'var(--faint)',
            mb: 0.25,
          }}>
            Action recommandee
          </Typography>
          <Typography sx={{
            fontSize: '12.5px',
            lineHeight: 1.45,
            color: 'var(--body)',
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

function severityColors(severity: string): [string, string] {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL': return ['var(--err)', 'var(--err-soft)'];
    case 'HIGH': return ['var(--err)', 'var(--err-soft)'];
    case 'MEDIUM': return ['var(--warn)', 'var(--warn-soft)'];
    case 'LOW':
    default:
      return ['var(--info)', 'var(--info-soft)'];
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
