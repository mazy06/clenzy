import React from 'react';
import { Typography } from '@mui/material';

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

// ─── Component ──────────────────────────────────────────────────────────────

const GridSection: React.FC<GridSectionProps> = React.memo(({
  title,
  subtitle,
  badge,
  children,
}) => (
  <div className="mb-3">
    {/* Header */}
    <div className="flex items-center mb-1">
      <Typography sx={SECTION_TITLE_SX}>{title}</Typography>
      {badge !== undefined && badge > 0 && (
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-[var(--radius-pill)] bg-[var(--err)] text-[var(--on-accent)] text-[9px] font-bold tabular-nums ml-[4.5px] px-[3px]">{badge}</span>
      )}
    </div>
    {subtitle && (
      <Typography sx={SUBTITLE_SX}>{subtitle}</Typography>
    )}

    {/* Grid content (children handle their own Grid layout) */}
    <div className="mt-1">
      {children}
    </div>
  </div>
));

GridSection.displayName = 'GridSection';

export default GridSection;
