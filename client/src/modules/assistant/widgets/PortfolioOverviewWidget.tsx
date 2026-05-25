import React from 'react';
import { Box, Typography, useTheme, alpha, Chip, LinearProgress } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import {
  TrendingUp as TrendUpIcon,
  TrendingDown as TrendDownIcon,
  LocationCity as CityIcon,
  Warning as WarningIcon,
} from '../../../icons';

interface TopPerformer {
  id: number;
  name: string;
  city?: string;
  revenue: number;
  occupancy: number; // 0..1
  reservations: number;
}

interface UnderPerformer {
  id: number;
  name: string;
  city?: string;
  occupancy: number; // 0..1
  reservations: number;
  reason: string;
  recommendation: string;
}

interface Pattern {
  type: string;
  severity: string; // LOW | MEDIUM | HIGH | CRITICAL
  title: string;
  description: string;
  items?: string[];
}

interface PortfolioOverviewData {
  title?: string;
  daysBack?: number;
  from?: string;
  to?: string;
  totalProperties?: number;
  activeProperties?: number;
  totalRevenue?: number;
  avgOccupancy?: number; // 0..1
  avgADR?: number;
  topPerformers?: TopPerformer[];
  underPerformers?: UnderPerformer[];
  patterns?: Pattern[];
}

interface PortfolioOverviewWidgetProps {
  data: PortfolioOverviewData;
}

/**
 * Widget de rendu pour {@code displayHint="portfolio_overview"} — vue d'ensemble
 * cross-property generee par le tool {@code analyze_portfolio}.
 *
 * <p>Trois sections empilees verticalement :
 * <ol>
 *   <li>4 stat tiles : totalProperties / totalRevenue / avgOccupancy / avgADR</li>
 *   <li>Top performers : 3 cartes compactes avec barre d'occupation</li>
 *   <li>Sous-performants : liste avec raison + recommandation inline</li>
 *   <li>Patterns detectes : items avec icone par type + chip severity</li>
 * </ol>
 *
 * <p>Borderless, bg tonal, aligne au reste du chat.</p>
 */
