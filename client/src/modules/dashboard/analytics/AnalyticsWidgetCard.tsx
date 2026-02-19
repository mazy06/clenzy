import React from 'react';
import {
  Box,
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
} from '@mui/icons-material';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AnalyticsWidgetCardProps {
  title: string;
  value?: string;
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
  '&:hover': { borderColor: 'text.secondary' },
} as const;

const CARD_CONTENT_SX = {
  p: 1.25,
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  '&:last-child': { pb: 1.25 },
} as const;

const VALUE_SX = {
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: '-0.02em',
  fontSize: '1.125rem',
  fontVariantNumeric: 'tabular-nums',
} as const;

const TITLE_SX = {
  fontSize: '0.6875rem',
  fontWeight: 600,
  lineHeight: 1.2,
  letterSpacing: '0.02em',
  textTransform: 'uppercase' as const,
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
  const cardContent = (
    <Card
      sx={{
        ...CARD_SX,
        minWidth,
        height: height || 'auto',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <CardContent sx={CARD_CONTENT_SX}>
        {loading ? (
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
              <Skeleton variant="rectangular" width={28} height={28} sx={{ borderRadius: 1 }} />
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" height={14} />
                <Skeleton variant="text" width="40%" height={20} />
              </Box>
            </Box>
            <Skeleton variant="text" width="50%" height={10} />
          </Box>
        ) : (
          <>
            {/* Header row with icon + title */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.25 }}>
              {icon && (
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: 28,
                    height: 28,
                    borderRadius: 0.75,
                    bgcolor: 'rgba(107, 138, 154, 0.07)',
                    '& .MuiSvgIcon-root': { fontSize: 16 },
                  }}
                >
                  {icon}
                </Box>
              )}
              <Typography variant="body2" color="text.secondary" sx={TITLE_SX}>
                {title}
              </Typography>
            </Box>

            {/* Value */}
            {value && (
              <Typography variant="h6" component="div" sx={VALUE_SX}>
                {value}
              </Typography>
            )}

            {/* Subtitle */}
            {subtitle && (
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{ fontSize: '0.5625rem', mt: 0.125, lineHeight: 1.2 }}
              >
                {subtitle}
              </Typography>
            )}

            {/* Trend */}
            {trend && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.25 }}>
                {trend.value > 0 ? (
                  <TrendingUp color="success" sx={{ fontSize: 11 }} />
                ) : trend.value < 0 ? (
                  <TrendingDown color="error" sx={{ fontSize: 11 }} />
                ) : (
                  <Remove sx={{ fontSize: 11, color: 'text.disabled' }} />
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
              </Box>
            )}

            {/* Custom content (charts, etc.) */}
            {children && (
              <Box sx={{ flex: 1, minHeight: 0, mt: 0.5 }}>
                {children}
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (tooltip) {
    return (
      <Tooltip title={tooltip} arrow placement="top">
        {cardContent}
      </Tooltip>
    );
  }

  return cardContent;
});

AnalyticsWidgetCard.displayName = 'AnalyticsWidgetCard';

export default AnalyticsWidgetCard;
