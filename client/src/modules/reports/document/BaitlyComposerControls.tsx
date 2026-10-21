import { useId, useState, type ReactNode } from 'react';
import { Check, ChevronDown, LockKeyhole } from '../../../icons/glyphs';

export function ComposerSection({ number, title, hint, children }: { number: string; title: string; hint?: string; children: ReactNode }) {
  const id = useId();
  return <section className="rc-section" aria-labelledby={id}>
    <header className="rc-section-heading"><span aria-hidden="true">{number}</span><div><h3 id={id}>{title}</h3>{hint && <p>{hint}</p>}</div></header>
    <div className="rc-section-body">{children}</div>
  </section>;
}

export function ComposerChoice({ label, selected, onClick, locked, requiredLabel }: {
  label: string; selected: boolean; onClick?: () => void; locked?: boolean; requiredLabel?: string;
}) {
  return <button type="button" className="rc-choice" aria-pressed={selected} disabled={locked}
    aria-label={locked ? `${label} ${requiredLabel}` : undefined} title={locked ? requiredLabel : undefined} onClick={onClick}>
    <span className="rc-choice-check" aria-hidden="true">{selected && <Check size={12} />}</span>
    <span>{label}</span>{locked && <><LockKeyhole size={12} aria-hidden="true" /><span className="sr-only">{requiredLabel}</span></>}
  </button>;
}

export function ComposerGroup({ label, count, total, tone, initiallyOpen, onToggleAll, actionLabel, children }: {
  label: string; count: number; total: number; tone: string; initiallyOpen?: boolean; onToggleAll: () => void; actionLabel: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(!!initiallyOpen);
  const id = useId();
  return <section className="rc-content-group" data-tone={tone}>
    <div className="rc-content-group-heading"><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <span className="rc-family-dot" aria-hidden="true" /><strong>{label}</strong><span className="rc-group-count">{count}/{total}</span><ChevronDown size={15} aria-hidden="true" />
    </button><button type="button" className="rc-text-action" onClick={onToggleAll}>{actionLabel}</button></div>
    {open && <div id={id} className="rc-choices">{children}</div>}
  </section>;
}
