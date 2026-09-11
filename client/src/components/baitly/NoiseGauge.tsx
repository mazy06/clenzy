import React from 'react';
import { cn } from '../../utils/cn';
import './deviceAlert.css';

/**
 * Bornes de l'échelle, en décibels. FIXES, et c'est le point : deux alertes se
 * comparent d'un coup d'œil parce que le seuil tombe au même endroit. Une
 * échelle qui s'ajuste à la mesure ferait paraître tous les dépassements
 * identiques.
 */
const FLOOR = 30;
const CEILING = 100;

function positionOf(db: number): number {
  const clamped = Math.max(FLOOR, Math.min(CEILING, db));
  return ((clamped - FLOOR) / (CEILING - FLOOR)) * 100;
}

export interface NoiseGaugeProps {
  /** Niveau mesuré, en dB. */
  measuredDb: number;
  /** Seuil de déclenchement, en dB. */
  thresholdDb: number;
  /** Rouge plutôt qu'ambre — une alerte critique. */
  critical?: boolean;
  className?: string;
}

/**
 * Niveau sonore mesuré, situé par rapport à son seuil.
 *
 * <p>« Niveau sonore de 78 dB détecté (seuil : 55 dB) » demande de faire la
 * soustraction. Ici le seuil est un repère sur la piste, la mesure une barre
 * qui le dépasse, et l'écart est écrit. La barre respire quand elle dépasse —
 * même grammaire que la pile d'une serrure, et {@code prefers-reduced-motion}
 * la fige.</p>
 */
export default function NoiseGauge({
  measuredDb,
  thresholdDb,
  critical = false,
  className,
}: NoiseGaugeProps) {
  const over = measuredDb > thresholdDb;
  const excess = Math.round(measuredDb - thresholdDb);
  // Aplat en teinte vive, chiffre en encre : le contraste de texte ne se
  // négocie pas avec la teinte d'un aplat.
  const fill = over
    ? critical ? 'var(--bui-destructive)' : 'var(--bui-warning)'
    : 'var(--bui-success)';
  const ink = over
    ? critical ? 'var(--bui-destructive-ink)' : 'var(--bui-warning-ink)'
    : 'var(--bui-success-ink)';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl leading-none font-semibold tabular-nums" style={{ color: ink }}>
          {Math.round(measuredDb)}
          <span className="ms-1 text-sm font-medium">dB</span>
        </span>
        {over && (
          <span className="text-xs tabular-nums" style={{ color: ink }}>
            +{excess}
          </span>
        )}
      </div>

      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-field"
        role="img"
        aria-label={`${Math.round(measuredDb)} dB / seuil ${thresholdDb} dB`}
      >
        <div
          className={cn('absolute inset-y-0 start-0 rounded-full', over && 'bui-alert-breathe')}
          style={{ width: `${positionOf(measuredDb)}%`, backgroundColor: fill }}
        />
        {/* Repère de seuil : un trait dans la couleur de la carte, qui coupe la
            barre au bon endroit qu'elle l'ait franchi ou non. */}
        <div
          className="absolute inset-y-0 w-0.5 rounded-full bg-card"
          style={{ insetInlineStart: `${positionOf(thresholdDb)}%`, marginInlineStart: -1 }}
        />
      </div>
    </div>
  );
}
