import React, { useCallback, useRef } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import { Lock, LockOpen } from '../../../icons';
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
    <Box>
      <Box
        ref={barRef}
        sx={{
          position: 'relative',
          display: 'flex',
          height: BAR_HEIGHT,
          borderRadius: '8px',
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'divider',
          userSelect: 'none',
        }}
      >
        {upstream && upstreamPct > 0 && (
          <Tooltip title={`${upstream.label} · ${formatPct(upstreamPct)}`}>
            <Box
              sx={{
                width: `${upstreamPct}%`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.72rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'common.white',
                // Hachures : cette part sort du circuit avant tout partage,
                // elle ne se lit pas comme les trois autres.
                backgroundImage:
                  'repeating-linear-gradient(45deg, var(--muted) 0 4px, color-mix(in srgb, var(--muted) 80%, black) 4px 8px)',
              }}
            >
              {upstreamPct >= 8 ? formatPct(upstreamPct) : ''}
            </Box>
          </Tooltip>
        )}

        {segments.map((segment, index) => {
          const width = segment.value * scale;
          const adjustable = !disabled && isShareAdjustable(segments, segment.key);
          const isLastSegment = index === segments.length - 1;
          return (
            <React.Fragment key={segment.key}>
              <Box
                sx={{
                  width: `${width}%`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: 'common.white',
                  backgroundColor: segment.color,
                  opacity: segment.locked ? 0.75 : 1,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
              >
                {width >= 8 ? formatPct(segment.value) : ''}
              </Box>
              {!isLastSegment && (
                <Box
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
                  sx={{
                    width: 3,
                    flexShrink: 0,
                    cursor: adjustable ? 'col-resize' : 'not-allowed',
                    backgroundColor: 'background.paper',
                    opacity: adjustable ? 0.55 : 0.25,
                    transition: 'opacity 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                    '&:hover': { opacity: adjustable ? 1 : 0.25 },
                    '&:focus-visible': {
                      outline: '2px solid var(--accent)',
                      outlineOffset: 1,
                      opacity: 1,
                    },
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
      </Box>

      {/* Legende : porte la valeur exacte (les segments etroits ne peuvent pas
          l'afficher) et le verrou, plus lisible ici que dans une bande de 1 %. */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.25 }}>
        {upstream && upstreamPct > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: 'var(--muted)' }} />
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500 }}>
              {upstream.label}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'text.secondary',
              }}
            >
              {formatPct(upstreamPct)}
            </Typography>
          </Box>
        )}

        {segments.map((segment) => (
          <Box key={segment.key} sx={{ display: 'flex', alignItems: 'center', gap: 0.625 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: segment.color }} />
            <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 500 }}>
              {segment.label}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: 'text.primary',
              }}
            >
              {formatPct(segment.value)}
            </Typography>
            {onToggleLock && (
            <Tooltip
              title={
                segment.locked
                  ? `Déverrouiller ${segment.label} — cette part pourra de nouveau absorber les ajustements`
                  : `Verrouiller ${segment.label} — cette part ne bougera plus, les autres serviront de variable d’ajustement`
              }
            >
              <Box
                component="button"
                type="button"
                onClick={() => onToggleLock(segment.key)}
                disabled={disabled}
                aria-pressed={Boolean(segment.locked)}
                aria-label={
                  segment.locked ? `Déverrouiller ${segment.label}` : `Verrouiller ${segment.label}`
                }
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  p: 0,
                  border: '1px solid',
                  borderColor: segment.locked
                    ? `color-mix(in srgb, ${segment.color} 45%, transparent)`
                    : 'transparent',
                  borderRadius: '5px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  bgcolor: segment.locked
                    ? `color-mix(in srgb, ${segment.color} 12%, transparent)`
                    : 'transparent',
                  color: segment.locked ? segment.color : 'text.disabled',
                  transition:
                    'color 150ms cubic-bezier(0.22, 1, 0.36, 1), background-color 150ms cubic-bezier(0.22, 1, 0.36, 1)',
                  '&:hover': { color: segment.locked ? segment.color : 'text.secondary' },
                  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
                }}
              >
                {segment.locked ? (
                  <Lock size={11} strokeWidth={2} />
                ) : (
                  <LockOpen size={11} strokeWidth={1.75} />
                )}
              </Box>
            </Tooltip>
            )}
          </Box>
        ))}

        {/* Une part amont a ete prelevee : les trois valeurs ci-dessus portent
            sur ce qu'il reste, pas sur ce que paie le voyageur. Sans ce rappel
            elles s'additionnent a plus de 100 % a la lecture, alors que les
            largeurs de la barre, elles, sont bien a l'echelle du total. */}
        {upstream && upstreamPct > 0 && (
          <Typography
            sx={{
              fontSize: '0.72rem',
              color: 'text.disabled',
              fontStyle: 'italic',
            }}
          >
            (% du net)
          </Typography>
        )}
      </Box>
    </Box>
  );
}
