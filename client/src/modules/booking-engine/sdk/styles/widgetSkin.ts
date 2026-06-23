import WIDGET_SKIN_CSS from './widget-skin.css?raw';

/**
 * Skin cosmétique des widgets, en CHAÎNE (asset de template). À injecter dans le CSS de la page
 * (light DOM) : il habille les widgets headless via des variables `--cb-*` (avec fallbacks).
 * Cf. `widget-skin.css` (source) et le contrat `WIDGET-CSS-CONTRACT.md`.
 */
export { WIDGET_SKIN_CSS };

/** Sélecteur sentinelle : présence du skin dans le CSS d'une page (idempotence côté Studio). */
export const WIDGET_SKIN_SENTINEL = '.cb-skin-v1';

/** Bloc de variables de marque à poser sur `.cb-widget` (surcharge les fallbacks du skin). */
export function buildSkinVarsCss(primaryColor?: string | null, fontFamily?: string | null): string {
  const decls: string[] = [];
  if (primaryColor) decls.push(`--cb-accent: ${primaryColor};`);
  if (fontFamily) decls.push(`--cb-font: ${fontFamily};`);
  return decls.length ? `.cb-widget { ${decls.join(' ')} }` : '';
}

/** CSS complet à baker dans une page : variables de marque + skin. */
export function buildWidgetSkinBlock(primaryColor?: string | null, fontFamily?: string | null): string {
  const vars = buildSkinVarsCss(primaryColor, fontFamily);
  return `/* — Styles widgets (skin) — */\n${vars ? vars + '\n' : ''}${WIDGET_SKIN_CSS}`;
}
