import * as React from 'react';
import { Money } from './Money';
import ChannelTag from './ChannelTag';
import { WidgetPanel, WidgetPanelToggle } from './WidgetPanel';
import { useTranslation } from '../../hooks/useTranslation';
import { activeIntlLocale } from '../../utils/activeLocale';
import './revenueByChannel.css';

export interface ChannelRevenue {
  source?: string;
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
    <WidgetPanel title={title ?? t('dashboard.widgets.revenueByChannel', 'Revenus par canal')}
      caption={subtitle} action={headerAction} className={className}
      footer={remaining.length > 0 ? <>
        <WidgetPanelToggle expanded={expanded} onToggle={() => setExpanded((value) => !value)} controls={listId}
          moreLabel={t('dashboard.revenueByChannel.showAll', 'Voir tous les canaux')}
          lessLabel={t('dashboard.actionItems.showLess', 'Réduire')} />
        {!expanded && <span className="tabular-nums" title={t('dashboard.revenueByChannel.otherShare', '{{count}} autres canaux : {{share}} %', { count: remaining.length, share: percent(remaining.reduce((sum, c) => sum + c.pct, 0)) })}>
          +{remaining.length.toLocaleString(activeIntlLocale())} · {percent(remaining.reduce((sum, c) => sum + c.pct, 0))} %
        </span>}
      </> : undefined}>
      {channels.length === 0 && <p className="bui-widget-panel__empty">{t('revenueByChannel.empty')}</p>}
      <ul id={listId} className="bui-channel-list db-widget-body" tabIndex={0} aria-label={title ?? t('dashboard.widgets.revenueByChannel', 'Revenus par canal')}>
        {shown.map((channel) => {
          const delta = channel.comparePct == null ? null : Math.round((channel.pct - channel.comparePct) * 10) / 10;
          return (
            <li key={channel.source ?? channel.name} className="bui-channel-row">
              <div className="bui-channel-row__logo"><ChannelTag channel={channel.source ?? channel.name.toLowerCase()} label={channel.name} iconOnly /></div>
              <div className="bui-channel-row__content">
              <div className="bui-channel-row__heading">
                <span dir="auto" className="bui-channel-row__name">{channel.name}</span>
                <span className="bui-channel-row__amount">
                  {channel.amount != null ? <Money value={channel.amount} from={fromCurrency} decimals={0} /> : `${percent(channel.pct)} %`}
                </span>
              </div>
              <div className="bui-channel-row__distribution">
                <div aria-hidden="true" className="bui-channel-row__track">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, channel.pct))}%`, backgroundColor: channel.color }} />
                </div>
                <span className="bui-channel-row__share">
                  {percent(channel.pct)} %
                </span>
              </div>
              {delta != null && delta !== 0 && <span className="bui-channel-row__delta" title={t('dashboard.revenueByChannel.deltaHint', 'Écart de part par rapport à la période précédente')}>{delta > 0 ? '+' : ''}{percent(delta)} pt · {t('dashboard.revenueByChannel.previousPeriod', 'période précédente')}</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </WidgetPanel>
  );
}
