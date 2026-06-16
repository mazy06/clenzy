/**
 * Assainisseur HTML conservateur — SANS dépendance npm.
 *
 * Recopie autonome (pas d'import de `builder/import/*`, couche morte) du sanitizer du builder. Objectif :
 * neutraliser les vecteurs XSS les plus directs sur du HTML importé arbitraire (templates externes,
 * coller, fichier, URL) AVANT toute insertion dans le DOM / l'éditeur GrapesJS. Appliqué au moment de
 * l'injection (`loadIntoEditor`), conformément aux règles sécurité projet (Z7-SEC-01/02 ;
 * `EmailHtmlSanitizer` côté serveur).
 *
 * ⚠️ Volontairement minimal et conservateur. Le durcissement via DOMPurify (whitelist stricte de
 * balises/attributs, parsing DOM réel) reste prévu en repasse ultérieure ; DOMPurify n'est pas une
 * dépendance du projet (contrainte : aucune nouvelle dépendance npm). En attendant, on retire par regex
 * les vecteurs les plus dangereux.
 */

/** Balises entièrement supprimées (contenu inclus) : exécution de code ou intégration arbitraire. */
const DANGEROUS_TAGS = ['script', 'iframe', 'object', 'embed', 'noscript', 'style', 'link', 'meta', 'base'];

/**
 * Retire les balises dangereuses (ouvrante → fermante, contenu compris) puis les balises
 * auto-fermantes / orphelines correspondantes.
 */
function stripDangerousTags(html: string): string {
  let out = html;
  for (const tag of DANGEROUS_TAGS) {
    // Paire <tag …>…</tag> (le `s` rend `.` multi-lignes ; insensible à la casse).
    out = out.replace(new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi'), '');
    // Balise isolée non refermée (ex. <iframe …> sans </iframe>, <meta …>).
    out = out.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, 'gi'), '');
  }
  return out;
}

/** Retire les attributs gestionnaires d'événements `on*=…` (onclick, onerror, onload…). */
function stripEventHandlers(html: string): string {
  // on<event>= "…" | '…' | valeur-sans-quote
  return html.replace(/\son[a-z0-9_-]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

/**
 * Neutralise les schémas d'URL dangereux dans les attributs (href/src/…) : `javascript:`,
 * `vbscript:` et `data:` SAUF `data:image/*` (images inline légitimes conservées).
 */
function stripDangerousUrls(html: string): string {
  // attribut = "valeur" (guillemets simples ou doubles)
  return html.replace(/\b([a-z0-9_-]+)\s*=\s*("([^"]*)"|'([^']*)')/gi, (match, attr, _q, dq, sq) => {
    const value = (dq ?? sq ?? '').trim();
    const lower = value.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:')) return `${attr}="#"`;
    if (lower.startsWith('data:') && !lower.startsWith('data:image/')) return `${attr}="#"`;
    return match;
  });
}

/**
 * Assainit un fragment HTML (client). Conservateur : retire scripts/iframes/objets/style, attributs
 * `on*=`, et schémas `javascript:`/`vbscript:`/`data:` (hors `data:image`). Aucune dépendance npm.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  let out = String(html);
  out = stripDangerousTags(out);
  out = stripEventHandlers(out);
  out = stripDangerousUrls(out);
  return out;
}

/**
 * Assainit un fragment CSS (client). Le CSS ne porte pas de balises, mais peut contenir des vecteurs
 * (`expression(...)`, `javascript:`/`vbscript:` dans une `url(...)`, et un `</style>` qui briserait
 * l'encapsulation à l'injection). On neutralise ces cas ; le reste passe tel quel (GrapesJS reparse).
 */
export function sanitizeCss(css: string): string {
  if (!css) return '';
  let out = String(css);
  // Casse une éventuelle balise fermante glissée dans le CSS (sortie de contexte <style>).
  out = out.replace(/<\/?style\b[^>]*>/gi, '');
  // `expression(...)` (IE legacy mais toujours un vecteur historique).
  out = out.replace(/expression\s*\(/gi, 'none(');
  // `url(javascript:…)` / `url(vbscript:…)` → url vide.
  out = out.replace(/url\(\s*(['"]?)\s*(javascript|vbscript):[^)]*\1\s*\)/gi, 'url()');
  return out;
}
