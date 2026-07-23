import * as React from 'react';
import { Card } from '../ui';
import { Money } from './Money';
import { cn } from '../../utils/cn';

/**
 * Baitly — remaster de components/RevenueByChannelCard.tsx (MUI).
 * Barres de répartition par canal + % + delta vs période de comparaison.
 */
export interface ChannelRevenue {
  name: string;
  /** Part en % (0-100). */
  pct: number;
  /** Montant dans la devise d'affichage (rendu via <Money>). */
  amount?: number;
  /** Couleur de la barre (token/hex de canal). */
  color: string;
  /** Part en % sur la période de comparaison → delta affiché si fourni. */
  comparePct?: number;
}

export interface RevenueByChannelCardProps {
  channels: ChannelRevenue[];
  title?: string;
  /** Slot à droite du titre (ex. <PeriodSegmented />). */
  headerAction?: React.ReactNode;
  className?: string;
}

export default function RevenueByChannelCard({
  channels,
  title = 'Revenus par canal',
  headerAction,
  className,
}: RevenueByChannelCardProps) {
  return (
    <Card className={cn('gap-0 overflow-hidden py-0', className)}>
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-2">
        <h3 className="cn-font-heading m-0 text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </h3>
        {headerAction}
      </div>
      <div className="px-4 pb-3">
        {channels.length === 0 && (
          <p className="m-0 py-3 text-xs text-muted-foreground">
            Aucun revenu par canal sur la période.
          </p>
        )}
        {channels.map((channel) => {
          const delta =
            channel.comparePct != null
              ? Math.round((channel.pct - channel.comparePct) * 10) / 10
              : null;
          return (
            <div
              key={channel.name}
              className="flex items-center gap-3 border-t border-border py-2.5 first:border-t-0"
            >
              <span className="w-[74px] shrink-0 text-xs font-semibold text-foreground">
                {channel.name}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-field">
                <div
                  className="h-full rounded-[5px] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${channel.pct}%`, backgroundColor: channel.color }}
                />
              </div>
              <div className="min-w-[66px] shrink-0 text-end">
                <div className="cn-font-heading text-[13px] leading-tight font-semibold text-foreground tabular-nums">
                  {channel.amount != null ? <Money value={channel.amount} decimals={0} /> : `${channel.pct}%`}
                </div>
                {(channel.amount != null || (delta != null && delta !== 0)) && (
                  <div className="mt-px flex items-center justify-end gap-1">
                    {channel.amount != null && (
                      <span className="text-2xs font-semibold text-muted-foreground tabular-nums">
                        {channel.pct}%
                      </span>
                    )}
                    {delta != null && delta !== 0 && (
                      <span
                        className={cn(
                          'text-2xs font-bold tabular-nums',
                          delta > 0 ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {delta > 0 ? '▲' : '▼'}
                        {Math.abs(delta)} pt
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
