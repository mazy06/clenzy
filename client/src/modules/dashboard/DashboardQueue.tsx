import * as React from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { Badge, buttonVariants } from '../../components/ui';
import { activeIntlLocale } from '../../utils/activeLocale';
import { cn } from '../../utils/cn';
import './dashboardQueue.css';

/** Shared anatomy for the daily operations and action queues. */
export function DashboardQueue({ title, count, caption, children, footer, className }: {
  title: string;
  count: number;
  caption: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const titleId = React.useId();
  return <section className={cn('db-queue db-widget-surface', className)} aria-labelledby={titleId}>
    <header className="db-queue__header">
      <div>
        <h3 id={titleId} className="db-queue__title">
          {title} <Badge variant="secondary" className="tabular-nums">{count.toLocaleString(activeIntlLocale())}</Badge>
        </h3>
        {caption && <p className="db-queue__caption">{caption}</p>}
      </div>
    </header>
    <div className="db-queue__body db-widget-body" role="region" aria-labelledby={titleId} tabIndex={0}>
      {children}
    </div>
    {footer && <footer className="db-queue__footer">{footer}</footer>}
  </section>;
}

/** The same count, blue selection and concave join in both dashboard widgets. */
export function DashboardQueueGroup({ id, label, artwork, meta, count, value, open, onToggle, children }: {
  id?: string;
  label: string;
  artwork: React.ReactNode;
  meta?: React.ReactNode;
  count: number;
  value?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  const generatedId = React.useId();
  const groupId = id ?? generatedId;
  const expanded = open && count > 0;
  return <section className="db-queue-group" data-open={expanded}>
    <h4 className="db-queue-group__heading">
      <button type="button" id={`${groupId}-trigger`} disabled={count === 0}
        aria-expanded={count > 0 ? expanded : undefined} aria-controls={count > 0 ? `${groupId}-panel` : undefined}
        className="db-queue-group__trigger" onClick={onToggle}>
        <span className="db-queue-group__art" aria-hidden="true">{artwork}</span>
        <span className="db-queue-group__copy">
          <span className="db-queue-group__label">{label}</span>{' '}{meta}
        </span>{' '}
        <span className="db-queue-group__figures">
          <span className="db-queue-group__count">{count.toLocaleString(activeIntlLocale())}</span>{' '}
          {value != null && <span className="db-queue-group__amount">{value}</span>}
        </span>
        {count > 0 && (expanded ? <ChevronDownIcon aria-hidden="true" className="db-queue-group__chevron" /> : <ChevronRightIcon aria-hidden="true" className="db-queue-group__chevron cn-rtl-flip" />)}
      </button>
    </h4>
    {expanded && <div id={`${groupId}-panel`} role="region" aria-labelledby={`${groupId}-trigger`} className="db-queue-group__panel">{children}</div>}
  </section>;
}

export function DashboardQueueToggle({ expanded, onToggle, moreLabel, lessLabel, controls }: {
  expanded: boolean;
  onToggle: () => void;
  moreLabel: string;
  lessLabel: string;
  controls?: string;
}) {
  return <button type="button" className="db-queue__text-button" aria-expanded={expanded} aria-controls={controls} onClick={onToggle}>
    {expanded ? lessLabel : moreLabel}
    <ChevronDownIcon aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : undefined }} />
  </button>;
}

/** One actionable row, including its visible verb. No nested button or dead target. */
export function DashboardQueueRow({ leading, primary, secondary, age, ageTone, ageTitle, value, actionLabel, onClick }: {
  leading?: React.ReactNode;
  primary: React.ReactNode;
  secondary: React.ReactNode;
  age?: string | null;
  ageTone?: string;
  ageTitle?: string;
  value?: React.ReactNode;
  actionLabel: string;
  onClick: () => void;
}) {
  return <button type="button" onClick={onClick} className="db-queue-row" data-has-avatar={!!leading}>
    {leading && <span className="db-queue-avatar">{leading}</span>}
    <span className="db-queue-copy">
      <span className="db-queue-primary">{primary}</span>{' '}
      <span className="db-queue-secondary">{secondary}</span>
    </span>{' '}
    {age && <span title={ageTitle} aria-label={ageTitle} className={cn('db-queue-age', ageTone)}>{age}</span>}{' '}
    <span className="db-queue-trailing">
      {value != null && <span className="db-queue-value">{value}</span>}{' '}
      <span className={cn(buttonVariants({ variant: 'outline', size: 'xs' }), 'db-queue-control')}>
        <span>{actionLabel}</span>
        <ChevronRightIcon className="cn-rtl-flip" aria-hidden="true" />
      </span>
    </span>
  </button>;
}
