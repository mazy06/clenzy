import type { Editor } from 'grapesjs';
import { mountPrimitive } from '../../sdk/primitives/mountPrimitive';
import { createEditorPreview, type EditorPreview } from './editorPreviewCore';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';
import {
  BOOKING_WIDGET_ATTR,
  BOOKING_WIDGET_DEFS,
  attrValueOf,
  type BookingIconShape,
  type BookingWidgetDef,
  type WidgetProps,
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

/**
 * Cœur d'aperçu PARTAGÉ par éditeur : tous les widgets de palette d'une page se montent dessus (état
 * commun) → l'aperçu est interactif (dates → prix, sélection → détail). Créé à la 1re demande, détruit
 * quand l'éditeur est détruit. Cf. `editorPreviewCore`.
 */
const editorPreviews = new WeakMap<Editor, EditorPreview>();
function getEditorPreview(editor: Editor, ctx: BookingComponentsCtx): EditorPreview {
  let p = editorPreviews.get(editor);
  if (!p) {
    p = createEditorPreview(ctx.getConfig());
    editorPreviews.set(editor, p);
  }
  return p;
}

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
 * Label HTML d'un bloc de palette (parité ancien Studio) : titre + description sur deux lignes. Le
 * BlockManager rend ce HTML dans `.gjs-block-label` ; le CSS (`grapesStudio.css`) dispose la ligne
 * (icône à gauche, texte au centre, « + » à droite). `title`/`description` sont des libellés internes.
 */
export function blockLabelHtml(title: string, description?: string): string {
  const t = `<span class="cz-bk-title">${title}</span>`;
  const d = description ? `<span class="cz-bk-desc">${description}</span>` : '';
  return `${t}${d}`;
}

/** Enregistre un type de composant + son bloc pour une def. */
function registerOne(editor: Editor, def: BookingWidgetDef, ctx: BookingComponentsCtx): void {
  const attrValue = attrValueOf(def);
  const traits = def.traits ?? [];

  /** Props PAR INSTANCE lues sur les propriétés du modèle (traits `changeProp`). R2b. */
  const readInstanceProps = (model: { get: (k: string) => unknown }): WidgetProps | undefined => {
    if (!traits.length) return undefined;
    const out: WidgetProps = {};
    for (const t of traits) {
      const v = model.get(t.name);
      if (v !== undefined && v !== null && v !== '') out[t.name] = v as string | number | boolean;
    }
    return out;
  };

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
        // R2b : traits de config par instance — `changeProp` ⇒ stockés en PROPRIÉTÉS du modèle (pas en
        // attributs bruts), puis sérialisés dans `data-clenzy-props` par `init()` ci-dessous.
        traits: traits.map((t) => ({
          type: t.type,
          name: t.name,
          label: t.label,
          changeProp: true,
          ...(t.options ? { options: t.options } : {}),
        })),
        // Valeurs initiales des props liées aux traits (sinon contrôles vides au dépôt du bloc).
        ...(def.defaultProps ?? {}),
      },
      // R2b : maintient l'attribut JSON `data-clenzy-props` (lu par l'aperçu ET l'hydratation runtime).
      init() {
        if (!traits.length) return;
        // Page rechargée : restaurer les props depuis l'attribut sauvegardé AVANT d'écouter/re-sérialiser
        // (sinon les defaults écraseraient la config de l'utilisateur).
        const existing = this.getAttributes()['data-clenzy-props'];
        if (typeof existing === 'string') {
          try {
            const saved = JSON.parse(existing) as Record<string, unknown>;
            const restore: Record<string, unknown> = {};
            for (const t of traits) if (saved[t.name] !== undefined) restore[t.name] = saved[t.name];
            if (Object.keys(restore).length) this.set(restore);
          } catch {
            /* JSON illisible → on garde les defaults */
          }
        }
        const sync = () => {
          this.addAttributes({ 'data-clenzy-props': JSON.stringify(readInstanceProps(this) ?? {}) });
        };
        sync();
        for (const t of traits) this.on(`change:${t.name}`, sync);
      },
    },

    view: {
      // R2b : re-rend l'aperçu live quand un trait change (la prop modifiée se reflète dans le canvas).
      init() {
        for (const t of traits) this.listenTo(this.model, `change:${t.name}`, () => this.render());
      },
      // Montage sur le CŒUR PARTAGÉ d'aperçu (état commun → widgets interactifs entre eux). Les props
      // par instance (R2b) sont lues par `mountPrimitive` depuis l'attribut `data-clenzy-props` du marqueur.
      onRender() {
        const el = this.el as HTMLElement;
        el.replaceChildren();
        el.classList.add('clenzy-booking-mount');
        el.setAttribute('data-clenzy-mount', def.id);
        try {
          mountPrimitive(el, def.id, getEditorPreview(editor, ctx).ctx);
        } catch (err) {
          console.error('[Studio] aperçu widget échoué:', def.id, err);
        }
      },
      // Démontage : on vide le DOM (le cœur partagé est détruit avec l'éditeur, pas par widget).
      removed() {
        (this.el as HTMLElement | undefined)?.replaceChildren();
      },
    },
  });

  // Bloc drag&drop correspondant. `content: { type }` → dépose une instance du composant ci-dessus.
  // Label HTML (titre + description) = rendu « ligne » de l'ancienne palette Studio (cf. grapesStudio.css).
  editor.BlockManager.add(def.id, {
    label: blockLabelHtml(def.label, def.description),
    category: def.category,
    media: iconMarkup(def.icon),
    // Tag DOM pour la synchro sélection canvas → palette (cf. GrapesStudio `highlightBlockForSelection`).
    attributes: { 'data-cz-block': def.id },
    content: { type: def.id },
    select: true,
  });
}

