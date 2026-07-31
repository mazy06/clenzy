import React from 'react';
import { Badge } from './ui';
import { cn } from '../utils/cn';

/**
 * Primitive unique des chips de statut « Signature » — source de vérité du look
 * `-soft` (fond doux + texte couleur, 6px, fw600), qui était jusqu'ici dupliqué
 * dans ~20 `chipSx`/`softChipSx`/`SoftTokens` locaux aux hauteurs/paddings
 * divergents. Le mapping domaine (statut métier → ton) reste côté domaine et
 * alimente cette primitive ; le RENDU est ici, unique.
 *
 * Note : override volontaire du chip global (pilule fw700) → look statut 6px/fw600.
 * (L'arbitrage pilule-vs-6px sur TOUTES les chips est consigné DESIGN_BASELINE §7.)
 *
 * <h3>Pourquoi les couleurs restent en style inline</h3>
 * Le fond et l'encre viennent d'une valeur calculée à l'exécution : token du
 * domaine, hex d'un canal, `color-mix` d'une couleur arbitraire. Tailwind émet
 * ses classes à la COMPILATION en scannant les sources — une classe construite
 * depuis une variable ne serait jamais generee. Seules les dimensions, connues
 * d'avance, sont des classes.
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

/** Gabarits écrits en clair, sans quoi Tailwind ne les émettrait pas. */
const SIZE_CLASS: Record<ChipSize, string> = {
  sm: 'h-[18px] gap-1 px-[4.5px] text-[0.625rem]',
  md: 'h-[22px] gap-1.5 px-1.5 text-[0.6875rem]',
};

/**
 * sx d'une chip de statut à partir de tokens {color,bg} explicites.
 *
 * <p>Conservé pour les `<Chip>` MUI pas encore migrés. Les nouveaux usages
 * passent par {@link StatusChip} ou {@link statusChipClasses}.</p>
 */
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

/** Fond doux d'une couleur arbitraire, hex comme `var(--…)`. */
export const softBackground = (color: string) => `color-mix(in srgb, ${color} 12%, transparent)`;

/**
 * sx d'une chip à partir d'une couleur ARBITRAIRE (hex OU var(--…)) — pour les
 * couleurs « data » hors palette sémantique (canaux, catégories, types). Utilise
 * `color-mix` → compatible hex ET var(), contrairement à l'ancien `${hex}18`.
 */
export function softChipSx(color: string, size: ChipSize = 'md') {
  return toneTokensSx({ color, bg: softBackground(color) }, size);
}

/**
 * Équivalent kit de {@link softChipSx} : classes + style d'une puce de statut, à
 * poser sur un `Badge`. Permet de migrer un `<Chip sx={softChipSx(c)}>` isolé
 * sans passer par le composant complet.
 */
export function statusChipClasses(tokens: ToneTokens, size: ChipSize = 'md', pill = false) {
  return {
    className: cn(SIZE_CLASS[size], 'border-none font-semibold', pill ? 'rounded-full' : 'rounded-md'),
    style: { backgroundColor: tokens.bg, color: tokens.color } as React.CSSProperties,
  };
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
  /**
   * Rayon pilule au lieu du 6 px de statut. Cinq ecrans redefinissaient un
   * `chipSx` local pour cela seul.
   */
  pill?: boolean;
  /**
   * Rend la puce ACTIONNABLE. Elle devient alors un vrai `<button>` : un span
   * muni d'un `onClick` n'est ni focusable, ni declenchable au clavier, ni
   * annonce comme actionnable par un lecteur d'ecran.
   */
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  /** Etat presse, pour une puce qui sert de filtre a bascule. */
  pressed?: boolean;
  /** Desactive la puce actionnable. */
  disabled?: boolean;
  /** Libelle accessible quand le contenu visible ne suffit pas. */
  ariaLabel?: string;
  /** Classes additionnelles. */
  className?: string;
  /** Conservé pour compatibilité d'appel ; appliqué en style inline. */
  sx?: React.CSSProperties;
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
  pill,
  onClick,
  pressed,
  disabled,
  ariaLabel,
  className,
  sx,
}: StatusChipProps) {
  const resolved: ToneTokens = color
    ? { color, bg: softBackground(color) }
    : tokens ?? STATUS_TONES[tone];

  const marque = icon ?? (dot ? (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-[2.5px]"
      style={{ backgroundColor: resolved.color }}
    />
  ) : null);

  const gabarit = statusChipClasses(resolved, size, pill);
  const classes = cn(
    gabarit.className,
    '[&>svg]:shrink-0 [&>svg]:text-current',
    onClick && [
      'cursor-pointer transition-opacity duration-150 hover:opacity-80',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
      'disabled:pointer-events-none disabled:opacity-50',
    ],
    className,
  );
  const style = { ...gabarit.style, ...sx };

  // Une puce actionnable est un BOUTON, pas un span decore d'un onClick : sans
  // cela elle sort de l'ordre de tabulation, ne repond ni a Entree ni a Espace,
  // et n'est pas annoncee comme actionnable.
  if (onClick) {
    return (
      <Badge asChild variant="secondary" className={classes} style={style}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={pressed}
          aria-label={ariaLabel}
        >
          {marque}
          {label}
        </button>
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      // L'encre se propage a l'icone : cote MUI c'etait la regle
      // `& .MuiChip-icon`, ici le svg est un enfant direct du badge.
      className={classes}
      style={style}
      aria-label={ariaLabel}
    >
      {marque}
      {label}
    </Badge>
  );
}
