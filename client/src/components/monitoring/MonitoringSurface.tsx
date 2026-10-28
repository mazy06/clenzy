import React, { useId } from 'react';
import { Card, CardContent, Skeleton } from '../ui';
import StatusChip, { type StatusTone } from '../StatusChip';
import { cn } from '../../utils/cn';
import './monitoring.css';

/** Shared Baitly monitoring surfaces. State belongs to the API, never to decoration. */
export function MonitoringIntro({ title, description, status, tone = 'neutral', aside }: {
  title: string; description: string; status?: string; tone?: StatusTone; aside?: React.ReactNode;
}) {
  return <div className="bui-monitor-intro">
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 className="text-base font-semibold tracking-tight text-balance">{title}</h2>
        {status && <StatusChip tone={tone} dot label={status} />}
      </div>
      <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground">{description}</p>
    </div>
    {aside && <div className="shrink-0 text-xs text-muted-foreground">{aside}</div>}
  </div>;
}

export function MonitoringPanel({ title, description, action, children, className, contentClassName }: {
  title: string; description?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode;
  className?: string; contentClassName?: string;
}) {
  const id = useId();
  return <Card role="region" aria-labelledby={id} className={cn('bui-monitor-panel', className)}>
    <div className="bui-monitor-panel__header">
      <div className="min-w-0">
        <h3 id={id} className="text-sm font-semibold text-balance">{title}</h3>
        {description && <div className="mt-1 text-xs text-muted-foreground">{description}</div>}
      </div>
      {action}
    </div>
    <CardContent className={cn('bui-monitor-panel__content', contentClassName)}>{children}</CardContent>
  </Card>;
}

export function MonitoringLoading({ label }: { label: string }) {
  return <div role="status" aria-label={label} className="bui-monitor">
    <span className="sr-only">{label}</span>
    <Skeleton className="h-12 w-full rounded-lg" />
    <div className="bui-monitor-columns">
      <div className="space-y-3 rounded-lg border border-border bg-card p-5">
        {[0, 1, 2, 3].map(row => <Skeleton key={row} className="h-14 w-full rounded-md" />)}
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  </div>;
}

export function MonitoringValueRow({ label, value, hint, tone = 'neutral' }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: StatusTone;
}) {
  return <div className="bui-monitor-value-row" data-tone={tone}>
    <div className="min-w-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      {hint && <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd>}
    </div>
    <dd className="bui-monitor-value-row__value tabular-nums">{value}</dd>
  </div>;
}

export const monitoringNumber = (value: number | null | undefined, locale?: string) =>
  value != null && Number.isFinite(value) ? value.toLocaleString(locale, { maximumFractionDigits: 1 }) : '—';

export const monitoringDate = (value: string | null | undefined, locale?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString(locale) : '—';
};
