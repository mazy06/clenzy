import React from 'react';
import { X } from 'lucide-react';
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
 * d'avance, sont des classes. Les tons sémantiques pointent donc les variables
 * Baitly UI `--bui-*` en VALEUR CSS, pas en utility Tailwind.
 */

export type StatusTone = 'ok' | 'warn' | 'err' | 'info' | 'accent' | 'neutral';

export interface ToneTokens {
  /** Couleur de texte/icône (token --xxx). */
  color: string;
  /** Fond doux (token --xxx-soft). */
  bg: string;
}

/**
 * Tons sémantiques → tokens. Seule définition à maintenir.
 *
 * <p>Couple Baitly UI conforme AA : l'encre est le jeton `-ink` (la teinte vive
 * plafonne à ~2,2:1 sur une carte claire, `-ink` mesure ≥ 4,5:1), le fond est le
 * jeton `-soft`. La teinte vive n'apparaît que sur la pastille décorative, cf.
 * {@link TONE_DOTS}.</p>
 *
 * <p>`accent` lit désormais la primaire Baitly, comme les cinq autres tons :
 * l'identité est MONOCHROME (bleu nuit du wordmark) et ne porte plus de teinte
 * choisie par l'utilisateur. Le ton reste dans l'énumération — il est passé par
 * une vingtaine d'écrans — mais il ne désigne plus qu'« la couleur de marque ».</p>
 */
export const STATUS_TONES: Record<StatusTone, ToneTokens> = {
  ok:      { color: 'var(--bui-success-ink)',     bg: 'var(--bui-success-soft)' },
  warn:    { color: 'var(--bui-warning-ink)',     bg: 'var(--bui-warning-soft)' },
  err:     { color: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  info:    { color: 'var(--bui-info-ink)',        bg: 'var(--bui-info-soft)' },
  accent:  { color: 'var(--bui-primary)',         bg: 'var(--bui-primary-soft)' },
  neutral: { color: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' },
};

/**
 * Teinte VIVE de chaque ton, réservée à la pastille : un aplat de 8 px n'est pas
 * du texte, il n'est donc pas soumis au 4,5:1 et gagne à rester saturé là où
 * l'encre du libellé, elle, doit passer en `-ink`.
 */
const TONE_DOTS: Record<StatusTone, string> = {
  ok:      'var(--bui-success)',
  warn:    'var(--bui-warning)',
  err:     'var(--bui-destructive)',
  info:    'var(--bui-info)',
  accent:  'var(--bui-primary)',
  neutral: 'var(--bui-muted-foreground)',
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

/**
 * Variante SELECTION : bordure visible, fond transparent au repos, teinte
 * pleine une fois choisie. Rien a voir avec un statut, qui ne se choisit pas —
 * d'ou une entree distincte plutot qu'un booleen de plus sur la meme recette.
 */
export function selectChipClasses(tokens: ToneTokens, selected: boolean, size: ChipSize = 'md', pill = false) {
  return {
    // `border-solid` est indispensable : le Badge de base pose
    // `border border-transparent` sans jamais fixer le border-STYLE, et le
    // projet tourne sans preflight Tailwind (coexistence MUI). Sans lui, la
    // bordure d'une puce de selection a bien une largeur mais un style `none`
    // — donc invisible.
    className: cn(SIZE_CLASS[size], 'border border-solid font-medium', pill ? 'rounded-full' : 'rounded-md'),
    style: selected
      ? { backgroundColor: tokens.bg, color: tokens.color, borderColor: tokens.color }
      : { backgroundColor: 'transparent', color: 'var(--bui-muted-foreground)', borderColor: 'var(--bui-border)' },
  } as { className: string; style: React.CSSProperties };
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
  /**
   * Rend la puce SUPPRIMABLE : une croix apparait a droite.
   *
   * <p>Combinee a `onClick`, elle impose une structure a deux boutons freres
   * dans un conteneur neutre : imbriquer un bouton dans un bouton est invalide
   * en HTML, et le navigateur y reagit de facon imprevisible.</p>
   */
  onDelete?: React.MouseEventHandler<HTMLButtonElement>;
  /** Libelle accessible du bouton de suppression. */
  deleteLabel?: string;
  /**
   * Puce de SELECTION : bordure au repos, teinte pleine une fois choisie.
   * A combiner avec `onClick` — une puce qu'on choisit est un controle.
   */
  outlined?: boolean;
  /** Etat choisi de la puce de selection. */
  selected?: boolean;
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
  outlined,
  selected,
  onClick,
  onDelete,
  deleteLabel = 'Retirer',
  pressed,
  disabled,
  ariaLabel,
  className,
  sx,
}: StatusChipProps) {
  const resolved: ToneTokens = color
    ? { color, bg: softBackground(color) }
    : tokens ?? STATUS_TONES[tone];

  // Une couleur explicite (`color`) ou des tokens de domaine (`tokens`) font
  // autorite ; sur un ton semantique la pastille reprend la teinte vive, que
  // l'encre `-ink` du libelle a quittee pour tenir le contraste.
  const couleurPastille = color || tokens ? resolved.color : TONE_DOTS[tone];

  const marque = icon ?? (dot ? (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-[2.5px]"
      style={{ backgroundColor: couleurPastille }}
    />
  ) : null);

  const gabarit = outlined
    ? selectChipClasses(resolved, Boolean(selected), size, pill)
    : statusChipClasses(resolved, size, pill);
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

  const croix = onDelete ? (
    <button
      type="button"
      onClick={onDelete}
      disabled={disabled}
      aria-label={deleteLabel}
      className="-me-0.5 inline-flex cursor-pointer items-center rounded-full text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <X className="size-3" />
    </button>
  ) : null;

  // Deux actions dans une puce = deux boutons FRERES. Un bouton imbrique dans
  // un bouton est invalide, et le clic sur la croix declencherait aussi celui
  // du corps.
  if (onClick && onDelete) {
    return (
      <Badge variant="secondary" className={classes} style={style}>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={pressed}
          aria-label={ariaLabel}
          className="inline-flex cursor-pointer items-center gap-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {marque}
          {label}
        </button>
        {croix}
      </Badge>
    );
  }

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
      {croix}
    </Badge>
  );
}