/**
 * Réconciliation des marqueurs — vocabulaire RUNTIME (parcours `mountPrimitive` / `BaitlyBooking.hydrate`).
 *
 * Les templates natifs (cf. `galleryTemplates`) utilisent les valeurs de PARCOURS (`search`, `results`,
 * `property`, `confirmation`…) : c'est ce que le SDK hydrate à la PUBLICATION. Pour que ces marqueurs
 * s'AFFICHENT aussi dans le canvas de l'éditeur, on enregistre un type de composant par step, mappé sur
 * le micro-widget d'aperçu correspondant — SANS jamais réécrire la valeur du marqueur (préservée à
 * l'export, donc l'hydratation runtime reste correcte). property/confirmation/checkout n'ont pas de
 * micro-widget dédié → encart libellé neutre.
 */
const STEP_TO_DEF_ID: Record<string, string | null> = {
  search: null, // aperçu = mock de barre de recherche (rendu réel = primitive `search` du SDK à la publication)
  results: 'booking-property-results',
  'property-list': 'booking-property-results',
  dates: 'booking-dates',
  availability: 'booking-dates',
  guests: 'booking-guests',
  currency: 'booking-currency',
  price: 'booking-price-summary',
  cart: 'booking-cart',
  'guest-form': 'booking-guest-form',
  account: 'booking-account',
  property: null,
  checkout: null,
  confirmation: null,
};

/** Libellés des steps sans micro-widget d'aperçu (rendu réel à la publication). */
const STEP_LABELS: Record<string, string> = {
  property: 'Détail du logement',
  checkout: 'Paiement',
  confirmation: 'Confirmation de réservation',
};

const DEF_BY_ID = new Map(BOOKING_WIDGET_DEFS.map((d) => [d.id, d]));

/**
 * Résout l'id du BLOC de palette (`data-cz-block`) correspondant à un composant sélectionné dans le
 * canvas — pour la synchro sélection → palette (cf. GrapesStudio `highlightBlockForSelection`). Couvre
 * les 3 vocabulaires possibles d'un composant :
 *  - bloc déposé depuis la palette : marqueur/type = id de def (`booking-*`) ;
 *  - widget de template : marqueur = step runtime (`results`, `dates`…), type = `clenzy-step-<step>` ;
 *  - bloc natif : type = `text` / `image` (= id de bloc).
 * Retourne `null` si aucun bloc unique ne correspond (step sans micro-widget, conteneur générique…).
 */