export const PortfolioOverviewWidget: React.FC<PortfolioOverviewWidgetProps> = ({ data }) => {
  const theme = useTheme();

  const total = data.totalProperties ?? 0;
  const active = data.activeProperties ?? 0;
  const revenue = data.totalRevenue ?? 0;
  const occupancy = data.avgOccupancy ?? 0;
  const adr = data.avgADR ?? 0;
  const topPerformers = data.topPerformers ?? [];
  const underPerformers = data.underPerformers ?? [];
  const patterns = data.patterns ?? [];

  if (total === 0) {
    return (
      <Box sx={{ mt: 1, mb: 1.5 }}>
        <Box sx={{
          p: 3, borderRadius: 2,
          bgcolor: alpha(theme.palette.warning.main, 0.08),
          textAlign: 'center',
        }}>
          <Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.warning.dark }}>
            Aucune propriete dans le portefeuille — ajoute-en une pour commencer.
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ mt: 1, mb: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {data.title && (
        <Typography variant="caption" sx={{
          display: 'block', fontSize: '0.7rem', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.04em',
          color: theme.palette.text.secondary,
        }}>
          {data.title}
        </Typography>
      )}

      {/* Section 1 : 4 stat tiles */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
          gap: 1,
        }}
      >
        <StatTile
          label="Proprietes"
          value={String(total)}
          hint={active === total ? `${active} actives` : `${active}/${total} actives`}
        />
        <StatTile
          label="Revenus"
          value={formatCurrency(revenue)}
          hint={`${data.daysBack ?? 30}j`}
        />
        <StatTile
          label="Occupation"
          value={`${Math.round(occupancy * 100)}%`}
          hint="moyenne portfolio"
          accent={occupancy >= 0.7 ? 'positive' : occupancy < 0.5 ? 'negative' : 'neutral'}
        />
        <StatTile
          label="ADR moyen"
          value={formatCurrency(adr)}
          hint="par nuit reservee"
        />
      </Box>

      {/* Section 2 : Top performers */}
      {topPerformers.length > 0 && (
        <Box>
          <SectionHeader
            label="Top performers"
            icon={<TrendUpIcon size={14} />}
            color={theme.palette.success.main}
          />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: `repeat(${Math.min(topPerformers.length, 3)}, 1fr)` },
              gap: 1,
            }}
          >
            {topPerformers.slice(0, 3).map((p) => (
              <TopPerformerCard key={p.id} performer={p} />
            ))}
          </Box>
        </Box>
      )}

      {/* Section 3 : Sous-performants */}
      {underPerformers.length > 0 && (
        <Box>
          <SectionHeader
            label={`Sous-performants (${underPerformers.length})`}
            icon={<TrendDownIcon size={14} />}
            color={theme.palette.warning.main}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {underPerformers.map((p) => (
              <UnderPerformerRow key={p.id} performer={p} />
            ))}
          </Box>
        </Box>
      )}

      {/* Section 4 : Patterns detectes */}
      {patterns.length > 0 && (
        <Box>
          <SectionHeader
            label="Patterns detectes"
            icon={<WarningIcon size={14} />}
            color={theme.palette.error.main}
          />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {patterns.map((pat, idx) => (
              <PatternRow key={`${pat.type}-${idx}`} pattern={pat} />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

// ─── Sous-composants ─────────────────────────────────────────────────────────

const StatTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  accent?: 'positive' | 'negative' | 'neutral';
}> = ({ label, value, hint, accent = 'neutral' }) => {
  const theme = useTheme();
  const tileColor =
    accent === 'positive' ? theme.palette.success.main
    : accent === 'negative' ? theme.palette.warning.main
    : theme.palette.primary.main;

  return (
    <Box
      sx={{
        px: 1.25,
        py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(tileColor, accent === 'neutral' ? 0.04 : 0.08),
      }}
    >
      <Typography
        variant="caption"
        sx={{
          display: 'block', color: theme.palette.text.secondary,
          fontSize: '0.7rem', mb: 0.25,
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: '1.15rem',
          fontWeight: 600,
          lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums',
          color: theme.palette.text.primary,
          letterSpacing: '-0.01em',
        }}
      >
        {value}
      </Typography>
      {hint && (
        <Typography
          variant="caption"
          sx={{
            display: 'block', color: theme.palette.text.disabled,
            fontSize: '0.65rem', mt: 0.25,
          }}
        >
          {hint}
        </Typography>
      )}
    </Box>
  );
};

const SectionHeader: React.FC<{
  label: string;
  icon: React.ReactNode;
  color: string;
}> = ({ label, icon, color }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
    <Box sx={{ display: 'inline-flex', color }}>{icon}</Box>
    <Typography
      variant="caption"
      sx={{
        fontSize: '0.7rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        color,
      }}
    >
      {label}
    </Typography>
  </Box>
);

const TopPerformerCard: React.FC<{ performer: TopPerformer }> = ({ performer }) => {
  const theme = useTheme();
  const occupancyPct = Math.round(performer.occupancy * 100);

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.success.main, 0.06),
      }}
    >
      <Typography
        sx={{
          fontSize: '0.8125rem', fontWeight: 600,
          color: theme.palette.text.primary,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {performer.name}
      </Typography>
      {performer.city && (
        <Typography
          variant="caption"
          sx={{ display: 'block', color: theme.palette.text.secondary, fontSize: '0.7rem' }}
        >
          {performer.city}
        </Typography>
      )}
      <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mt: 0.5 }}>
        <Typography
          sx={{
            fontSize: '1rem', fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: theme.palette.success.dark,
          }}
        >
          {formatCurrency(performer.revenue)}
        </Typography>
        <Typography variant="caption" sx={{ color: theme.palette.text.disabled, fontSize: '0.7rem' }}>
          {performer.reservations} resa
        </Typography>
      </Box>
      <Box sx={{ mt: 0.75 }}>
        <LinearProgress
          variant="determinate"
          value={occupancyPct}
          sx={{
            height: 4, borderRadius: 2,
            bgcolor: alpha(theme.palette.success.main, 0.12),
            '& .MuiLinearProgress-bar': {
              bgcolor: theme.palette.success.main,
              borderRadius: 2,
            },
          }}
        />
        <Typography
          variant="caption"
          sx={{
            display: 'block', fontSize: '0.65rem', mt: 0.25,
            color: theme.palette.text.secondary,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Occupation {occupancyPct}%
        </Typography>
      </Box>
    </Box>
  );
};

const UnderPerformerRow: React.FC<{ performer: UnderPerformer }> = ({ performer }) => {
  const theme = useTheme();
  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(theme.palette.warning.main, 0.06),
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
          <Typography sx={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: theme.palette.text.primary,
          }}>
            {performer.name}
          </Typography>
          {performer.city && (
            <Typography variant="caption" sx={{
              color: theme.palette.text.secondary, fontSize: '0.7rem',
            }}>
              {performer.city}
            </Typography>
          )}
        </Box>
        <Typography variant="caption" sx={{
          display: 'block', color: theme.palette.warning.dark, fontSize: '0.72rem', mt: 0.25,
        }}>
          {performer.reason}
        </Typography>
        <Typography variant="caption" sx={{
          display: 'block', color: theme.palette.text.secondary, fontSize: '0.72rem',
          fontStyle: 'italic', mt: 0.25,
        }}>
          → {performer.recommendation}
        </Typography>
      </Box>
      <Typography sx={{
        fontSize: '0.85rem', fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
        color: theme.palette.warning.dark,
        whiteSpace: 'nowrap',
      }}>
        {Math.round(performer.occupancy * 100)}%
      </Typography>
    </Box>
  );
};

