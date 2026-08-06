// Constantes partagées par PropertiesList et ses vues (carte / grille / tableau).
// Styles alignés sur Baitly UI : palette --bui-*, échelle de rayons shadcn.

export const ICON_BUTTON_SX = {
  p: 0.5,
  borderRadius: '10px', // rounded-lg de l'échelle shadcn
  border: '1px solid var(--bui-border)',
  bgcolor: 'var(--bui-card)',
  color: 'var(--bui-muted-foreground)',
  transition: 'border-color .14s, color .14s, background-color .14s',
  '&:hover': {
    bgcolor: 'var(--bui-muted)',
    borderColor: 'var(--bui-faint)',
    color: 'var(--bui-foreground)',
  },
} as const;

export const ITEMS_PER_PAGE = 6;
export const LIST_ROWS_PER_PAGE_OPTIONS = [10, 25, 50];
export const LIST_DEFAULT_ROWS = 10;

export const LIST_PAPER_SX = {
  border: '1px solid var(--bui-border)',
  boxShadow: 'none',
  borderRadius: '14px', // rounded-xl de l'échelle shadcn
  bgcolor: 'var(--bui-card)',
} as const;

// ─── Chips statut propriété → tokens sémantiques ────────────────────────────
// Couple Baitly UI : encre `-ink` pour le TEXTE (la teinte vive plafonne à
// ~2,2:1 en clair), fond pastel `-soft`.

const PROPERTY_STATUS_TOKEN: Record<string, { fg: string; bg: string }> = {
  ACTIVE: { fg: 'var(--bui-success-ink)', bg: 'var(--bui-success-soft)' },
  INACTIVE: { fg: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' },
  MAINTENANCE: { fg: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
  UNDER_MAINTENANCE: { fg: 'var(--bui-warning-ink)', bg: 'var(--bui-warning-soft)' },
  RENTED: { fg: 'var(--bui-info-ink)', bg: 'var(--bui-info-soft)' },
  SOLD: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
  ARCHIVED: { fg: 'var(--bui-destructive-ink)', bg: 'var(--bui-destructive-soft)' },
};

/** Tokens de statut d'un logement, pour la primitive StatusChip. */
export function propertyStatusTokens(status: string) {
  const tk = PROPERTY_STATUS_TOKEN[status?.toUpperCase()]
    ?? { fg: 'var(--bui-muted-foreground)', bg: 'var(--bui-muted)' };
  return { color: tk.fg, bg: tk.bg };
}

/**
 * Puce « champ » — equipements, services : encre de corps sur fond de champ,
 * cernee d'une hairline. Ce n'est pas un statut : la bordure vient donc d'une
 * classe, pas de la recette `-soft` de la primitive.
 */
export const FIELD_TOKENS = { color: 'var(--bui-foreground)', bg: 'var(--bui-field)' } as const;
// `border-solid` est indispensable : le gabarit de la primitive pose
// `border-none` (border-style), que tailwind-merge ne considere pas en
// conflit avec `border` (border-width). Sans lui, la largeur est bien
// appliquee mais le style reste `none` — bordure invisible.
export const FIELD_CHIP_CLASS = 'border border-solid border-field-line [&>svg]:text-primary';

// ─── Vignette : dégradé déterministe par logement ───────────────────────────
// La maquette propriétés (.pr-img / .pr-lthumb) utilise un dégradé 135° propre
// à chaque logement (placeholder). On le dérive d'un hash stable de l'identité
// du logement : teinte unique reproductible, palette terre/slate sourde (faible
// saturation, luminosité moyenne) pour rester sobre derrière l'icône blanche.
// Ces hex sont des couleurs « data » de vignette placeholder (pas des tokens UI) :
// quand une vraie photo existe, elle se superpose au dégradé (fallback).

/** Hash 32-bit déterministe (djb2) d'une chaîne — stable, sans dépendance. */
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/** Convertit H(0-360) S(%) L(%) en hex. */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lum = l / 100;
  const a = sat * Math.min(lum, 1 - lum);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lum - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Deux teintes désaturées (terre/slate) dérivées de l'identité du logement,
 * pour un dégradé `linear-gradient(135deg, hueA, hueB)` reproductible.
 * Saturation basse (18-26%), luminosité moyenne (52-62%) → sobre, façon les
 * 8 `hue` de la maquette. Renvoie `[hueA, hueB]`.
 */
export function propertyGradientHues(seed: string): [string, string] {
  const h = hashString(seed);
  const baseHue = h % 360;
  const sat = 18 + (h % 9); // 18-26 %
  const lightA = 60;
  const lightB = 48;
  return [hslToHex(baseHue, sat, lightA), hslToHex((baseHue + 18) % 360, sat + 4, lightB)];
}

/** CSS du dégradé de vignette d'un logement (seed = id/nom). */
export function propertyGradientCss(seed: string): string {
  const [a, b] = propertyGradientHues(seed);
  return `linear-gradient(135deg, ${a}, ${b})`;
}