/**
 * Steps SANS micro-widget d'aperçu dédié (`STEP_TO_DEF_ID = null`) → bloc de palette correspondant, pour
 * la surbrillance UNIQUEMENT (n'affecte pas l'aperçu) :
 *  - `search` : barre COMPOSITE (ville+dates+voyageurs+bouton) → bloc composite « Barre de recherche » ;
 *  - `property`/`checkout`/`confirmation` : widgets équivalents ajoutés depuis.
 */
const STEP_HIGHLIGHT_FALLBACK: Record<string, string> = {
  search: 'search',
  property: 'booking-property-summary',
  checkout: 'booking-checkout-button',
  confirmation: 'booking-confirmation',
};

/** Bloc de palette correspondant à un step de parcours (mapping aperçu, sinon repli surbrillance). */
function stepToBlockId(step: string): string | null {
  return STEP_TO_DEF_ID[step] || STEP_HIGHLIGHT_FALLBACK[step] || null;
}

export function resolveBlockId(marker?: string, type?: string): string | null {
  if (marker) {
    if (DEF_BY_ID.has(marker)) return marker;
    if (marker in STEP_TO_DEF_ID || marker in STEP_HIGHLIGHT_FALLBACK) return stepToBlockId(marker);
  }
  if (type) {
    if (DEF_BY_ID.has(type)) return type;
    const step = type.startsWith('clenzy-step-') ? type.slice('clenzy-step-'.length) : null;
    if (step) return stepToBlockId(step);
    return type; // blocs natifs (text/image…) : le type EST l'id de bloc
  }
  return null;
}

/** Enregistre un type de composant par step de parcours (vocabulaire runtime), pour l'aperçu éditeur. */
/** Steps de parcours embarquant un calendrier → exposent le trait « Calendrier (1/2 mois) ». */
const CALENDAR_STEPS = new Set(['search', 'dates']);

function registerStepType(editor: Editor, step: string, ctx: BookingComponentsCtx): void {
  const typeId = `clenzy-step-${step}`;
  const defId = STEP_TO_DEF_ID[step];
  const def = defId ? DEF_BY_ID.get(defId) ?? null : null;
  const hasCalendar = CALENDAR_STEPS.has(step);

  // Trait direct (sans changeProp) → écrit l'attribut `data-clenzy-calendar-months` sur le marqueur,
  // sérialisé dans le HTML et lu au runtime par `mountPrimitive`. Défaut runtime : 2 (cf. readCalendarMonths).
  const traits = hasCalendar
    ? [{ type: 'select', name: 'data-clenzy-calendar-months', label: 'Calendrier',
         options: [{ id: '2', name: '2 mois' }, { id: '1', name: '1 mois' }] }]
    : [];

  editor.DomComponents.addType(typeId, {
    // Re-typage au chargement : un div `data-clenzy-widget="<step>"` redevient ce composant d'aperçu.
    isComponent: (el) =>
      el.getAttribute?.(BOOKING_WIDGET_ATTR) === step ? { type: typeId } : undefined,
    model: {
      defaults: {
        tagName: 'div',
        name: def?.label ?? STEP_LABELS[step] ?? step,
        // La valeur du marqueur est PRÉSERVÉE (= step) → l'hydratation runtime reste correcte.
        attributes: { [BOOKING_WIDGET_ATTR]: step },
        droppable: false,
        editable: false,
        highlightable: true,
        traits,
        components: [],
      },
    },
    view: {
      // Re-rend l'aperçu quand le réglage calendrier change (le trait modifie l'attribut du marqueur).
      init() {
        if (hasCalendar) this.listenTo(this.model, 'change:attributes', () => this.render());
      },
      // Aperçu sur le CŒUR PARTAGÉ (même chemin que le runtime + que les widgets de palette) → la barre
      // de recherche et toutes les étapes de template sont rendues HEADLESS et interactives (≠ mock CSS).
      onRender({ el }) {
        const node = el as HTMLElement;
        node.replaceChildren();
        node.classList.add('clenzy-booking-mount');
        try {
          mountPrimitive(node, step, getEditorPreview(editor, ctx).ctx);
        } catch (err) {
          console.error('[Studio] aperçu de step échoué:', step, err);
        }
      },
      removed() {
        (this.el as HTMLElement | undefined)?.replaceChildren();
      },
    },
  });
}