const PatternRow: React.FC<{ pattern: Pattern }> = ({ pattern }) => {
  const theme = useTheme();
  const sevColor = severityColor(pattern.severity, theme);
  const Icon = patternIcon(pattern.type);

  return (
    <Box
      sx={{
        px: 1.25, py: 1,
        borderRadius: 1.5,
        bgcolor: alpha(sevColor, 0.06),
        display: 'flex',
        gap: 1,
        alignItems: 'flex-start',
      }}
    >
      <Box sx={{
        display: 'inline-flex', color: sevColor, mt: 0.125,
      }}>
        <Icon size={16} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
          <Typography sx={{
            fontSize: '0.8125rem', fontWeight: 600,
            color: theme.palette.text.primary,
          }}>
            {pattern.title}
          </Typography>
          <Chip
            label={pattern.severity}
            size="small"
            sx={{
              height: 18, fontSize: '0.65rem', fontWeight: 600,
              bgcolor: alpha(sevColor, 0.12),
              color: sevColor,
              '& .MuiChip-label': { px: 0.75 },
            }}
          />
        </Box>
        <Typography variant="caption" sx={{
          display: 'block', color: theme.palette.text.secondary, fontSize: '0.72rem',
        }}>
          {pattern.description}
        </Typography>
        {pattern.items && pattern.items.length > 0 && (
          <Typography variant="caption" sx={{
            display: 'block', color: theme.palette.text.disabled,
            fontSize: '0.7rem', mt: 0.25,
          }}>
            {pattern.items.join(' · ')}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function severityColor(severity: string, theme: Theme): string {
  switch (severity?.toUpperCase()) {
    case 'CRITICAL':
    case 'HIGH':
      return theme.palette.error.main;
    case 'MEDIUM':
      return theme.palette.warning.main;
    case 'LOW':
    default:
      return theme.palette.info.main;
  }
}

// Type d'icone Lucide : on s'aligne sur les exports lucide-react (ForwardRef
// avec props variees) sans tenter de retyper localement.
type IconComponent = typeof TrendDownIcon;

function patternIcon(type: string): IconComponent {
  switch (type) {
    case 'CITY_SATISFACTION_LOW':
      return CityIcon;
    case 'HIGH_CANCELLATION_RATE':
      return TrendDownIcon;
    default:
      return WarningIcon;
  }
}
