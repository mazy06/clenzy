/**
 * Catalogue des tokens de design `--bt-*` (source unique côté Studio), MIROIR du vocabulaire émis par les
 * modèles LLM (cf. backend `SiteGenerationPrompts` + `widget-skin.css`). Sert au type de propriété custom
 * `bt-value` du Style Manager : chaque champ de marque propose ces tokens (→ `var(--bt-*)`) en plus de la
 * saisie libre, pour que le dev manuel et l'IA partagent EXACTEMENT le même langage de design.
 */

export interface BtToken {
  /** Nom de la variable CSS, ex. `--bt-color-primary`. */
  cssVar: string;
  /** Libellé affiché dans le menu. */
  label: string;
}

/** Groupes de tokens par nature de propriété (clé = `tokens` passé à une propriété `bt-value`). */
export const BT_TOKEN_GROUPS: Record<string, BtToken[]> = {
  color: [
    { cssVar: '--bt-color-primary', label: 'Primaire' },
    { cssVar: '--bt-color-primary-hover', label: 'Primaire (survol)' },
    { cssVar: '--bt-color-on-primary', label: 'Sur primaire' },
    { cssVar: '--bt-color-accent', label: 'Accent' },
    { cssVar: '--bt-color-bg', label: 'Fond' },
    { cssVar: '--bt-color-surface', label: 'Surface' },
    { cssVar: '--bt-color-surface-2', label: 'Surface 2' },
    { cssVar: '--bt-color-text', label: 'Texte' },
    { cssVar: '--bt-color-text-muted', label: 'Texte atténué' },
    { cssVar: '--bt-color-border', label: 'Bordure' },
    { cssVar: '--bt-color-divider', label: 'Séparateur' },
  ],
  font: [
    { cssVar: '--bt-font-heading', label: 'Police titres' },
    { cssVar: '--bt-font-body', label: 'Police corps' },
  ],
  text: [
    { cssVar: '--bt-text-xs', label: 'XS' },
    { cssVar: '--bt-text-sm', label: 'SM' },
    { cssVar: '--bt-text-md', label: 'MD (corps)' },
    { cssVar: '--bt-text-lg', label: 'LG' },
    { cssVar: '--bt-text-xl', label: 'XL' },
    { cssVar: '--bt-text-2xl', label: '2XL' },
    { cssVar: '--bt-text-3xl', label: '3XL' },
  ],
  weight: [
    { cssVar: '--bt-weight-normal', label: 'Normal' },
    { cssVar: '--bt-weight-medium', label: 'Medium' },
    { cssVar: '--bt-weight-semibold', label: 'Semi-bold' },
    { cssVar: '--bt-weight-bold', label: 'Bold' },
    { cssVar: '--bt-heading-weight', label: 'Titres' },
  ],
  leading: [
    { cssVar: '--bt-leading-tight', label: 'Serré' },
    { cssVar: '--bt-leading-normal', label: 'Normal' },
    { cssVar: '--bt-leading-relaxed', label: 'Aéré' },
  ],
  tracking: [
    { cssVar: '--bt-tracking-tight', label: 'Serré' },
    { cssVar: '--bt-tracking-normal', label: 'Normal' },
    { cssVar: '--bt-tracking-wide', label: 'Large' },
  ],
  space: [
    { cssVar: '--bt-space-1', label: '1 (xs)' },
    { cssVar: '--bt-space-2', label: '2 (sm)' },
    { cssVar: '--bt-space-3', label: '3 (md)' },
    { cssVar: '--bt-space-4', label: '4 (lg)' },
    { cssVar: '--bt-space-5', label: '5 (xl)' },
    { cssVar: '--bt-space-6', label: '6 (2xl)' },
    { cssVar: '--bt-section-y', label: 'Section (vertical)' },
  ],
  radius: [
    { cssVar: '--bt-radius-sm', label: 'Petit' },
    { cssVar: '--bt-radius-md', label: 'Moyen' },
    { cssVar: '--bt-radius-lg', label: 'Grand' },
    { cssVar: '--bt-radius-pill', label: 'Pilule' },
    { cssVar: '--bt-radius-button', label: 'Bouton' },
    { cssVar: '--bt-radius-card', label: 'Carte' },
    { cssVar: '--bt-radius-input', label: 'Champ' },
  ],
  shadow: [
    { cssVar: '--bt-shadow-sm', label: 'Petite' },
    { cssVar: '--bt-shadow-md', label: 'Moyenne' },
    { cssVar: '--bt-shadow-lg', label: 'Grande' },
    { cssVar: '--bt-shadow-card', label: 'Carte' },
  ],
  duration: [
    { cssVar: '--bt-duration', label: 'Durée' },
  ],
  ease: [
    { cssVar: '--bt-ease', label: 'Courbe' },
  ],
};

/** `var(--bt-x)` correspondant à un token, ex. tokenCssValue({cssVar:'--bt-color-primary'}) → 'var(--bt-color-primary)'. */
export function tokenCssValue(token: BtToken): string {
  return `var(${token.cssVar})`;
}
