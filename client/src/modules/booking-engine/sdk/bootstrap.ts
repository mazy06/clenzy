import type { BaitlyBookingConfig } from './types';
import { getSharedBookingCore } from './core/BaitlyBookingCore';
import { createBookingI18n } from './i18n';
import { mountPrimitive, type MountContext } from './primitives/mountPrimitive';

/**
 * Bootstrap d'hydratation (B2) — parcours de réservation template-driven, multi-pages.
 *
 * Scanne la page courante pour les marqueurs `data-clenzy-widget="<step>"` et monte, pour chacun, la
 * primitive correspondante via {@link mountPrimitive}. TOUTES les primitives (de cette page ET des
 * pages suivantes du même onglet) partagent le MÊME cœur (état + API), obtenu via
 * {@link getSharedBookingCore} : un seul jeu d'effets de données par page (aucun double-fetch), et un
 * état persistant entre les pages (sessionStorage + URL, B1).
 *
 * Indépendant du monolithe `BaitlyWidget.init` : `init` reste inchangé pour les embeds mono-conteneur.
 */

/** Marqueur scanné sur la page (cible le step). */
const MARKER_ATTR = 'data-clenzy-widget';
/** Marqueur posé après hydratation (idempotence : on ne ré-hydrate jamais un élément déjà monté). */
const HYDRATED_ATTR = 'data-clenzy-hydrated';

/**
 * Options d'hydratation : même config que l'embed, mais SANS `container` (les conteneurs sont les
 * marqueurs trouvés dans le DOM). `apiKey` reste la clé du cœur partagé.
 */
export type HydrateOptions = Omit<BaitlyBookingConfig, 'container'> & {
  /** Racine de scan (défaut : `document`). Permet de cibler un sous-arbre (SSR partiel, tests). */
  root?: ParentNode;
};

/**
 * Hydrate tous les marqueurs `data-clenzy-widget` présents sous `opts.root` (défaut : `document`).
 * Idempotent : les éléments déjà marqués `data-clenzy-hydrated` sont ignorés (réappel sûr après une
 * navigation SPA ou un ajout dynamique de contenu). Renvoie le nombre de marqueurs hydratés.
 */
export function hydrateBookingMarkers(opts: HydrateOptions): number {
  if (typeof document === 'undefined') return 0;
  if (!opts?.apiKey) {
    console.error('[BaitlyBooking] hydrate: apiKey manquante');
    return 0;
  }

  // Cœur PARTAGÉ par apiKey (créé + démarré une seule fois) → état commun à tous les marqueurs.
  const core = getSharedBookingCore({
    apiKey: opts.apiKey,
    baseUrl: opts.baseUrl || window.location.origin,
    slug: opts.slug,
    language: opts.language || 'fr',
    defaults: {
      adults: opts.defaultGuests?.adults ?? 2,
      children: opts.defaultGuests?.children ?? 0,
      displayCurrency: opts.currency || 'EUR',
    },
  });

  const ctx: MountContext = {
    core,
    // i18n du cœur partagé : même langue pour tous les marqueurs de la page.
    i18n: opts.language ? createBookingI18n(opts.language) : core.i18n,
    theme: opts.theme,
    config: { ...opts, container: '' },
  };

  const root: ParentNode = opts.root ?? document;
  const markers = root.querySelectorAll<HTMLElement>(`[${MARKER_ATTR}]`);
  let count = 0;
  markers.forEach((el) => {
    if (el.hasAttribute(HYDRATED_ATTR)) return; // déjà hydraté → idempotent
    const step = el.getAttribute(MARKER_ATTR);
    if (!step) return;
    el.setAttribute(HYDRATED_ATTR, '');
    try {
      mountPrimitive(el, step, ctx);
      count += 1;
    } catch (err) {
      // Un marqueur défaillant ne doit jamais empêcher l'hydratation des autres.
      el.removeAttribute(HYDRATED_ATTR);
      console.error(`[BaitlyBooking] hydratation du marqueur "${step}" échouée:`, err);
    }
  });
  // Groupe filtre en mode COMPACT : le déclencheur ouvre/ferme son panneau popover (le mode déplié est piloté
  // par CSS, rien à hydrater). Idempotent via `data-clenzy-hydrated`.
  root.querySelectorAll<HTMLElement>('[data-cz-filter-toggle]').forEach((btn) => {
    if (btn.hasAttribute(HYDRATED_ATTR)) return;
    btn.setAttribute(HYDRATED_ATTR, '');
    btn.addEventListener('click', () => {
      btn.parentElement?.querySelector('.cb-filter-group__panel')?.classList.toggle('cb-open');
    });
  });
  return count;
}
