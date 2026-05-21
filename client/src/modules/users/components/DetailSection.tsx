import React from 'react';
import { Box, Card, CardContent, Typography, alpha, useTheme } from '@mui/material';

interface DetailSectionProps {
  /** Overline title — uppercase, short. */
  title: string;
  /** Optional accent color (hex). Drives the icon badge bg + a 1px top filet. */
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
 *   <li>Impeccable: no side-stripe color &gt; 1px; 1px top accent filet is allowed.</li>
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
  const theme = useTheme();
  const accent = accentColor ?? theme.palette.primary.main;

  return (
    <Card
      variant="outlined"
      sx={{
        position: 'relative',
        borderRadius: 2,
        borderColor: 'divider',
        overflow: 'hidden',
        transition: 'border-color 200ms ease, box-shadow 200ms ease',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
        '&:hover': {
          borderColor: alpha(accent, 0.4),
          boxShadow: `0 1px 3px ${alpha(accent, 0.12)}`,
        },
        // 1 px top accent — single allowed filet (no side stripe).
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: '1px',
          bgcolor: accent,
          opacity: 0.45,
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
              fontSize: '0.6875rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
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
