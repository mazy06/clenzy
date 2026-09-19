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
  labelKey: string;
}

/** Groupes de tokens par nature de propriété (clé = `tokens` passé à une propriété `bt-value`). */
export const BT_TOKEN_GROUPS: Record<string, BtToken[]> = {
  color: [
    { cssVar: '--bt-color-primary', labelKey: 'studioTokens.color_primary' },
    { cssVar: '--bt-color-primary-hover', labelKey: 'studioTokens.color_primary_hover' },
    { cssVar: '--bt-color-on-primary', labelKey: 'studioTokens.color_on_primary' },
    { cssVar: '--bt-color-accent', labelKey: 'studioTokens.color_accent' },
    { cssVar: '--bt-color-bg', labelKey: 'studioTokens.color_bg' },
    { cssVar: '--bt-color-surface', labelKey: 'studioTokens.color_surface' },
    { cssVar: '--bt-color-surface-2', labelKey: 'studioTokens.color_surface_2' },
    { cssVar: '--bt-color-text', labelKey: 'studioTokens.color_text' },
    { cssVar: '--bt-color-text-muted', labelKey: 'studioTokens.color_text_muted' },
    { cssVar: '--bt-color-border', labelKey: 'studioTokens.color_border' },
    { cssVar: '--bt-color-divider', labelKey: 'studioTokens.color_divider' },
  ],
  font: [
    { cssVar: '--bt-font-heading', labelKey: 'studioTokens.font_heading' },
    { cssVar: '--bt-font-body', labelKey: 'studioTokens.font_body' },
  ],
  text: [
    { cssVar: '--bt-text-xs', labelKey: 'studioTokens.text_xs' },
    { cssVar: '--bt-text-sm', labelKey: 'studioTokens.text_sm' },
    { cssVar: '--bt-text-md', labelKey: 'studioTokens.text_md' },
    { cssVar: '--bt-text-lg', labelKey: 'studioTokens.text_lg' },
    { cssVar: '--bt-text-xl', labelKey: 'studioTokens.text_xl' },
    { cssVar: '--bt-text-2xl', labelKey: 'studioTokens.text_2xl' },
    { cssVar: '--bt-text-3xl', labelKey: 'studioTokens.text_3xl' },
  ],
  weight: [
    { cssVar: '--bt-weight-normal', labelKey: 'studioTokens.weight_normal' },
    { cssVar: '--bt-weight-medium', labelKey: 'studioTokens.weight_medium' },
    { cssVar: '--bt-weight-semibold', labelKey: 'studioTokens.weight_semibold' },
    { cssVar: '--bt-weight-bold', labelKey: 'studioTokens.weight_bold' },
    { cssVar: '--bt-heading-weight', labelKey: 'studioTokens.heading_weight' },
  ],
  leading: [
    { cssVar: '--bt-leading-tight', labelKey: 'studioTokens.leading_tight' },
    { cssVar: '--bt-leading-normal', labelKey: 'studioTokens.leading_normal' },
    { cssVar: '--bt-leading-relaxed', labelKey: 'studioTokens.leading_relaxed' },
  ],
  tracking: [
    { cssVar: '--bt-tracking-tight', labelKey: 'studioTokens.tracking_tight' },
    { cssVar: '--bt-tracking-normal', labelKey: 'studioTokens.tracking_normal' },
    { cssVar: '--bt-tracking-wide', labelKey: 'studioTokens.tracking_wide' },
  ],
  space: [
    { cssVar: '--bt-space-1', labelKey: 'studioTokens.space_1' },
    { cssVar: '--bt-space-2', labelKey: 'studioTokens.space_2' },
    { cssVar: '--bt-space-3', labelKey: 'studioTokens.space_3' },
    { cssVar: '--bt-space-4', labelKey: 'studioTokens.space_4' },
    { cssVar: '--bt-space-5', labelKey: 'studioTokens.space_5' },
    { cssVar: '--bt-space-6', labelKey: 'studioTokens.space_6' },
    { cssVar: '--bt-section-y', labelKey: 'studioTokens.section_y' },
  ],
  radius: [
    { cssVar: '--bt-radius-sm', labelKey: 'studioTokens.radius_sm' },
    { cssVar: '--bt-radius-md', labelKey: 'studioTokens.radius_md' },
    { cssVar: '--bt-radius-lg', labelKey: 'studioTokens.radius_lg' },
    { cssVar: '--bt-radius-pill', labelKey: 'studioTokens.radius_pill' },
    { cssVar: '--bt-radius-button', labelKey: 'studioTokens.radius_button' },
    { cssVar: '--bt-radius-card', labelKey: 'studioTokens.radius_card' },
    { cssVar: '--bt-radius-input', labelKey: 'studioTokens.radius_input' },
  ],
  shadow: [
    { cssVar: '--bt-shadow-sm', labelKey: 'studioTokens.shadow_sm' },
    { cssVar: '--bt-shadow-md', labelKey: 'studioTokens.shadow_md' },
    { cssVar: '--bt-shadow-lg', labelKey: 'studioTokens.shadow_lg' },
    { cssVar: '--bt-shadow-card', labelKey: 'studioTokens.shadow_card' },
  ],
  duration: [
    { cssVar: '--bt-duration', labelKey: 'studioTokens.duration' },
  ],
  ease: [
    { cssVar: '--bt-ease', labelKey: 'studioTokens.ease' },
  ],
};

/** `var(--bt-x)` correspondant à un token, ex. tokenCssValue({cssVar:'--bt-color-primary'}) → 'var(--bt-color-primary)'. */
export function tokenCssValue(token: BtToken): string {
  return `var(${token.cssVar})`;
}
