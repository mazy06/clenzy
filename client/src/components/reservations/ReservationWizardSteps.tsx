import React from 'react';
import { cn } from '../../utils/cn';
import { Box, Typography } from '@mui/material';
import { Check } from '../../icons';

interface Props {
  /** Libellés des étapes (4). */
  steps: string[];
  /** Étape courante (1-based). */
  current: number;
  /** Étape n atteignable au clic (1-based, index n-1). */
  reachable: boolean[];
  onStepClick: (step: number) => void;
}

// ─── Indicateur d'étapes du wizard (langage « Signature ») ───────────────────
// Étape courante en accent, faites en accent atténué (cliquables pour revenir),
// suivantes en muted. Tokens var(--…). Aucun gradient/glassmorphism.

const ReservationWizardSteps: React.FC<Props> = ({ steps, current, reachable, onStepClick }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      padding: '12px 22px',
      borderBottom: '1px solid var(--line)',
      flexShrink: 0,
      overflowX: 'auto',
    }}
  >
    {steps.map((label, i) => {
      const n = i + 1;
      const state = n === current ? 'current' : n < current ? 'done' : 'todo';
      const canClick = n < current || reachable[i];

      return (
        <React.Fragment key={label}>
          <Box
            component="button"
            type="button"
            onClick={() => canClick && onStepClick(n)}
            disabled={!canClick}
            aria-current={state === 'current' ? 'step' : undefined}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              border: 0,
              background: 'none',
              padding: '4px 6px',
              borderRadius: '9px',
              cursor: canClick ? 'pointer' : 'default',
              fontFamily: 'inherit',
              flexShrink: 0,
              transition: 'background .14s',
              '&:hover': canClick && state !== 'current' ? { background: 'var(--hover)' } : {},
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '1px' },
            }}
          >
            <div className={cn('w-[22px] h-[22px] rounded-[50%] inline-flex items-center justify-center text-[11.5px] font-semibold tabular-nums shrink-0', state === 'current' ? 'bg-[var(--accent)]' : '[object Object]', state === 'current' ? 'text-[var(--on-accent)]' : '[object Object]', state === 'todo' ? 'border border-solid border-[var(--line-2)]' : 'border-none')} style={{ fontFamily: 'var(--font-display)' }}>
              {state === 'done' ? <Check size={12} strokeWidth={2.5} /> : n}
            </div>
            <Typography
              component="span"
              sx={{
                fontSize: '12px',
                fontWeight: state === 'current' ? 600 : 500,
                color: state === 'current' ? 'var(--ink)' : state === 'done' ? 'var(--accent)' : 'var(--muted)',
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </Typography>
          </Box>
          {i < steps.length - 1 && (
            <div className={cn('flex-1 min-w-[12px] h-[1px]', n < current ? 'bg-[var(--accent)]' : 'bg-[var(--line)]')} style={{ transition: 'background-color .14s' }} />
          )}
        </React.Fragment>
      );
    })}
  </Box>
);

export default ReservationWizardSteps;
