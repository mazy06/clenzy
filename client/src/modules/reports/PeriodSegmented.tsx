import React from 'react';
import { Box } from '@mui/material';

/**
 * Sélecteur segmenté — pattern baseline §2 « Segmented » (réf. .s-seg) :
 * conteneur --field bordé --field-line r10 p3 gap2 ; boutons 12px fw600
 * --muted r7 ; ACTIF = fond --card + texte accent + ombre 0 1px 3px.
 * Présentationnel pur (mêmes props que DashboardDateFilter).
 */

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

interface PeriodSegmentedProps<T extends string = string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel?: string;
}

function PeriodSegmentedInner<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: PeriodSegmentedProps<T>) {
  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px',
        p: '3px',
        borderRadius: '10px',
        bgcolor: 'var(--field)',
        border: '1px solid var(--field-line)',
      }}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Box
            key={opt.value}
            component="button"
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            sx={{
              border: 0,
              cursor: 'pointer',
              borderRadius: '7px',
              px: '12px',
              py: '5px',
              fontFamily: 'var(--font-sans)',
              fontSize: '12px',
              fontWeight: 600,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              transition: 'background-color .14s, color .14s',
              bgcolor: selected ? 'var(--card)' : 'transparent',
              color: selected ? 'var(--accent)' : 'var(--muted)',
              boxShadow: selected ? '0 1px 3px rgba(21,36,45,.1)' : 'none',
              '&:hover': { color: selected ? 'var(--accent)' : 'var(--body)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
            }}
          >
            {opt.label}
          </Box>
        );
      })}
    </Box>
  );
}

const PeriodSegmented = React.memo(PeriodSegmentedInner) as typeof PeriodSegmentedInner;

export default PeriodSegmented;
