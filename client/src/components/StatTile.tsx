import React from 'react';
import { cn } from '../utils/cn';
import { Skeleton } from './ui';

interface StatTileProps {
  /** Icône inline (accent par défaut, ou la couleur passée) à gauche du label. */
  icon: React.ReactNode;
  /** Libellé court (muted, sentence-case) sur la ligne de l'icône. */
  label: string;
  /** Valeur principale — texte, nombre ou nœud (ex: <Money/> pour afficher le
   *  glyphe de devise au lieu du code). */
  value: React.ReactNode;
  /** Unité affichée en petit + muted après la valeur (ex: "%", ou
   *  <CurrencySymbol/>). */
  unit?: React.ReactNode;
  /** Couleur de l'icône (hex/token). Défaut : accent. */
  color?: string;
  /** Ligne secondaire sous la valeur (delta/contexte). ReactNode → highlight possible
   *  (ex: <><b>+8%</b> vs janvier</> avec b coloré --ok). */
  hint?: React.ReactNode;
  /** Affiche un Skeleton à la place de la valeur. */
  loading?: boolean;
  /** Callback de click. Si fourni, le tile devient cliquable (hover lift). */
  onClick?: () => void;
}

/**
 * Carte KPI standardisée (réf. maquette Signature « .bl-kpi ») :
 *  - ligne 1 : icône inline (accent) + label muted 11.5px fw600
 *  - valeur : Space Grotesk 27px fw600 --ink (tabular-nums) + unité petite muted
 *  - delta  : 11px fw600 --muted, highlight --ok possible via ReactNode
 *  - carte plate r14 hairline, AUCUNE ombre au repos (hover lift si cliquable).
 *
 * Le `<b>` d'un hint ReactNode est coloré --ok par défaut (tendance positive) ;
 * passer un style inline pour une autre couleur.
 */
export default function StatTile({
  icon,
  label,
  value,
  unit,
  color = 'var(--accent)',
  hint,
  loading = false,
  onClick,
}: StatTileProps) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'px-[17px] py-[16px] rounded-[14px] bg-[var(--card)] border border-solid border-[var(--line)]',
        'transition-[border-color,transform,box-shadow] duration-200 motion-reduce:transition-none',
        'hover:border-[var(--line-2)]',
        onClick
          ? 'cursor-pointer hover:-translate-y-px hover:shadow-[var(--shadow-card)] active:translate-y-0'
          : 'cursor-default',
      )}
    >
      {/* Ligne 1 : icône inline + label */}
      <div className="flex items-center gap-[7px] min-w-0">
        {/* `color` est calcule a l'execution : passe par style, une classe Tailwind
            ne peut pas naitre d'une variable. */}
        <span className="inline-flex shrink-0" style={{ color }}>
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement<{ size?: number; strokeWidth?: number }>, {
                size: 15,
                strokeWidth: 1.85,
              })
            : icon}
        </span>
        <span className="text-[11.5px] font-semibold text-[var(--muted)] overflow-hidden text-ellipsis whitespace-nowrap">
          {label}
        </span>
      </div>

      {/* Valeur */}
      {loading ? (
        <Skeleton className="mt-[11px] w-[90px] h-[34px] rounded-[4px]" />
      ) : (
        <p className="cn-text-body1 tabular-nums text-[1.375rem] min-[900px]:text-[1.6875rem] font-semibold tracking-[-0.02em] leading-[1.1] text-[var(--ink)] mt-[11px] whitespace-nowrap" style={{ fontFamily: 'var(--font-display)' }}>
          {value}
          {unit && (
            <span className="text-[0.625em] text-[var(--muted)] ms-1 font-semibold">
              {unit}
            </span>
          )}
        </p>
      )}

      {/* Delta / contexte */}
      {hint && !loading && (
        <div className="cn-text-body1 text-[11px] font-semibold text-[var(--muted)] mt-[5px] [&_b]:text-[var(--ok)] [&_b]:font-semibold">
          {hint}
        </div>
      )}
    </div>
  );
}
