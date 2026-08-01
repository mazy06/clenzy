import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Skeleton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Remove,
} from '../../../icons';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AnalyticsWidgetCardProps {
  title: string;
  value?: React.ReactNode;
  /** Texte indicatif pour dimensionner la police + l'attribut title quand
   *  `value` est un nœud (ex: <Money/> qui affiche le glyphe de devise). */
  valueText?: string;
  subtitle?: string;
  trend?: { value: number; label?: string };
  icon?: React.ReactNode;
  tooltip?: string;
  loading?: boolean;
  onClick?: () => void;
  minWidth?: number;
  children?: React.ReactNode;
  /** Card height override */
  height?: number | string;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const CARD_SX = {
  width: '100%',
  transition: 'border-color 0.15s ease',
  '&:hover': { borderColor: 'var(--line-2)' },
} as const;

const CARD_CONTENT_SX = {
  p: 1.25,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  '&:last-child': { pb: 1.25 },
} as const;

const VALUE_SX = {
  fontFamily: 'var(--font-display)',
  fontWeight: 600,
  lineHeight: 1.15,
  letterSpacing: '-0.025em',
  color: 'var(--ink)',
  fontVariantNumeric: 'tabular-nums',
  mt: 0.25,
  // Une seule ligne : si le chiffre est long, la taille est réduite
  // (valueFontSize) et au pire on ellipse — jamais de retour à la ligne.
  whiteSpace: 'nowrap' as const,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  maxWidth: '100%',
} as const;

/**
 * Taille du chiffre adaptée à sa longueur (responsive) — un montant comme
 * « 120.00 € » doit tenir sur une ligne dans une carte étroite, alors qu'un
 * « 1 » ou « 46.7% » peut être affiché en grand.
 */
function valueFontSize(value?: string): { xs: string; md: string } {
  if (value == null) return { xs: '1.05rem', md: '1.2rem' }; // nœud sans hint → taille moyenne sûre
  const len = value.length;
  if (len <= 5) return { xs: '1.5rem', md: '1.75rem' };
  if (len <= 8) return { xs: '1.25rem', md: '1.45rem' };
  if (len <= 12) return { xs: '1.05rem', md: '1.2rem' };
  return { xs: '0.9rem', md: '1rem' };
}

const TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  color: 'var(--faint)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const GROWTH_SX = {
  fontSize: '0.5625rem',
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '0.01em',
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const AnalyticsWidgetCard: React.FC<AnalyticsWidgetCardProps> = React.memo(({
  title,
  value,
  valueText,
  subtitle,
  trend,
  icon,
  tooltip,
  loading = false,
  onClick,
  minWidth,
  children,
  height,
}) => {
  // La description vit dans le tooltip (jamais en double sur la carte).
  // Si aucun tooltip explicite, on y bascule le subtitle (ex. « X total »).
  const resolvedTooltip = tooltip || subtitle;
  // Texte de dimensionnement : la value si c'est une string, sinon le hint.
  const sizingText = typeof value === 'string' ? value : valueText;

  const cardContent = (
    <Card
      sx={{
        ...CARD_SX,
        minWidth,
        height: height || '100%',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <CardContent sx={CARD_CONTENT_SX}>
        {loading ? (
          <div>
            <div className="flex items-center gap-1 mb-0.5">
              <Skeleton variant="rectangular" width={28} height={28} sx={{ borderRadius: 1 }} />
              <div className="flex-1">
                <Skeleton variant="text" width="60%" height={14} />
                <Skeleton variant="text" width="40%" height={20} />
              </div>
            </div>
            <Skeleton variant="text" width="50%" height={10} />
          </div>
        ) : (
          <>
            {/* Header row with icon + title */}
            <div className="flex items-center gap-1 mb-0.5">
              {icon && (
                <div className="flex items-center justify-center min-w-[28px] h-[28px] rounded-[var(--radius-sm)] bg-[var(--accent-soft)] [&_.MuiSvgIcon-root]:text-[16px]">
                  {icon}
                </div>
              )}
              <Typography variant="body2" color="text.secondary" sx={TITLE_SX}>
                {title}
              </Typography>
            </div>

            {/* Value */}
            {value != null && value !== '' && (
              <Typography variant="h6" component="div" sx={{ ...VALUE_SX, fontSize: valueFontSize(sizingText) }} title={sizingText}>
                {value}
              </Typography>
            )}

            {/* La description (subtitle) n'est plus affichée dans la carte :
                elle est redondante avec le tooltip → on la bascule dans le
                tooltip (cf. resolvedTooltip) pour mettre le chiffre en avant. */}

            {/* Trend */}
            {trend && (
              <div className="flex items-center gap-0.5 mt-0.5">
                {trend.value > 0 ? (
                  <TrendingUp color="success" size={11} strokeWidth={1.75} />
                ) : trend.value < 0 ? (
                  <TrendingDown color="error" size={11} strokeWidth={1.75} />
                ) : (
                  <span className="inline-flex text-muted-foreground opacity-60"><Remove size={11} strokeWidth={1.75} /></span>
                )}
                <Typography
                  variant="caption"
                  sx={{
                    ...GROWTH_SX,
                    color: trend.value > 0
                      ? 'success.main'
                      : trend.value < 0
                      ? 'error.main'
                      : 'text.disabled',
                  }}
                >
                  {trend.value > 0 ? '+' : ''}{trend.value}%
                  {trend.label ? ` ${trend.label}` : ''}
                </Typography>
              </div>
            )}

            {/* Custom content (charts, etc.) */}
            {children && (
              <div className="flex-1 min-h-0 mt-0.5">
                {children}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (resolvedTooltip) {
    return (
      <Tooltip title={resolvedTooltip} arrow placement="top">
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
});

AnalyticsWidgetCard.displayName = 'AnalyticsWidgetCard';

export default AnalyticsWidgetCard;