/**
 * Enregistre tous les widgets de réservation (`BOOKING_WIDGET_DEFS`, vocabulaire éditeur = blocs
 * drag&drop) PLUS les types de step du parcours (vocabulaire runtime, pour l'aperçu des templates).
 * Idempotent à l'échelle d'une instance d'éditeur (appelé une fois après l'init).
 *
 * NB : pas de bloc « Barre de recherche » composite dans la palette — la barre (ville + dates +
 * voyageurs + bouton) est un COMPOSITE à construire via les widgets granulaires (futur composeur de
 * composites), pas un bloc figé au CSS codé en dur.
 */
export function registerBookingComponents(editor: Editor, ctx: BookingComponentsCtx): void {
  // Détruit le cœur d'aperçu partagé quand l'éditeur est détruit (libère état/abonnements démo).
  editor.on('destroy', () => {
    const p = editorPreviews.get(editor);
    if (p) { p.destroy(); editorPreviews.delete(editor); }
  });
  for (const def of BOOKING_WIDGET_DEFS) {
    registerOne(editor, def, ctx);
  }
  for (const step of Object.keys(STEP_TO_DEF_ID)) {
    registerStepType(editor, step, ctx);
  }
}

const EDITOR_INTERACTION_STYLE_ID = 'cz-editor-interaction';
const EDITOR_INTERACTION_CSS = [
  // Le marqueur du widget reste cliquable (sélection/drag GrapesJS)…
  '.clenzy-booking-mount{pointer-events:auto;}',
  // …mais en mode ÉDITION son contenu live (inputs/selects/popovers) est INERTE → le clic/drag « traverse »
  // jusqu\'au widget au lieu d\'ouvrir un select. L\'aperçu (`preview`) retire `.cz-edit-inert` → interactif.
  '.cz-edit-inert .clenzy-booking-mount *{pointer-events:none!important;}',
  // Conteneurs de mise en page VIDES → zone de dépôt visible (édition seulement).
  '.cz-edit-inert [data-cz-row]:empty,.cz-edit-inert [data-cz-stack]:empty{min-height:56px;border:1px dashed color-mix(in srgb,currentColor 35%,transparent);border-radius:8px;}',
].join('');

/**
 * Interaction éditeur (parité « builder canvas ») MUTUALISÉE (éditeur principal + mini-éditeur de composite) :
 * rend le contenu live des widgets INERTE en mode édition (→ sélection/déplacement GrapesJS fiables, le
 * pointeur ne se fait plus capter par les inputs/selects), et le rétablit en mode APERÇU (`preview`) pour
 * tester. Affiche aussi les conteneurs de mise en page vides comme zones de dépôt.
 */
export function setupEditorInteraction(editor: Editor): void {
  const inject = (): void => {
    const doc = editor.Canvas.getDocument();
    if (!doc) return;
    let style = doc.getElementById(EDITOR_INTERACTION_STYLE_ID) as HTMLStyleElement | null;
    if (!style) {
      style = doc.createElement('style');
      style.id = EDITOR_INTERACTION_STYLE_ID;
      (doc.head ?? doc.documentElement).appendChild(style);
    }
    style.textContent = EDITOR_INTERACTION_CSS;
    setCanvasInert(editor, true); // ÉDITION par défaut (contenu inerte → sélection/déplacement fiables)
  };
  editor.on('load', inject);
  editor.on('canvas:frame:load', inject);
}

/**
 * Bascule l'inertie du contenu live du canvas : `true` = ÉDITION (inerte, on arrange) ; `false` = INTERAGIR
 * (contenu vivant : ouvrir le filtre, voir le caché, tester). ≠ commande `preview` de GrapesJS (qui rend le
 * canvas en lecture seule et empêche aussi de cliquer). Driven par le toggle « Interagir » du mini-éditeur.
 */
export function setCanvasInert(editor: Editor, inert: boolean): void {
  const body = editor.Canvas.getBody();
  if (body) body.classList.toggle('cz-edit-inert', inert);
}
