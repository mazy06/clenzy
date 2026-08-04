import React from 'react';
import { cn } from '../../utils/cn';

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
  <div className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-solid border-[var(--line)] px-[22px] py-3">
    {steps.map((label, i) => {
      const n = i + 1;
      const state = n === current ? 'current' : n < current ? 'done' : 'todo';
      const canClick = n < current || reachable[i];

      return (
        <React.Fragment key={label}>
          <button
            type="button"
            onClick={() => canClick && onStepClick(n)}
            disabled={!canClick}
            aria-current={state === 'current' ? 'step' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-[9px] border-0 bg-transparent px-1.5 py-1',
              '[font-family:inherit] [transition:background_.14s]',
              'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]',
              canClick ? 'cursor-pointer' : 'cursor-default',
              canClick && state !== 'current' && 'hover:bg-[var(--hover)]',
            )}
          >
            {/* Les trois etats de la pastille : le codemod avait aplati la ternaire
                imbriquee en litteral « [object Object] », classes sans effet. */}
            <div
              className={cn(
                'inline-flex w-[22px] h-[22px] shrink-0 items-center justify-center rounded-[50%] text-[11.5px] font-semibold tabular-nums',
                state === 'current'
                  ? 'border-none bg-[var(--accent)] text-[var(--on-accent)]'
                  : state === 'done'
                    ? 'border-none bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border border-solid border-[var(--line-2)] bg-transparent text-[var(--faint)]',
              )}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {state === 'done' ? <Check size={12} strokeWidth={2.5} /> : n}
            </div>
            <span className={cn('cn-text-body1 text-[12px] whitespace-nowrap', state === 'current' ? 'font-semibold' : 'font-medium', state === 'current' ? 'text-[var(--ink)]' : state === 'done' ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}>
              {label}
            </span>
          </button>
          {i < steps.length - 1 && (
            <div className={cn('flex-1 min-w-[12px] h-[1px]', n < current ? 'bg-[var(--accent)]' : 'bg-[var(--line)]')} style={{ transition: 'background-color .14s' }} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

export default ReservationWizardSteps;
