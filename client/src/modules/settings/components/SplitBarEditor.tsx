import React, { useCallback, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../../../components/ui';
import { Lock, LockOpen } from '../../../icons';
import { cn } from '../../../utils/cn';
import {
  redistributeShares,
  isShareAdjustable,
  type SplitShare,
} from './splitShares';

export interface SplitBarSegment extends SplitShare {
  label: string;
  color: string;
}

export interface SplitBarEditorProps {
  segments: SplitBarSegment[];
  /** Recoit le tableau complet, deja redistribue a somme constante. */
  onChange: (segments: SplitBarSegment[]) => void;
  /**
   * Bascule le verrou d'une part. Omis quand le verrouillage n'a pas de sens —
   * les cadenas sont alors masques plutot qu'inertes : un cadenas visible mais
   * sans effet est pire qu'absent, il promet un controle qui n'existe pas.
   */
  onToggleLock?: (key: string) => void;
  /**
   * Part prelevee en amont (commission du canal), affichee en tete de barre.
   * Non editable : elle est fixee par la plateforme de reservation, pas ici.
   */
  upstream?: { label: string; value: number };
  disabled?: boolean;
}

const BAR_HEIGHT = 34;
/** Pas du clavier, en points. Shift = pas fin. */
const STEP = 1;
const FINE_STEP = 0.1;

const formatPct = (value: number) =>
  `${value.toFixed(1).replace(/\.0$/, '').replace('.', ',')} %`;

/**
 * Barre de repartition editable a la souris.
 *
 * <p>Chaque frontiere entre deux segments est une poignee : la traîner
 * redimensionne le segment de gauche, et l'ecart est repris sur les segments
 * <b>non verrouilles</b> — pas seulement le voisin. C'est ce qui permet de
 * geler la part du proprietaire par contrat et de laisser la conciergerie
 * servir de variable d'ajustement.</p>
 *
 * <p>Les poignees sont des `separator` ARIA pilotables aux fleches : un
 * reglage qui n'existe qu'a la souris est inaccessible au clavier, et la
 * precision au dixieme de point y est de toute facon plus sure.</p>
 */
export default function SplitBarEditor({
  segments,
  onChange,
  onToggleLock,
  upstream,
  disabled = false,
}: SplitBarEditorProps) {
  const barRef = useRef<HTMLDivElement | null>(null);

  // Echelle : quand une commission amont est affichee, les parts n'occupent
  // que le reste de la barre — sinon les largeurs mentiraient sur le net.
  const upstreamPct = upstream?.value ?? 0;
  const scale = (100 - upstreamPct) / 100;

  const applyValue = useCallback(
    (key: string, nextValue: number) => {
      const next = redistributeShares(segments, key, nextValue) as SplitBarSegment[];
      if (next !== segments) onChange(next);
    },
    [segments, onChange],
  );

  /**
   * Traduit une position de curseur en valeur pour le segment a gauche de la
   * poignee : largeur cumulee jusqu'a lui, retranchee de la part amont.
   */
  const valueFromPointer = useCallback(
    (clientX: number, index: number) => {
      const bar = barRef.current;
      if (!bar) return null;
      const rect = bar.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;
      const pctOfBar = Math.min(Math.max(ratio * 100, 0), 100);
      const withinShares = (pctOfBar - upstreamPct) / scale;
      const before = segments.slice(0, index).reduce((sum, s) => sum + s.value, 0);
      return Math.round((withinShares - before) * 10) / 10;
    },
    [segments, upstreamPct, scale],
  );

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, index: number) => {
      if (disabled) return;
      const segment = segments[index];
      if (!isShareAdjustable(segments, segment.key)) return;

      event.preventDefault();
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);

      const onMove = (moveEvent: PointerEvent) => {
        const next = valueFromPointer(moveEvent.clientX, index);
        if (next !== null) applyValue(segment.key, next);
      };
      const onUp = () => {
        handle.releasePointerCapture(event.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
    },
    [disabled, segments, valueFromPointer, applyValue],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent, index: number) => {
      if (disabled) return;
      const segment = segments[index];
      if (!isShareAdjustable(segments, segment.key)) return;

      const step = event.shiftKey ? FINE_STEP : STEP;
      const delta =
        event.key === 'ArrowRight' || event.key === 'ArrowUp'
          ? step
          : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
            ? -step
            : 0;
      if (delta === 0) return;

      event.preventDefault();
      applyValue(segment.key, Math.round((segment.value + delta) * 10) / 10);
    },
    [disabled, segments, applyValue],
  );

  return (
    <div>
      <div
        ref={barRef}
        className="relative flex overflow-hidden rounded-md border border-solid border-border select-none"
        style={{ height: BAR_HEIGHT }}
      >
        {upstream && upstreamPct > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center justify-center text-[0.72rem] font-bold tabular-nums text-white"
                style={{
                  width: `${upstreamPct}%`,
                  // Hachures : cette part sort du circuit avant tout partage,
                  // elle ne se lit pas comme les trois autres.
                  backgroundImage:
                    'repeating-linear-gradient(45deg, var(--bui-muted-foreground) 0 4px, color-mix(in srgb, var(--bui-muted-foreground) 80%, var(--bui-foreground)) 4px 8px)',
                }}
              >
                {upstreamPct >= 8 ? formatPct(upstreamPct) : ''}
              </div>
            </TooltipTrigger>
            <TooltipContent>{`${upstream.label} · ${formatPct(upstreamPct)}`}</TooltipContent>
          </Tooltip>
        )}

        {segments.map((segment, index) => {
          const width = segment.value * scale;
          const adjustable = !disabled && isShareAdjustable(segments, segment.key);
          const isLastSegment = index === segments.length - 1;
          return (
            <React.Fragment key={segment.key}>
              <div
                className={cn(
                  'flex min-w-0 items-center justify-center overflow-hidden text-[0.72rem] font-bold tabular-nums text-white',
                  segment.locked ? 'opacity-75' : 'opacity-100',
                )}
                style={{ width: `${width}%`, backgroundColor: segment.color }}
              >
                {width >= 8 ? formatPct(segment.value) : ''}
              </div>
              {!isLastSegment && (
                <div
                  role="separator"
                  tabIndex={adjustable ? 0 : -1}
                  aria-orientation="vertical"
                  aria-label={`${segment.label} — ${formatPct(segment.value)}`}
                  aria-valuenow={segment.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-disabled={!adjustable}
                  onPointerDown={(e) => handlePointerDown(e, index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  className={cn(
                    'w-[3px] shrink-0 bg-card transition-opacity duration-150 ease-out-quart',
                    'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    adjustable
                      ? 'cursor-col-resize opacity-55 hover:opacity-100'
                      : 'cursor-not-allowed opacity-25',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Legende : porte la valeur exacte (les segments etroits ne peuvent pas
          l'afficher) et le verrou, plus lisible ici que dans une bande de 1 %. */}
      <div className="flex flex-wrap gap-2 mt-2">
        {upstream && upstreamPct > 0 && (
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-[2px] bg-muted-foreground" />
            <p className="text-xs text-muted-foreground font-medium">
              {upstream.label}
            </p>
            <p className="text-xs font-bold tabular-nums text-muted-foreground">
              {formatPct(upstreamPct)}
            </p>
          </div>
        )}

        {segments.map((segment) => (
          <div className="flex items-center gap-1" key={segment.key}>
            <div className="size-2 rounded-[2px]" style={{ backgroundColor: segment.color }} />
            <p className="text-xs text-muted-foreground font-medium">
              {segment.label}
            </p>
            <p className="text-xs font-bold tabular-nums text-foreground">
              {formatPct(segment.value)}
            </p>
            {onToggleLock && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onToggleLock(segment.key)}
                  disabled={disabled}
                  aria-pressed={Boolean(segment.locked)}
                  aria-label={
                    segment.locked ? `Déverrouiller ${segment.label}` : `Verrouiller ${segment.label}`
                  }
                  className={cn(
                    'inline-flex size-5 items-center justify-center rounded-sm border border-solid p-0',
                    'transition-[color,background-color] duration-150 ease-out-quart motion-reduce:transition-none',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
                    disabled ? 'cursor-not-allowed' : 'cursor-pointer',
                    // Verrouille : teinte et fond derives de la couleur du segment,
                    // connue seulement a l'execution — passes en style inline.
                    !segment.locked && 'text-faint hover:text-muted-foreground',
                  )}
                  style={{
                    borderColor: segment.locked
                      ? `color-mix(in srgb, ${segment.color} 45%, transparent)`
                      : 'transparent',
                    backgroundColor: segment.locked
                      ? `color-mix(in srgb, ${segment.color} 12%, transparent)`
                      : 'transparent',
                    color: segment.locked ? segment.color : undefined,
                  }}
                >
                  {segment.locked ? (
                    <Lock size={11} strokeWidth={2} />
                  ) : (
                    <LockOpen size={11} strokeWidth={1.75} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {segment.locked
                  ? `Déverrouiller ${segment.label} — cette part pourra de nouveau absorber les ajustements`
                  : `Verrouiller ${segment.label} — cette part ne bougera plus, les autres serviront de variable d’ajustement`}
              </TooltipContent>
            </Tooltip>
            )}
          </div>
        ))}

        {/* Une part amont a ete prelevee : les trois valeurs ci-dessus portent
            sur ce qu'il reste, pas sur ce que paie le voyageur. Sans ce rappel
            elles s'additionnent a plus de 100 % a la lecture, alors que les
            largeurs de la barre, elles, sont bien a l'echelle du total. */}
        {upstream && upstreamPct > 0 && (
          <p className="text-xs text-muted-foreground opacity-60 italic">
            (% du net)
          </p>
        )}
      </div>
    </div>
  );
}
