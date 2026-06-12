import React from 'react';
import { Box, Card, CardContent, Typography, alpha } from '@mui/material';

interface DetailSectionProps {
  /** Overline title — uppercase, short. */
  title: string;
  /** Optional accent color (hex). Drives the icon badge bg. */
  accentColor?: string;
  /** Optional icon for the small badge (kept varied across sections to avoid the
   *  "icon-badge over every heading" template). */
  icon?: React.ReactNode;
  /** Optional inline action slot (e.g. an edit button). */
  action?: React.ReactNode;
  /**
   * When true, children are rendered as-is (caller controls layout — useful for forms
   * that have their own MUI Grid). When false (default), wraps children in a 2-col CSS grid.
   */
  disableGrid?: boolean;
  /** Section content. */
  children: React.ReactNode;
}

/**
 * Card wrapper for one logical section of the user details page.
 *
 * <h4>Design rules respected</h4>
 * <ul>
 *   <li>Impeccable: no side-stripe, carte plate hairline (baseline Signature).</li>
 *   <li>Subtle hover: border tone shift, no transform on width/height.</li>
 *   <li>Reduced-motion respected.</li>
 *   <li>tabular-nums + balance handled by `DetailField`.</li>
 * </ul>
 */
const DetailSection: React.FC<DetailSectionProps> = ({
  title,
  accentColor,
  icon,
  action,
  disableGrid = false,
  children,
}) => {
  const accent = accentColor ?? '#6B8A9A';

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        borderRadius: 'var(--radius-lg)',
        bgcolor: 'var(--card)',
        borderColor: 'var(--line)',
        overflow: 'hidden',
        transition: 'border-color 200ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': {
          borderColor: 'var(--line-2)',
        },
      }}
    >
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 } }}>
        {/* Section header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon && (
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: 0.75,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(accent, 0.12),
                color: accent,
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
          )}
          <Typography
            sx={{
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--faint)',
              flex: 1,
            }}
          >
            {title}
          </Typography>
          {action && (
            <Box sx={{ display: 'inline-flex', flexShrink: 0 }}>{action}</Box>
          )}
        </Box>

        {/* Fields — single column on mobile, 2 cols on >=sm (unless caller opts out) */}
        {disableGrid ? (
          children
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' },
              gap: 2,
            }}
          >
            {children}
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

export default DetailSection;
