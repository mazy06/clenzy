import { Check } from '../../icons/glyphs';
import type { CSSProperties } from 'react';
import { cn } from '../../utils/cn';
import '../../theme/baitly-form-surfaces.css';

/** Shared progress navigation for operational forms, including mobile dialogs. */
export default function BaitlyFormSteps({ steps, current, reachable, onStepClick }: {
  steps: string[];
  current: number;
  reachable?: boolean[];
  onStepClick: (step: number) => void;
}) {
  return <div className="baitly-form-progress">
    <div className="baitly-form-steps" style={{ '--form-step-count': steps.length } as CSSProperties}>
    {steps.map((label, index) => {
      const step = index + 1;
      const enabled = step <= current || reachable?.[index] !== false;
      return <button key={label} type="button" disabled={!enabled}
        aria-current={step === current ? 'step' : undefined}
        aria-label={label}
        onClick={() => enabled && onStepClick(step)}
        className={cn('baitly-form-step', step < current && 'is-complete')}>
        <span className="baitly-form-step__number" aria-hidden="true">{step < current ? <Check /> : step}</span>
        <span>{label}</span>
      </button>;
    })}
    </div>
    <p className="baitly-form-step-caption" aria-live="polite"><span className="tabular-nums">{current} / {steps.length}</span> · {steps[current - 1]}</p>
  </div>;
}
