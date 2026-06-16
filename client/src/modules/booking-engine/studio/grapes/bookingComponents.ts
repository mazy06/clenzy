import type { Editor } from 'grapesjs';
import { BaitlyWidget } from '../../sdk/BaitlyWidget';
import { widgetThemeFromTokens } from '../../widgetTheme';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import { API_CONFIG } from '../../../../config/api';
import {
  BOOKING_WIDGET_ATTR,
  BOOKING_WIDGET_DEFS,
  attrValueOf,
  type BookingIconShape,
  type BookingWidgetDef,
} from './bookingWidgetDefs';

/**
 * Pont SDK ↔ GrapesJS (G1) : enregistre, pour CHAQUE `BookingWidgetDef`, un type de composant
 * GrapesJS qui monte le VRAI widget SDK (`BaitlyWidget`, Shadow DOM) DANS le canvas, plus son bloc
 * drag&drop. Les defs viennent de `bookingWidgetDefs.ts` (couture G2 : y ajouter une entrée suffit).
 *
 * ⚠️ Le canvas GrapesJS est un IFRAME. On monte donc le widget dans le DOCUMENT DE L'IFRAME, jamais
 * dans `document` : le host est créé via `el.ownerDocument` (= document de l'iframe) et attaché à `el`
 * (la vue du composant). Le SDK isole son rendu en Shadow DOM, ce qui le protège du CSS de l'éditeur.
 * À VALIDER AU NAVIGATEUR : montage effectif dans l'iframe, propreté du démontage au remove/destroy,
 * et absence d'appels réseau parasites (le SDK fetch /properties dès le mount).
 *
 * - apiKey absent → encart neutre (aucun montage, aucun appel réseau).
 * - À l'export HTML : seul le `<div data-clenzy-widget="…">` marqueur est sérialisé (point de montage
 *   stable hydraté par le SDK/SSR) ; le widget live de l'éditeur n'est jamais persisté.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Contexte d'enregistrement fourni par GrapesStudio. `getConfig()` est un ACCESSEUR (pas une valeur
 * figée) : la vue lit la config courante à chaque (re)mount, pour refléter clé API / thème à jour
 * sans réenregistrer les types de composants.
 */
export interface BookingComponentsCtx {
  getConfig: () => BookingEngineConfig | null;
}

// Aperçu éditeur NEUTRE : dans le canvas, le widget ne reprend PAS la couleur de marque de la config
// (terracotta…) — il s'affiche en gris neutre pour ne pas imposer de couleur au template en cours
// d'édition. Le widget PUBLIÉ, lui, utilisera le thème réel de l'org (rendu SSR, G4). NB : le widget
// étant isolé en Shadow DOM, il ne peut PAS hériter du CSS du template → on le neutralise (pas de teinte).
const NEUTRAL_PREVIEW_PRIMARY = '#64748b';

/** Construit une icône SVG (def) en DOM sûr, dans le document fourni (hôte OU iframe). */
function buildIcon(shape: BookingIconShape, doc: Document, size = 22): SVGSVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  for (const { tag, attrs } of shape.paths) {
    const node = doc.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  }
  return svg;
}

/** Sérialise l'icône d'une def en chaîne pour le `media` du BlockManager (statique, sans entrée externe). */
function iconMarkup(shape: BookingIconShape): string {
  return new XMLSerializer().serializeToString(buildIcon(shape, document));
}

/**
 * `componentConfig` à passer au SDK pour ne monter QUE le micro-widget d'une def. `widgetType: null`
 * (widget complet) → layout vide ⇒ le SDK rend son formulaire de recherche par défaut.
 */
function componentConfigFor(def: BookingWidgetDef): string {
  const widgetLayout = def.widgetType
    ? [{ type: def.widgetType, ...(def.defaultProps ? { props: def.defaultProps } : {}) }]
    : [];
  return JSON.stringify({ widgetLayout, styleMode: 'template' });
}

/**
 * Monte le widget SDK live dans `el` (du canvas iframe). Retourne une fonction de démontage.
 * Si la clé API manque, affiche un encart neutre (aucun montage, aucun appel réseau).
 */
