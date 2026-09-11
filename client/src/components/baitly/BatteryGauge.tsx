import React from 'react';
import { cn } from '../../utils/cn';
import './deviceAlert.css';

/** Seuils partagés — un même niveau se lit pareil partout dans le produit. */
export const BATTERY_LOW = 20;
export const BATTERY_CRITICAL = 10;

export type BatteryTone = 'critical' | 'low' | 'ok';

/**
 * Gravité d'un niveau de batterie.
 *
 * <p>Source UNIQUE des seuils : la pastille compacte des objets connectés et
 * la jauge d'une alerte lisaient chacune sa paire de constantes. Deux copies
 * d'un seuil, c'est un jour où l'une passe à 15 % et pas l'autre.</p>
 */
export function batteryTone(level: number): BatteryTone {
  if (level <= BATTERY_CRITICAL) return 'critical';
  if (level <= BATTERY_LOW) return 'low';
  return 'ok';
}

/**
 * Deux jetons pour un même sens : l'APLAT prend la teinte vive (une barre n'est
 * pas soumise au contraste de texte), le TEXTE l'encre `-ink`, seule conforme
 * AA sur une carte claire.
 */
const TONE_FILL: Record<BatteryTone, string> = {
  critical: 'var(--bui-destructive)',
  low: 'var(--bui-warning)',
  ok: 'var(--bui-success)',
};

const TONE_INK: Record<BatteryTone, string> = {
  critical: 'var(--bui-destructive-ink)',
  low: 'var(--bui-warning-ink)',
  ok: 'var(--bui-success-ink)',
};

export interface BatteryGaugeProps {
  /** Niveau 0–100. */
  level: number;
  className?: string;
}

/**
 * Jauge de batterie en forme de PILE : corps, borne, et remplissage à la
 * hauteur du niveau.
 *
 * <p>Une barre de progression aurait dit « 12 % de quelque chose » ; la silhouette
 * d'une pile dit de quoi, sans légende. Le remplissage porte la gravité, le
 * pourcentage la reprend en encre lisible — et une pile presque vide respire
 * lentement, ce que `prefers-reduced-motion` fige.</p>
 */
export default function BatteryGauge({ level, className }: BatteryGaugeProps) {
  const clamped = Math.max(0, Math.min(100, level));
  const tone = batteryTone(clamped);

  return (
    <span
      role="img"
      aria-label={`${Math.round(clamped)} %`}
      className={cn('inline-flex items-center gap-2.5', className)}
    >
      <span className="relative inline-flex h-[22px] w-[44px] shrink-0 items-center">
        {/* Corps */}
        <span className="absolute inset-y-0 start-0 end-[5px] overflow-hidden rounded-[5px] border border-border bg-field">
          <span
            className={cn(
              'absolute inset-y-px start-px rounded-[3px] transition-[width] duration-500 ease-out motion-reduce:transition-none',
              tone !== 'ok' && 'bui-alert-breathe',
            )}
            style={{
              // Le trait le plus fin reste visible à 0 % : une pile vide se
              // distingue d'une pile dont le niveau est inconnu.
              width: `calc(${clamped}% - 2px)`,
              minWidth: 2,
              backgroundColor: TONE_FILL[tone],
            }}
          />
        </span>
        {/* Borne */}
        <span className="absolute end-0 h-[9px] w-[4px] rounded-e-[2px] bg-border" />
      </span>

      <span
        className="text-xl leading-none font-semibold tabular-nums"
        style={{ color: TONE_INK[tone] }}
      >
        {Math.round(clamped)}
        <span className="ms-0.5 text-sm font-medium">%</span>
      </span>
    </span>
  );
}
