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
    // `@container` et non un media query : cette carte est posee dans un
    // panneau REDIMENSIONNABLE du tableau de bord. Sa largeur ne suit donc pas
    // celle de l'ecran — elle peut etre etroite sur un grand ecran (panneau
    // reduit) comme large sur mobile (widgets empiles). Seule sa propre largeur
    // dit si la ligne tient en un seul rang.
    <Card className={cn('@container gap-0 overflow-hidden py-0', className)}>
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
          // Les canaux du catalogue sont tous affichés, y compris ceux qui n'ont
          // rien produit : les estomper garde le classement lisible d'un coup
          // d'œil, sans les faire disparaître.
          const idle = channel.amount != null && channel.amount <= 0;
          return (
            <div
              key={channel.name}
              // Sous 20rem de large, la ligne se plie : le nom passe seul au
              // dessus, la barre et le montant se partagent le rang suivant.
              // En un seul rang, le nom, la barre et le montant retiendraient
              // 164 px fixes et la barre tomberait a zero.
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2.5 first:border-t-0 @[20rem]:flex-nowrap"
            >
              <span
                className={cn(
                  // `truncate` : le nom vient du catalogue de canaux et n'a
                  // aucune longueur garantie. Sans lui, un libelle plus long
                  // que la colonne debordait sur la barre.
                  'w-full truncate text-xs font-semibold @[20rem]:w-[74px] @[20rem]:shrink-0',
                  idle ? 'text-muted-foreground' : 'text-foreground'
                )}
              >
                {channel.name}
              </span>
              {/* `min-w-0` : sans lui la base automatique du flex empeche la
                  barre de descendre sous sa largeur de contenu. */}
              <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-[5px] bg-field">
                <div
                  className="h-full rounded-[5px] transition-[width] duration-300 motion-reduce:transition-none"
                  style={{ width: `${channel.pct}%`, backgroundColor: channel.color }}
                />
              </div>
              <div className="min-w-[66px] shrink-0 text-end">
                <div
                  className={cn(
                    'cn-font-heading text-[13px] leading-tight font-semibold tabular-nums',
                    idle ? 'text-muted-foreground' : 'text-foreground'
                  )}
                >
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
                          delta > 0 ? 'text-success-ink' : 'text-destructive-ink'
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