function mountLiveWidget(el: HTMLElement, def: BookingWidgetDef, config: BookingEngineConfig | null): () => void {
  // `el.ownerDocument` = document de l'IFRAME du canvas (≠ `document` de l'app). On crée le host DANS
  // ce document pour que le widget vive dans le canvas, pas dans la page de l'éditeur.
  const doc = el.ownerDocument || document;
  el.replaceChildren();
  el.classList.add('clenzy-booking-mount');
  el.setAttribute('data-clenzy-mount', def.id);

  const apiKey = config?.apiKey;
  if (!apiKey || !config) {
    // Encart neutre : pas de clé publique → rien à monter (et surtout aucun fetch réseau).
    const hint = doc.createElement('div');
    hint.className = 'clenzy-booking-placeholder';
    const inner = doc.createElement('div');
    inner.className = 'clenzy-booking-placeholder__inner';
    const icon = doc.createElement('div');
    icon.className = 'clenzy-booking-placeholder__icon';
    icon.appendChild(buildIcon(def.icon, doc, 28));
    const title = doc.createElement('div');
    title.className = 'clenzy-booking-placeholder__title';
    title.textContent = def.label;
    const sub = doc.createElement('div');
    sub.className = 'clenzy-booking-placeholder__hint';
    sub.textContent = 'Génère la clé publique (onglet Diffusion) pour afficher l’aperçu.';
    inner.append(icon, title, sub);
    hint.appendChild(inner);
    el.appendChild(hint);
    return () => el.replaceChildren();
  }

  const host = doc.createElement('div');
  el.appendChild(host);

  const lang = (['fr', 'en', 'ar'].includes(config.defaultLanguage) ? config.defaultLanguage : 'fr') as 'fr' | 'en' | 'ar';
  const widget = new BaitlyWidget({
    container: host,
    apiKey,
    baseUrl: API_CONFIG.BASE_URL,
    // Aperçu neutre (cf. NEUTRAL_PREVIEW_PRIMARY) : ni couleur de marque, ni tokens.
    theme: widgetThemeFromTokens(NEUTRAL_PREVIEW_PRIMARY, config.fontFamily, null),
    customCss: config.customCss ?? undefined,
    componentConfig: componentConfigFor(def),
    organizationId: config.organizationId,
    language: lang,
    currency: config.defaultCurrency,
  });
  widget.mount();

  return () => {
    try {
      widget.destroy();
    } catch {
      /* démontage best-effort : un échec ne doit pas bloquer la destruction du composant */
    }
    el.replaceChildren();
  };
}

/** Enregistre un type de composant + son bloc pour une def. */
function registerOne(editor: Editor, def: BookingWidgetDef, ctx: BookingComponentsCtx): void {
  const attrValue = attrValueOf(def);
  // Démontage de l'instance live courante, par vue. (Closure sur la vue : une instance par composant.)
  let unmount: (() => void) | null = null;

  editor.DomComponents.addType(def.id, {
    // Re-typage au chargement : tout div marqué `data-clenzy-widget="<value>"` redevient ce widget.
    isComponent: (el) =>
      el.getAttribute?.(BOOKING_WIDGET_ATTR) === attrValue ? { type: def.id } : undefined,

    model: {
      defaults: {
        // tagName + attributes = source de vérité de l'export HTML (point de montage stable).
        tagName: 'div',
        name: def.label,
        attributes: { [BOOKING_WIDGET_ATTR]: attrValue },
        // Bloc atomique : pas d'édition de contenu, pas de drop interne, pas d'enfants persistés
        // (l'export ne contient que le div marqueur ; le SDK injecte le reste à l'hydratation).
        droppable: false,
        editable: false,
        highlightable: true,
        components: [],
      },
    },

    view: {
      // Montage LIVE du SDK dans le canvas (iframe). Rejoué à chaque render de la vue.
      onRender({ el }) {
        if (unmount) unmount();
        unmount = mountLiveWidget(el as HTMLElement, def, ctx.getConfig());
      },
      // Démontage propre quand le composant est retiré (suppression / destroy de l'éditeur).
      removed() {
        if (unmount) {
          unmount();
          unmount = null;
        }
      },
    },
  });

  // Bloc drag&drop correspondant. `content: { type }` → dépose une instance du composant ci-dessus.
  editor.BlockManager.add(def.id, {
    label: def.label,
    category: def.category,
    media: iconMarkup(def.icon),
    content: { type: def.id },
    select: true,
  });
}

/**
 * Enregistre tous les widgets de réservation (`BOOKING_WIDGET_DEFS`) sur l'éditeur fourni.
 * Idempotent à l'échelle d'une instance d'éditeur (appelé une fois après l'init).
 */
export function registerBookingComponents(editor: Editor, ctx: BookingComponentsCtx): void {
  for (const def of BOOKING_WIDGET_DEFS) {
    registerOne(editor, def, ctx);
  }
}
