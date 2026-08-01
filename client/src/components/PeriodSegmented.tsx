import React from 'react';
import { cn } from '../utils/cn';

/**
 * Sélecteur segmenté partagé — pattern baseline §2 « Segmented » (réf. .s-seg) :
 * conteneur --field bordé --field-line r10 p3 gap2 ; boutons 12px fw600 --muted
 * r7 ; ACTIF = fond --card + texte accent + ombre 0 1px 3px. Présentationnel pur.
 *
 * Primitive unique pour TOUT sélecteur d'options mutuellement exclusives de type
 * « view-switcher » (période dashboard/rapports, vues planning, etc.) — résout
 * l'arbitrage §7 « chips vs segmented » en faveur du segmented partout.
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
    <div className="inline-flex items-center gap-0.5 p-[3px] rounded-[10px] bg-[var(--field)] border border-solid border-[var(--field-line)]" role="group" aria-label={ariaLabel}>
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          // `font-[var(--font-sans)]` serait ambigu (famille vs graisse) : propriete explicite.
          <button
            key={opt.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(opt.value)}
            className={cn(
              'border-0 cursor-pointer rounded-[7px] px-[12px] py-[5px] [font-family:var(--font-sans)] text-[12px] font-semibold leading-[1.2] whitespace-nowrap',
              'transition-[background-color,color] duration-[140ms] motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
              selected
                ? 'bg-[var(--card)] text-[var(--accent)] shadow-[0_1px_3px_color-mix(in_srgb,var(--ink)_10%,transparent)] hover:text-[var(--accent)]'
                : 'bg-transparent text-[var(--muted)] shadow-none hover:text-[var(--body)]',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

const PeriodSegmented = React.memo(PeriodSegmentedInner) as typeof PeriodSegmentedInner;

export default PeriodSegmented;
