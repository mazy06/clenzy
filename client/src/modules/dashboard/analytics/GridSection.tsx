import React from 'react';
import { Box, Typography } from '@mui/material';

// ─── Props ───────────────────────────────────────────────────────────────────

interface GridSectionProps {
  title: string;
  subtitle?: string;
  badge?: number;
  children: React.ReactNode;
}

// ─── Stable sx constants ────────────────────────────────────────────────────

const SECTION_TITLE_SX = {
  fontSize: '10.5px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: 'var(--faint)',
  lineHeight: 1.2,
} as const;

const SUBTITLE_SX = {
  fontSize: '0.625rem',
  color: 'var(--muted)',
  mt: 0.25,
  lineHeight: 1.2,
} as const;

const BADGE_SX = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 18,
  height: 18,
  borderRadius: 'var(--radius-pill)',
  bgcolor: 'var(--err)',
  color: 'var(--on-accent)',
  fontSize: '0.5625rem',
  fontWeight: 700,
  fontVariantNumeric: 'tabular-nums',
  ml: 0.75,
  px: 0.5,
} as const;

// ─── Component ──────────────────────────────────────────────────────────────

const GridSection: React.FC<GridSectionProps> = React.memo(({
  title,
  subtitle,
  badge,
  children,
}) => (
  <Box sx={{ mb: 2 }}>
    {/* Header */}
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.75 }}>
      <Typography sx={SECTION_TITLE_SX}>{title}</Typography>
      {badge !== undefined && badge > 0 && (
        <Box sx={BADGE_SX}>{badge}</Box>
      )}
    </Box>
    {subtitle && (
      <Typography sx={SUBTITLE_SX}>{subtitle}</Typography>
    )}

    {/* Grid content (children handle their own Grid layout) */}
    <Box sx={{ mt: 0.75 }}>
      {children}
    </Box>
  </Box>
));

GridSection.displayName = 'GridSection';

export default GridSection;
