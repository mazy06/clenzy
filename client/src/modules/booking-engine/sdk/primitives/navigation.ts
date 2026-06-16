/**
 * Navigation template-driven (B3) — le parcours EMERGE du template, jamais imposé par le SDK.
 *
 * Le template déclare, sur le marqueur DOM de chaque primitive actionnable, deux attributs OPTIONNELS :
 *  - `data-clenzy-next`   : chemin où aller APRÈS l'action (ex. recherche → page résultats, sélection
 *                           d'un logement → page détail, validation → page confirmation) ;
 *  - `data-clenzy-return` : page de confirmation du template, utilisée comme `return_url` Stripe.
 *
 * Sans ces attributs : AUCUNE navigation (comportement B2 inchangé) — le template peut alors relier ses
 * pages par ses propres liens `<a href>`. La navigation est donc purement additive et opt-in.
 */

const NEXT_ATTR = 'data-clenzy-next';
const RETURN_ATTR = 'data-clenzy-return';

/** Lit `data-clenzy-next` sur le marqueur (chemin de destination après l'action). */
export function readNext(el: HTMLElement): string | null {
  return normalizePath(el.getAttribute(NEXT_ATTR));
}

/** Lit `data-clenzy-return` sur le marqueur (page de confirmation pour le retour Stripe). */
export function readReturn(el: HTMLElement): string | null {
  return normalizePath(el.getAttribute(RETURN_ATTR));
}

/** Nettoie une valeur d'attribut (trim ; null/vide → null). */
function normalizePath(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  return v.length > 0 ? v : null;
}

/**
 * Navigue vers `path` (chemin relatif ou URL absolue déclarée par le template). No-op si `path` est null.
 * Une navigation pleine page (et non un push d'historique SPA) est volontaire : chaque « page » du
 * parcours est une vraie page du site, et l'état partagé SURVIT grâce à la persistance du cœur (B1).
 */
export function navigateTo(path: string | null): void {
  if (!path) return;
  window.location.assign(path);
}

/**
 * Construit l'URL ABSOLUE de retour Stripe à partir du chemin `data-clenzy-return`, résolu sur l'origine
 * courante (le serveur la valide ensuite : HTTPS + host de l'org, sinon ignorée). Renvoie `undefined`
 * si aucun chemin n'est déclaré ou si la résolution échoue → le serveur utilisera son `success_url` par défaut.
 */
export function resolveReturnUrl(returnPath: string | null): string | undefined {
  if (!returnPath) return undefined;
  try {
    return new URL(returnPath, window.location.origin).toString();
  } catch {
    return undefined;
  }
}
