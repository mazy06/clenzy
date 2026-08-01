import React from 'react';
import { cn } from '../utils/cn';
import { Card } from '../components/ui';

import { Money } from './Money';

/**
 * Carte « Revenus par canal » (réf. maquette Signature « .bl-chrow ») :
 * barre de répartition par canal + %. Comparaison optionnelle : si `comparePct`
 * est fourni, affiche le delta en points (▲/▼ coloré) vs période précédente.
 * Un slot `headerAction` permet d'y poser un sélecteur de période (PeriodSegmented).
 */
export interface ChannelRevenue {
  name: string;
  /** Part en % (0-100). */
  pct: number;
  /** Montant dans la devise d'affichage — rendu via <Money> (icône SAR/MAD). */
  amount?: number;
  /** Couleur de la barre (token/hex de canal). */
  color: string;
  /** Part en % sur la période de comparaison → affiche le delta si fourni. */
  comparePct?: number;
}

export interface RevenueByChannelCardProps {
  channels: ChannelRevenue[];
  title?: string;
  /** Slot à droite du titre (ex: <PeriodSegmented … /> pour comparer des périodes). */
  headerAction?: React.ReactNode;
}

export default function RevenueByChannelCard({
  channels,
  title = 'Revenus par canal',
  headerAction,
}: RevenueByChannelCardProps) {
  return (
    <Card className="gap-0 py-0 bg-[var(--card)] border-[var(--line)] overflow-hidden">
      <div className={cn('flex items-center justify-between gap-1.5 px-[17px] pt-[15px]', headerAction ? 'pb-[11px]' : 'pb-1')}>
        <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[15px] font-semibold text-[var(--ink)] tracking-[-0.01em]">
          {title}
        </p>
        {headerAction}
      </div>

      <div className="px-[17px] pb-2">
        {channels.length === 0 && (
          <p className="cn-text-body1 text-[12px] text-[var(--muted)] py-3.5">
            Aucun revenu par canal sur la période.
          </p>
        )}
        {channels.map((c) => {
          const delta = c.comparePct != null ? Math.round((c.pct - c.comparePct) * 10) / 10 : null;
          return (
            <div
              key={c.name}
              className="flex items-center gap-[11px] py-[11px] border-t border-solid border-[var(--line)] first-of-type:border-t-0"
            >
              <p className="cn-text-body1 text-[12.5px] font-semibold text-[var(--ink)] w-[74px] shrink-0">
                {c.name}
              </p>
              <div className="flex-1 h-[8px] rounded-[5px] bg-[var(--field)] overflow-hidden">
                {/* Largeur et couleur calculees a l'execution : style inline obligatoire. */}
                <div
                  className="h-full rounded-[5px] transition-[width] duration-300 ease-[var(--ease-out)] motion-reduce:transition-none"
                  style={{ width: `${c.pct}%`, backgroundColor: c.color }}
                />
              </div>
              <div className="shrink-0 text-end min-w-[66px]">
                {/* Montant (devise) en tête, % + delta en sous-ligne. */}
                <p className="cn-text-body1 font-[family-name:var(--font-display)] text-[13px] font-semibold text-[var(--ink)] leading-[1.2] tabular-nums">
                  {c.amount != null ? <Money value={c.amount} decimals={0} /> : `${c.pct}%`}
                </p>
                {(c.amount != null || (delta != null && delta !== 0)) && (
                  <div className="flex justify-end items-center gap-[5px] mt-px">
                    {c.amount != null && (
                      <span className="text-[10.5px] font-semibold text-[var(--muted)] tabular-nums">
                        {c.pct}%
                      </span>
                    )}
                    {delta != null && delta !== 0 && (
                      <span className={cn('cn-text-body1 text-[10.5px] font-bold tabular-nums', delta > 0 ? 'text-[var(--ok)]' : 'text-[var(--err)]')}>
                        {delta > 0 ? '▲' : '▼'}{Math.abs(delta)} pt
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
