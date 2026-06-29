import WIDGET_SKIN_CSS from './widget-skin.css?raw';

/**
 * Skin cosmétique des widgets, en CHAÎNE (asset de template). À injecter dans le CSS de la page
 * (light DOM) : il habille les widgets headless via des variables `--cb-*` (avec fallbacks).
 * Cf. `widget-skin.css` (source) et le contrat `WIDGET-CSS-CONTRACT.md`.
 */
export { WIDGET_SKIN_CSS };

/** Sélecteur sentinelle : présence du skin dans le CSS d'une page (idempotence côté Studio). */
export const WIDGET_SKIN_SENTINEL = '.cb-skin-v1';

/**
 * Contrat de design `--bt-*` (couleurs+rôles, échelle typo, graisses, interlignes, tracking, espacements,
 * rayons, ombres, bordures, contrôles, transitions) émis par le LLM. Le `widget-skin.css` en DÉRIVE son
 * cosmétique (mapping interne `--cb-* ← var(--bt-*, fallback)`). Poser ces variables sur `.cb-widget`
 * (ou une page parente, par cascade) habille les widgets EXACTEMENT comme les pages.
 */
export type DesignVars = Record<string, string>;

/** Conserve uniquement les paires `--bt-*` non vides (défensif). */
export function btVarMap(vars: DesignVars | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!vars) return out;
  for (const [k, v] of Object.entries(vars)) {
    if (k.startsWith('--bt-') && typeof v === 'string' && v) out[k] = v;
  }
  return out;
}

/** Bloc CSS `.cb-widget{ --bt-*: … }` (vide si aucune variable). */
export function buildBtVarsCss(vars: DesignVars | null | undefined): string {
  const decls = Object.entries(btVarMap(vars)).map(([k, v]) => `${k}: ${v};`);
  return decls.length ? `.cb-widget { ${decls.join(' ')} }` : '';
}

/** CSS complet à baker dans une page : contrat de design `--bt-*` + skin. */
export function buildWidgetSkinBlock(vars: DesignVars | null | undefined): string {
  const block = buildBtVarsCss(vars);
  return `/* — Styles widgets (skin) — */\n${block ? block + '\n' : ''}${WIDGET_SKIN_CSS}`;
}

/**
 * Comme `buildWidgetSkinBlock`, mais pose les tokens `--bt-*` ET le mapping `--cb-*` au niveau `:root`
 * (ancêtre commun) plutôt que sur `.cb-widget`. Utile là où des éléments HORS `.cb-widget` doivent hériter
 * le style — typiquement le canvas du constructeur de composite, dont le contenu (`.sb__*`/`.clenzy-*`) est
 * AU-DESSUS des widgets-feuilles. Le mapping ci-dessous DOIT rester aligné sur `widget-skin.css` (bloc `.cb-widget`).
 */
export function buildRootSkinBlock(vars: DesignVars | null | undefined): string {
  const decls = Object.entries(btVarMap(vars)).map(([k, v]) => `${k}: ${v};`).join(' ');
  const mapping = [
    '--cb-accent: var(--bt-color-primary, #6B8A9A);',
    '--cb-on-accent: var(--bt-color-on-primary, #ffffff);',
    '--cb-text: var(--bt-color-text, inherit);',
    '--cb-muted: var(--bt-color-text-muted, rgba(0,0,0,.55));',
    '--cb-surface: var(--bt-color-surface, #fff);',
    '--cb-border: var(--bt-color-border, rgba(0,0,0,.14));',
    '--cb-radius: var(--bt-radius-md, 10px);',
    '--cb-font: var(--bt-font-body, inherit);',
    '--cb-control-h: var(--bt-control-height, 48px);',
  ].join(' ');
  return `/* — Styles widgets (skin, scope :root) — */\n:root { ${decls ? decls + ' ' : ''}${mapping} }\n${WIDGET_SKIN_CSS}`;
}
