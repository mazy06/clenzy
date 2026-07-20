import React from 'react';
import { Box, Chip } from '@mui/material';

/**
 * Primitive unique des chips de statut « Signature » — source de vérité du look
 * `-soft` (fond doux + texte couleur, 6px, fw600), qui était jusqu'ici dupliqué
 * dans ~20 `chipSx`/`softChipSx`/`SoftTokens` locaux aux hauteurs/paddings
 * divergents. Le mapping domaine (statut métier → ton) reste côté domaine et
 * alimente cette primitive ; le RENDU est ici, unique.
 *
 * Note : override volontaire du chip global (pilule fw700) → look statut 6px/fw600.
 * (L'arbitrage pilule-vs-6px sur TOUTES les chips est consigné DESIGN_BASELINE §7.)
 */

export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'accent' | 'neutral';

export interface ToneTokens {
  /** Couleur de texte/icône (token --xxx). */
  color: string;
  /** Fond doux (token --xxx-soft). */
  bg: string;
}

/** Tons sémantiques → tokens. Seule définition à maintenir. */
export const STATUS_TONES: Record<StatusTone, ToneTokens> = {
  ok:      { color: 'var(--ok)',     bg: 'var(--ok-soft)' },
  warn:    { color: 'var(--warn)',   bg: 'var(--warn-soft)' },
  err:     { color: 'var(--err)',    bg: 'var(--err-soft)' },
  info:    { color: 'var(--info)',   bg: 'var(--info-soft)' },
  accent:  { color: 'var(--accent)', bg: 'var(--accent-soft)' },
  neutral: { color: 'var(--muted)',  bg: 'var(--hover)' },
};

type ChipSize = 'sm' | 'md';

const DIMS: Record<ChipSize, { height: number; fontSize: string; px: number }> = {
  sm: { height: 18, fontSize: '0.625rem', px: 0.75 },
  md: { height: 22, fontSize: '0.6875rem', px: 1 },
};

/** sx d'une chip de statut à partir de tokens {color,bg} explicites. */
export function toneTokensSx(tokens: ToneTokens, size: ChipSize = 'md') {
  const d = DIMS[size];
  return {
    height: d.height,
    fontSize: d.fontSize,
    fontWeight: 600,
    backgroundColor: tokens.bg,
    color: tokens.color,
    border: 'none',
    borderRadius: '6px',
    '& .MuiChip-icon': { color: tokens.color },
    '& .MuiChip-label': { px: d.px },
  } as const;
}

/**
 * sx d'une chip à partir d'une couleur ARBITRAIRE (hex OU var(--…)) — pour les
 * couleurs « data » hors palette sémantique (canaux, catégories, types). Utilise
 * `color-mix` → compatible hex ET var(), contrairement à l'ancien `${hex}18`.
 */
export function softChipSx(color: string, size: ChipSize = 'md') {
  return toneTokensSx(
    { color, bg: `color-mix(in srgb, ${color} 12%, transparent)` },
    size,
  );
}

export interface StatusChipProps {
  /** Ton sémantique. Ignoré si `tokens` est fourni. */
  tone?: StatusTone;
  /** Tokens {color,bg} explicites (override `tone`). */
  tokens?: ToneTokens;
  /** Couleur arbitraire (hex/var) → fond color-mix. Override `tone`/`tokens`. */
  color?: string;
  label: React.ReactNode;
  size?: ChipSize;
  /** Pastille carrée colorée en tête (au lieu d'une icône). */
  dot?: boolean;
  /** Icône custom (ex: logo canal). Prioritaire sur `dot`. */
  icon?: React.ReactElement;
  sx?: object;
}

/**
 * Chip de statut canonique. Choisir UNE source de couleur :
 *   <StatusChip tone="ok" label="Payé" />
 *   <StatusChip tokens={INTERVENTION_TYPE_TOKENS[type]} label={...} />
 *   <StatusChip color="#E0735A" label="Airbnb" />
 */
export default function StatusChip({
  tone = 'neutral',
  tokens,
  color,
  label,
  size = 'md',
  dot,
  icon,
  sx,
}: StatusChipProps) {
  const resolved: ToneTokens = color
    ? { color, bg: `color-mix(in srgb, ${color} 12%, transparent)` }
    : tokens ?? STATUS_TONES[tone];

  const dotIcon = dot ? (
    <Box
      component="span"
      sx={{ width: 8, height: 8, borderRadius: '2.5px', backgroundColor: resolved.color, flexShrink: 0 }}
    />
  ) : undefined;

  return (
    <Chip
      icon={icon ?? dotIcon}
      label={label}
      size="small"
      sx={{
        ...toneTokensSx(resolved, size),
        ...(((icon ?? dotIcon)) ? { '& .MuiChip-icon': { ml: size === 'sm' ? 0.75 : 1, mr: -0.25, color: resolved.color } } : {}),
        ...sx,
      }}
    />
  );
}
