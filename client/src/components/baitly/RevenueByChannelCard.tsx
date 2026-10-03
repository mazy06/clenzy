import * as React from 'react';
import { Button, Card } from '../ui';
import { Money } from './Money';
import { cn } from '../../utils/cn';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';

export interface ChannelRevenue {
  name: string;
  pct: number;
  amount?: number;
  color: string;
  comparePct?: number;
}

export interface RevenueByChannelCardProps {
  channels: ChannelRevenue[];
  title?: string;
  subtitle?: string;
  /** Source currency; omitted only for values already converted by the caller. */
  fromCurrency?: string;
  headerAction?: React.ReactNode;
  className?: string;
}

export default function RevenueByChannelCard({
  channels, title, subtitle, fromCurrency, headerAction, className,
}: RevenueByChannelCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = React.useState(false);
  const listId = React.useId();
  const shown = expanded ? channels : channels.slice(0, 5);
  const percent = (value: number) => value.toLocaleString(activeIntlLocale(), { maximumFractionDigits: 1 });
  const remaining = channels.slice(5);
  return (
    <Card className={cn('db-widget-surface gap-0 rounded-lg p-4', className)}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-balance">{title ?? t('dashboard.widgets.revenueByChannel', 'Revenus par canal')}</h3>
          {subtitle && <p className="m-0 mt-1 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {headerAction}
      </div>
      {channels.length === 0 && <p className="m-0 py-3 text-sm text-muted-foreground">{t('revenueByChannel.empty')}</p>}
      <ul id={listId} className="db-widget-body m-0 list-none divide-y divide-border p-0" tabIndex={0} aria-label={title ?? t('dashboard.widgets.revenueByChannel', 'Revenus par canal')}>
        {shown.map((channel) => {
          const delta = channel.comparePct == null ? null : Math.round((channel.pct - channel.comparePct) * 10) / 10;
          return (
            <li key={channel.name} className="py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-sm">
                <span dir="auto" className="min-w-0 font-medium" title={channel.name}>{channel.name}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {channel.amount != null ? <Money value={channel.amount} from={fromCurrency} decimals={0} /> : `${percent(channel.pct)} %`}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-3">
                <div aria-hidden="true" className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-field">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, channel.pct))}%`, backgroundColor: channel.color }} />
                </div>
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {percent(channel.pct)} %
                  {delta != null && delta !== 0 && <span title={t('dashboard.revenueByChannel.deltaHint', 'Écart de part par rapport à la période précédente')}> · {delta > 0 ? '+' : ''}{percent(delta)} pt</span>}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      {remaining.length > 0 && (
        <div className="mt-1 border-t border-border pt-2">
          {!expanded && <p className="m-0 mb-1 text-xs text-muted-foreground tabular-nums">
            {t('dashboard.revenueByChannel.otherShare', '{{count}} autres canaux : {{share}} %', { count: remaining.length, share: percent(remaining.reduce((sum, c) => sum + c.pct, 0)) })}
          </p>}
          <Button variant="ghost" size="sm" aria-expanded={expanded} aria-controls={listId} onClick={() => setExpanded((value) => !value)}>
            {expanded ? t('dashboard.actionItems.showLess', 'Réduire') : t('dashboard.revenueByChannel.showAll', 'Voir tous les canaux')}
          </Button>
        </div>
      )}
    </Card>
  );
}
