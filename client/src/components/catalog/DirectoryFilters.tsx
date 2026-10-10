import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export function DirectoryFilterGroup({ title, aside, children }: {
  title: string; aside?: string; children: ReactNode;
}) {
  return <section className="mb-4 border-b border-border pb-4 last:mb-0 last:border-b-0 last:pb-0">
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <h3 className="m-0 text-xs font-medium text-muted-foreground">{title}</h3>
      {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
    </div>
    {children}
  </section>;
}

/** Le compteur reste visible à zéro pour orienter le choix sans clic inutile. */
export function DirectoryFilter({ label, icon, count, active, onClick, title, disabled }: {
  label: string; icon?: ReactNode; count?: number; disabled?: boolean;
  active: boolean; onClick: () => void; title?: string;
}) {
  return <button type="button" onClick={onClick} title={title} disabled={disabled}
    aria-pressed={active} aria-label={count === undefined ? label : `${label} ${count}`}
    className={cn(
      'flex min-h-10 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-start text-sm',
      'transition-colors duration-150 outline-none focus-visible:ring-[2px] focus-visible:ring-ring/50 motion-reduce:transition-none',
      active ? 'bg-primary-soft font-semibold text-primary'
        : count === 0 ? 'text-muted-foreground hover:bg-accent' : 'text-foreground hover:bg-accent',
    )}>
    <span className="flex min-w-0 items-center gap-1.5">
      {icon && <span className="shrink-0 [&>svg]:size-3.5">{icon}</span>}
      <span className="truncate">{label}</span>
    </span>
    {count !== undefined && <span className={cn('shrink-0 text-xs tabular-nums',
      active ? 'text-primary' : 'text-muted-foreground', count === 0 && !active && 'opacity-60')}>
      {count}
    </span>}
  </button>;
}
