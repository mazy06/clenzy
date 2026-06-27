import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, ButtonBase, Tooltip } from '@mui/material';
import {
  Rocket, PanelLeftClose, PanelLeftOpen,
  Undo2, Redo2, Eye, Maximize, Code, SquareDashed, FolderInput, Workflow, PaintBucket, Boxes, Trash2, Plus,
  Paintbrush, Layers, SlidersHorizontal, LayoutGrid, Pencil, Languages,
  type LucideIcon,
} from 'lucide-react';
import grapesjs, { type Editor, type ProjectData } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import type { StudioConfigState } from '../useStudioConfig';
import type { BookingEngineConfig, DesignTokens } from '../../../../services/api/bookingEngineApi';
import { mediaApi } from '../../../../services/api/mediaApi';
import { sitesApi } from '../../../../services/api/sitesApi';
import { API_CONFIG } from '../../../../config/api';
import { registerBookingComponents, blockLabelHtml, resolveBlockId } from './bookingComponents';
import { BOOKING_WIDGET_DEFS, BOOKING_WIDGET_ATTR } from './bookingWidgetDefs';
import { WIDGET_SKIN_CSS, WIDGET_SKIN_SENTINEL, buildWidgetSkinBlock } from '../../sdk/styles/widgetSkin';
import { ensureStructuralStyles } from '../../sdk/headless';
import ImportPanel from './ImportPanel';
import FunnelPicker from './FunnelPicker';
import CompositeBuilder, { type CompositeDraft } from './CompositeBuilder';
import { buildFunnelHtml, parseSavedPresets, serializeSavedPresets } from './funnelPresets';
import {
  BUILTIN_COMPOSITES, buildCompositeHtml, compositeSummary,
  parseSavedComposites, serializeSavedComposites, type CompositeWidget,
} from './compositeWidgets';
import { validateComposition } from './funnelRules';
import { GALLERY_TEMPLATES, type GalleryTemplate } from './import/galleryTemplates';
import { sanitizeHtml, sanitizeCss } from './import/sanitizeHtml';
import PagesBar from '../builder/PagesBar';
import TranslateModal from '../TranslateModal';
import { useSitePages } from '../useSitePages';
import { useNotification } from '../../../../hooks/useNotification';
import type { Breakpoint } from '../StudioShell';
import { GUIDED_VIEWS, type StudioMode } from '../studioMode';
import './grapesStudio.css';

/**
 * Éditeur de pages du Studio basé sur GrapesJS (socle G0 + G1, multi-page B4).
 *
 * Multi-page (B4) : l'éditeur édite la SitePage ACTIVE (cf. `useSitePages`). Le contenu d'une page est
 * persisté dans `SitePage.blocks` (TEXT, servi tel quel par le backend) sous forme d'ENVELOPPE grapes :
 *   { format:'grapesjs', html: editor.getHtml(), css: editor.getCss(), projectData: editor.getProjectData() }
 * - `html`+`css` : rendus déjà extraits, consommés par le SSR (clenzy-sites) sans réexécuter GrapesJS ;
 * - `projectData` : source de vérité ré-éditable rechargée ici via `editor.loadProjectData` au changement
 *   de page (sans réinitialiser l'éditeur).
 *
 * Repli mono-page : si l'API sites est indisponible (`pages.ready === false`), on retombe sur l'ancien
 * comportement — projectData persisté dans `config.pageLayout` (TEXT) via `cfg.patch`. AUCUNE migration
 * de l'ancien format (greenfield assumé) dans les deux cas.
 *
 * G1 (préservé) :
 * - les widgets de réservation montent le VRAI SDK dans le canvas (cf. `registerBookingComponents`) ;
 * - le thème de l'org (primaryColor, polices, tokens) est RÉACTIF : un changement met à jour le CSS du
 *   canvas et re-rend les widgets live SANS réinitialiser l'éditeur ;
 * - couture import : bouton de panneau « Importer » qui ouvre le panneau multi-onglets `ImportPanel`.
 */

const PERSIST_DEBOUNCE_MS = 600;

/** Id de l'élément `<style>` injecté dans le <head> de l'iframe pour le thème (mis à jour à chaud). */
const THEME_STYLE_ID = 'clenzy-theme';

/** Mappe le breakpoint du page header → device GrapesJS (largeurs alignées sur FRAME_WIDTH). */
const GJS_DEVICE: Record<Breakpoint, string> = { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile' };

/** Marqueur de l'enveloppe grapes persistée (objet ≠ tableau → coexiste sans ambiguïté avec l'ancien format liste). */
const GRAPES_FORMAT = 'grapesjs';

/** Enveloppe grapes persistée dans `SitePage.blocks` (et lue par le SSR de clenzy-sites). */
interface GrapesEnvelope {
  format: typeof GRAPES_FORMAT;
  html: string;
  css: string;
  projectData: ProjectData;
}

/** Sérialise l'état courant de l'éditeur en enveloppe grapes (string), pour la persistance par page. */
function serializeEnvelope(editor: Editor): string {
  const envelope: GrapesEnvelope = {
    format: GRAPES_FORMAT,
    html: editor.getHtml(),
    css: editor.getCss() ?? '',
    projectData: editor.getProjectData(),
  };
  return JSON.stringify(envelope);
}

function parseTokens(json: string | null | undefined): DesignTokens | null {
  if (!json) return null;
  try {
    const obj = JSON.parse(json) as unknown;
    return obj && typeof obj === 'object' ? (obj as DesignTokens) : null;
  } catch {
    return null;
  }
}

/**
 * Lit le projectData GrapesJS d'une string `blocks`/`pageLayout`. GREENFIELD : ne renvoie un objet que
 * si c'est un projet GrapesJS plausible (présence de `pages`), sous deux formes acceptées :
 *   - enveloppe grapes B4 : `{ format:'grapesjs', projectData: { pages: [...] } }` → on extrait projectData ;
 *   - projectData brut (legacy mono-page `pageLayout`) : `{ pages: [...] }` → utilisé tel quel.
 * Toute autre forme (ancien tableau de BlockInstance, JSON quelconque, parse KO) → `undefined` (démarrage
 * vierge), jamais de tentative de migration.
 */
function parseInitialProject(blocks: string | null | undefined): ProjectData | undefined {
  if (!blocks) return undefined;
  try {
    const data = JSON.parse(blocks) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
    const obj = data as Record<string, unknown>;
    // Enveloppe grapes B4 : le projectData est imbriqué.
    if (obj.format === GRAPES_FORMAT && obj.projectData && typeof obj.projectData === 'object') {
      const pd = obj.projectData as Record<string, unknown>;
      return 'pages' in pd ? (pd as ProjectData) : undefined;
    }
    // projectData brut (legacy `config.pageLayout` mono-page).
    if ('pages' in obj) return obj as ProjectData;
  } catch {
    /* JSON illisible → vierge */
  }
  return undefined;
}

/**
 * Lit l'enveloppe grapes « HTML+CSS sans projectData » (= graine d'un template natif importé : cf.
 * `galleryTemplates`/`importPages`). `parseInitialProject` ne la voit pas (aucun `projectData.pages`) ;
 * c'est `loadPageInto` qui la charge alors via `setComponents`+`setStyle`. Renvoie `null` sinon.
 */
function parseHtmlCssEnvelope(blocks: string | null | undefined): { html: string; css: string } | null {
  if (!blocks) return null;
  try {
    const data = JSON.parse(blocks) as unknown;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const obj = data as Record<string, unknown>;
      if (obj.format === GRAPES_FORMAT && typeof obj.html === 'string') {
        return { html: obj.html, css: typeof obj.css === 'string' ? obj.css : '' };
      }
    }
  } catch {
    /* JSON illisible → null */
  }
  return null;
}

const BLANK_PROJECT = { pages: [{ component: '' }] } as unknown as ProjectData;

/**
 * Charge le contenu d'une page dans l'éditeur, depuis sa string `blocks`/`pageLayout` :
 *   1. enveloppe/projectData ré-éditable → `loadProjectData` (source de vérité, sans flash) ;
 *   2. sinon enveloppe HTML+CSS seule (template importé) → `setComponents` + `setStyle` (assainis) ;
 *      le 1er edit re-sérialisera la page AVEC projectData (auto-conversion, voir le listener `update`) ;
 *   3. sinon → canvas vierge.
 * L'appelant suspend la persistance (`hydratingRef`) autour de cet appel.
 */
function loadPageInto(editor: Editor, source: string | null | undefined): void {
  const project = parseInitialProject(source);
  if (project) {
    editor.loadProjectData(project);
    return;
  }
  const hc = parseHtmlCssEnvelope(source);
  if (hc) {
    editor.loadProjectData(BLANK_PROJECT);
    editor.setComponents(sanitizeHtml(hc.html));
    if (hc.css.trim()) editor.setStyle(sanitizeCss(hc.css));
    return;
  }
  editor.loadProjectData(BLANK_PROJECT);
}

/**
 * Langues supportées de bout en bout (contenu des pages + widget SDK + SSR). Le widget de réservation
 * n'est traduit que pour ces codes (cf. `sdk/i18n`) → on n'autorise à ajouter QUE celles-ci, pour que
 * contenu et widget restent cohérents dans chaque langue.
 */
const SUPPORTED_LOCALES = ['fr', 'en', 'ar'] as const;

/** Libellé court affiché dans la barre de langues. */
const LOCALE_LABEL: Record<string, string> = { fr: 'FR', en: 'EN', ar: 'AR' };

/**
 * Balises de texte rendues éditables (double-clic → RTE) dans le canvas. GrapesJS ne détecte « texte »
 * que les éléments dont TOUS les enfants sont du texte : un titre à contenu mixte (`<h1>… <em>…</em></h1>`)
 * échappe à l'heuristique et reste non éditable. On élargit donc la détection à ces balises.
 */
const EDITABLE_TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'blockquote', 'cite', 'figcaption', 'li', 'label', 'small',
]);

/**
 * Enregistre un type `cm-text` (extension du type `text` natif → éditable + RTE) qui revendique les
 * balises de `EDITABLE_TEXT_TAGS` quel que soit leur contenu inline → le texte importé devient éditable
 * au double-clic. DOIT être enregistré AVANT tout parse HTML (`setComponents`) pour s'appliquer. Les
 * marqueurs widget (`<div data-clenzy-widget>`) ne sont pas des balises de texte → aucun conflit.
 */
function registerTextEditing(editor: Editor): void {
  editor.DomComponents.addType('cm-text', {
    extend: 'text',
    isComponent: (el) => {
      const tag = (el as HTMLElement).tagName?.toLowerCase();
      return tag && EDITABLE_TEXT_TAGS.has(tag) ? { type: 'cm-text' } : undefined;
    },
    model: { defaults: { editable: true } },
  });
}

/**
 * Construit le CSS injecté dans le canvas (iframe) : mappe le thème de l'org vers des variables CSS
 * consommées par les composants de page. Permet à l'édition de refléter primaryColor / polices / tokens.
 */
function buildCanvasThemeCss(config: BookingEngineConfig | null): string {
  const tokens = parseTokens(config?.designTokens);
  const primary = tokens?.primaryColor || config?.primaryColor || '#6B8A9A';
  const bodyFont = tokens?.bodyFontFamily || config?.fontFamily || 'Inter, system-ui, sans-serif';
  const headingFont = tokens?.headingFontFamily || bodyFont;
  // Canvas ÉDITEUR neutre (blanc) : on n'impose PAS le backgroundColor du thème de l'org sur le canvas
  // vide — c'est le TEMPLATE chargé qui doit porter son propre fond (modèle template-driven). Le thème de
  // l'org reste utilisé pour le widget publié (SSR), pas pour teinter l'éditeur.
  const bg = '#ffffff';
  const surface = tokens?.surfaceColor || '#f7f7f8';
  const text = tokens?.textColor || '#1a1a1a';
  const textSecondary = tokens?.textSecondaryColor || '#6b7280';
  const border = tokens?.borderColor || '#e5e7eb';
  const radius = tokens?.borderRadius || '12px';
  // Variables exposées au canvas + valeurs par défaut sobres pour le corps de page édité.
  return `:root {
  --clenzy-primary: ${primary};
  --clenzy-bg: ${bg};
  --clenzy-surface: ${surface};
  --clenzy-text: ${text};
  --clenzy-text-secondary: ${textSecondary};
  --clenzy-border: ${border};
  --clenzy-radius: ${radius};
  --clenzy-font-body: ${bodyFont};
  --clenzy-font-heading: ${headingFont};
}
body {
  font-family: var(--clenzy-font-body);
  color: var(--clenzy-text);
  background: var(--clenzy-bg);
  margin: 0;
}
h1, h2, h3, h4 { font-family: var(--clenzy-font-heading); }
a { color: var(--clenzy-primary); }
[data-clenzy-widget] { display: block; }
/* Encart neutre (apiKey absent) — défini ICI car le CSS du canvas vit dans l'iframe, pas dans le
   document hôte (grapesStudio.css ne franchit pas l'iframe). Le widget live, lui, isole son rendu
   en Shadow DOM. */
.clenzy-booking-placeholder__inner {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; padding: 28px 20px; text-align: center;
  border: 1px dashed var(--clenzy-border); border-radius: var(--clenzy-radius);
  background: var(--clenzy-surface); color: var(--clenzy-text-secondary);
}
.clenzy-booking-placeholder__icon { color: var(--clenzy-primary); line-height: 0; }
.clenzy-booking-placeholder__title { font-weight: 600; font-size: 14px; color: var(--clenzy-text); }
.clenzy-booking-placeholder__hint { font-size: 12px; }`;
}

/** Résout l'URL d'un média Clenzy en absolu (l'API renvoie un chemin relatif keyless `/api/public/media/{id}`). */
function resolveMediaUrl(url: string): string {
  return url.startsWith('http') ? url : `${API_CONFIG.BASE_URL}${url}`;
}

/** Extrait les fichiers d'un évènement d'upload GrapesJS (drop sur la dropzone OU input file). */
function extractUploadFiles(e: DragEvent): File[] {
  const fromDrop = e.dataTransfer?.files;
  const fromInput = (e.target as HTMLInputElement | null)?.files;
  const list = fromDrop ?? fromInput ?? null;
  return list ? Array.from(list) : [];
}

/** Blocs de base (section, texte, image, colonnes) du BlockManager. */
function registerBaseBlocks(editor: Editor): void {
  const bm = editor.BlockManager;
  bm.add('section', {
    label: blockLabelHtml('Section', 'Bloc pleine largeur (conteneur de contenu).'),
    category: 'Mise en page',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/></svg>',
    attributes: { 'data-cz-block': 'section' },
    content: '<section style="padding:48px 24px"><h2>Titre de section</h2><p>Décrivez votre offre ici.</p></section>',
  });
  bm.add('text', {
    label: blockLabelHtml('Texte', 'Bloc de texte éditable.'),
    category: 'Basique',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    attributes: { 'data-cz-block': 'text' },
    content: { type: 'text', content: 'Insérez votre texte' },
  });
  bm.add('image', {
    label: blockLabelHtml('Image', 'Image (médiathèque ou upload).'),
    category: 'Basique',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    attributes: { 'data-cz-block': 'image' },
    content: { type: 'image' },
    activate: true,
  });
  bm.add('columns', {
    label: blockLabelHtml('Colonnes', 'Deux colonnes côte à côte.'),
    category: 'Mise en page',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/></svg>',
    attributes: { 'data-cz-block': 'columns' },
    content: `<div style="display:flex;gap:24px;padding:24px">
  <div style="flex:1">Colonne 1</div>
  <div style="flex:1">Colonne 2</div>
</div>`,
  });
}

const COMPOSITE_BLOCK_PREFIX = 'composite-';
const COMPOSITE_BLOCK_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 4 6v6l8 4 8-4V6l-8-4Z"/><path d="m4 6 8 4 8-4M12 10v6"/></svg>';

/**
 * (Re)enregistre les composites de l'org comme BLOCS GrapesJS (catégorie « Composites ») → ils s'affichent
 * comme les widgets (icône + libellé + description) et sont DRAGGABLES sur le canvas comme eux. Le `content`
 * = le markup du composite ; au drop, les marqueurs `data-clenzy-widget` se re-typent en widgets live
 * (cf. `registerBookingComponents`). Appelé à l'init et à chaque changement de la bibliothèque de composites.
 */
function registerCompositeBlocks(editor: Editor, composites: CompositeWidget[]): void {
  const bm = editor.BlockManager;
  bm.getAll()
    .filter((b: { getId: () => string }) => String(b.getId()).startsWith(COMPOSITE_BLOCK_PREFIX))
    .map((b: { getId: () => string }) => String(b.getId()))
    .forEach((id: string) => bm.remove(id));
  for (const c of composites) {
    bm.add(COMPOSITE_BLOCK_PREFIX + c.id, {
      label: blockLabelHtml(c.name, compositeSummary(c)),
      // Catégorie EN TÊTE (order négatif) + ouverte → visible sans scroller (sinon reléguée tout en bas).
      category: { id: 'composites', label: 'Composites', open: true, order: -1 },
      media: COMPOSITE_BLOCK_ICON,
      attributes: { 'data-cz-block': 'composite' },
      content: buildCompositeHtml(c),
    });
  }
  // Rafraîchit le panneau Blocs (réécrit en place dans le conteneur `appendTo`) → les blocs composites
  // ajoutés après l'init apparaissent immédiatement.
  bm.render();
}

/**
 * Style du funnel PENSÉ pour s'adapter au template (anticipation) — posé dans la feuille de style de la
 * page (persistée + servie au SSR), jamais en inline :
 *  - unités RELATIVES (`rem`) → suit l'échelle typographique du template ;
 *  - largeur `min(960px, 100%)` → jamais de débordement, s'ajuste au conteneur ;
 *  - `margin-inline:auto` → centré dans la colonne du template ;
 *  - variables `--clenzy-funnel-*` (contrat stable) → un template/une org peut ajuster gap/largeur/espacement
 *    sans toucher au markup ;
 *  - classe (≠ inline) → le CSS du template surcharge `.clenzy-funnel` par cascade s'il le souhaite.
 * (Les widgets eux-mêmes s'adaptent via les DESIGN TOKENS de l'org — « Analyse du design » — car ils sont
 *  isolés en Shadow DOM côté SDK ; seul le conteneur vit dans le CSS du template.)
 */
function ensureFunnelStyle(editor: Editor): void {
  editor.Css.setRule('.clenzy-funnel', {
    display: 'flex',
    'flex-direction': 'column',
    gap: 'var(--clenzy-funnel-gap, 1.5rem)',
    'max-width': 'var(--clenzy-funnel-width, min(960px, 100%))',
    'margin-inline': 'auto',
    'padding-block': 'var(--clenzy-funnel-pad, 2rem)',
  });
}

/**
 * Insère un PARCOURS (liste ordonnée d'ids widgets) dans la page + son style adaptatif. Insertion
 * MULTIPLE possible (≠ ancien toggle) : on peut ajouter plusieurs parcours. Suppression = via le canvas
 * / les Calques (composant GrapesJS standard).
 */
function insertFunnel(editor: Editor, widgetIds: string[]): void {
  if (widgetIds.length === 0) return;
  ensureFunnelStyle(editor);
  editor.addComponents(buildFunnelHtml(widgetIds));
}

/**
 * Style du composite « Barre de recherche » (rangée headless, adaptatif comme `.clenzy-funnel`) : les
 * champs grandissent, le bouton garde sa taille, retour à la ligne en responsive. Variables
 * `--clenzy-search-*` (contrat stable) → le template peut ajuster gap/largeur sans toucher au markup.
 */
function ensureSearchBarStyle(editor: Editor): void {
  editor.Css.setRule('.clenzy-search-bar', {
    display: 'flex',
    'flex-wrap': 'wrap',
    'align-items': 'flex-end',
    gap: 'var(--clenzy-search-gap, 0.75rem)',
    'max-width': 'var(--clenzy-search-width, min(1100px, 100%))',
    'margin-inline': 'auto',
    'padding-block': 'var(--clenzy-search-pad, 1rem)',
  });
  editor.Css.setRule('.clenzy-search-bar > [data-clenzy-widget]', { flex: '1 1 160px', 'min-width': '0' });
  editor.Css.setRule('.clenzy-search-bar > [data-clenzy-widget="booking-search-button"]', { flex: '0 0 auto' });
}

/** Style d'un composite « Ligne » générique (rangée headless adaptative). */
function ensureRowStyle(editor: Editor): void {
  editor.Css.setRule('.clenzy-row', {
    display: 'flex',
    'flex-wrap': 'wrap',
    'align-items': 'flex-end',
    gap: 'var(--clenzy-row-gap, 0.75rem)',
    'max-width': 'var(--clenzy-row-width, min(1100px, 100%))',
    'margin-inline': 'auto',
    'padding-block': 'var(--clenzy-row-pad, 1rem)',
  });
  editor.Css.setRule('.clenzy-row > [data-clenzy-widget]', { flex: '1 1 160px', 'min-width': '0' });
}

/** Insère un widget COMPOSITE (selon son type) + le style adaptatif correspondant. */
function insertComposite(editor: Editor, c: CompositeWidget): void {
  const html = buildCompositeHtml(c);
  if (!html.trim()) return;
  // Legacy : style adaptatif du conteneur selon le type. Freeform (markup libre) : styles inline → rien à ajouter.
  if (c.kind === 'searchBar') ensureSearchBarStyle(editor);
  else if (c.kind === 'row') ensureRowStyle(editor);
  else if (c.kind === 'column') ensureFunnelStyle(editor);
  editor.addComponents(html);
}

/**
 * Injecte / met à jour le CSS de thème DANS le <head> de l'iframe du canvas, via un `<style>` dédié
 * (id stable). Permet d'actualiser le thème À CHAUD, sans réinitialiser l'éditeur (≠ `canvasCss`,
 * appliqué seulement à l'init). No-op si le document du canvas n'est pas encore prêt.
 */
function applyCanvasThemeCss(editor: Editor, config: BookingEngineConfig | null): void {
  const doc = editor.Canvas.getDocument();
  if (!doc) return;
  let style = doc.getElementById(THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = THEME_STYLE_ID;
    doc.head.appendChild(style);
  }
  style.textContent = buildCanvasThemeCss(config);
}

const VALIDATION_STYLE_ID = 'clenzy-validation-style';

/**
 * Injecte (une fois) le style ÉDITEUR de la validation de composition dans l'iframe du canvas : un
 * contour + un badge sur les widgets marqués `.cz-widget-invalid` (prérequis manquant). Purement chrome
 * éditeur (pas dans le CSS projet) → jamais exporté/publié.
 */
function ensureValidationStyle(doc: Document | null): void {
  if (!doc || doc.getElementById(VALIDATION_STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = VALIDATION_STYLE_ID;
  style.textContent =
    '.cz-widget-invalid{position:relative;outline:2px dashed #c8842f!important;outline-offset:3px;}'
    + '.cz-widget-invalid::after{content:attr(data-cz-warn);position:absolute;z-index:20;top:0;left:0;'
    + 'transform:translateY(-100%);max-width:280px;white-space:normal;background:#c8842f;color:#fff;'
    + "font:500 11px/1.35 system-ui,-apple-system,sans-serif;padding:3px 7px;border-radius:5px;"
    + 'box-shadow:0 4px 12px rgba(0,0,0,.18);pointer-events:none;}'
    // Placeholder ÉDITEUR : un widget booking qui rend VIDE (ex. Récap sans dates, Logements sans
    // résultats) reste visible sous forme d'encart étiqueté (chrome éditeur, jamais publié).
    + '.cz-widget-empty{min-height:56px;display:flex!important;align-items:center;justify-content:center;'
    + 'outline:1px dashed rgba(0,0,0,.28);outline-offset:2px;border-radius:6px;background:rgba(0,0,0,.035);}'
    + ".cz-widget-empty::after{content:attr(data-cz-name);color:rgba(0,0,0,.55);"
    + 'font:500 12px/1.3 system-ui,-apple-system,sans-serif;padding:10px 12px;text-align:center;}';
  doc.head.appendChild(style);
}

const WIDGET_SKIN_STYLE_ID = 'clenzy-widget-skin';

/**
 * Applique le skin cosmétique des widgets DANS l'iframe du canvas (affichage éditeur). Injection raw
 * (parsée par le navigateur, ≠ `editor.Css` dont le parser bute sur `::after`/`var()`/`:not()`) →
 * rendu fiable et immédiat. Les variables de marque (accent/police) priment sur les fallbacks du skin.
 */
function applyWidgetSkinToCanvas(editor: Editor, primaryColor?: string | null, fontFamily?: string | null): void {
  const doc = editor.Canvas.getDocument();
  if (!doc) return;
  let style = doc.getElementById(WIDGET_SKIN_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = doc.createElement('style');
    style.id = WIDGET_SKIN_STYLE_ID;
    doc.head.appendChild(style);
  }
  const vars: string[] = [];
  if (primaryColor) vars.push(`--cb-accent:${primaryColor};`);
  if (fontFamily) vars.push(`--cb-font:${fontFamily};`);
  style.textContent = (vars.length ? `.cb-widget{${vars.join('')}}\n` : '') + WIDGET_SKIN_CSS;
}

/**
 * Re-rend les vues des widgets de réservation (sans réinitialiser l'éditeur). Utilisé au changement
 * de thème pour que le SDK live se remonte avec le nouveau thème (le `onRender` de la vue lit la
 * config courante via `ctx.getConfig`). `getView().render()` rejoue le pipeline de rendu (→ onRender).
 */
function rerenderBookingWidgets(editor: Editor): void {
  const wrapper = editor.getWrapper();
  if (!wrapper) return;
  for (const def of BOOKING_WIDGET_DEFS) {
    for (const cmp of wrapper.findType(def.id)) {
      cmp.getView()?.render();
    }
  }
}

/** Vues du panneau latéral (managers GrapesJS montés dans nos conteneurs). */
type EditorView = 'blocks' | 'composites' | 'styles' | 'layers' | 'traits';

/** Onglets du sélecteur de vue (panneau droit). */
const VIEW_TABS: { key: EditorView; icon: LucideIcon; label: string }[] = [
  { key: 'blocks', icon: LayoutGrid, label: 'Blocs' },
  { key: 'composites', icon: Boxes, label: 'Composites' },
  { key: 'styles', icon: Paintbrush, label: 'Style' },
  { key: 'layers', icon: Layers, label: 'Calques' },
  { key: 'traits', icon: SlidersHorizontal, label: 'Réglages' },
];

/**
 * Bouton unifié de la barre d'outils (un seul style pour TOUTE la barre : icône lucide 16px + tooltip,
 * état actif en accent). Remplace le mélange de boutons GrapesJS natifs / pills hétérogènes.
 */
function ToolBtn({ icon: Icon, title, onClick, active = false, disabled = false, label }: {
  icon: LucideIcon; title: string; onClick: () => void; active?: boolean; disabled?: boolean; label?: string;
}) {
  return (
    <Tooltip title={title}>
      <Box component="span" sx={{ display: 'inline-flex' }}>
        <ButtonBase
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          aria-pressed={active}
          sx={{
            height: 30, minWidth: 30, px: label ? 1.25 : 0,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.75,
            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
            fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)',
            color: active ? 'var(--accent)' : 'var(--muted)',
            bgcolor: active ? 'var(--accent-soft)' : 'transparent',
            transition: 'color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
            '&:hover': { color: active ? 'var(--accent)' : 'var(--ink)', bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)' },
            '&.Mui-disabled': { opacity: 0.4, cursor: 'default' },
            '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
          }}
        >
          <Icon size={16} strokeWidth={2} />
          {label && <Box component="span">{label}</Box>}
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}

/** Panneau « Composites » du panneau droit (P1) : liste des composites + bouton « Nouveau composite ». */
function CompositesPanel({ composites, onInsert, onEdit, onDelete, onNew }: {
  composites: CompositeWidget[];
  onInsert: (c: CompositeWidget) => void;
  onEdit: (c: CompositeWidget) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <Box sx={{ p: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Box sx={{ fontSize: 'var(--text-xs)', color: 'var(--muted)', lineHeight: 1.4, px: 0.5 }}>
        Clique pour insérer, ou glisse-dépose le composite depuis l'onglet « Blocs » (catégorie Composites).
      </Box>
      <ButtonBase
        onClick={onNew}
        sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 0.75, height: 34, borderRadius: 'var(--radius-md)', border: '1px dashed var(--line)', color: 'var(--accent)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', '&:hover': { borderColor: 'var(--accent)', bgcolor: 'var(--accent-soft)' } }}
      >
        <Plus size={15} strokeWidth={2} /> Nouveau composite
      </ButtonBase>
      {composites.map((c) => (
        <Box key={c.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.9, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', transition: 'border-color var(--duration-fast) var(--ease-out)', '&:hover': { borderColor: 'var(--accent)' } }}>
          <Box sx={{ flexShrink: 0, display: 'inline-flex', color: 'var(--muted)' }}><Boxes size={20} strokeWidth={1.8} /></Box>
        <ButtonBase onClick={() => onInsert(c)} sx={{ flex: 1, minWidth: 0, display: 'block', textAlign: 'left', cursor: 'pointer' }}>
            <Box component="span" sx={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>{c.name}</Box>
            <Box component="span" sx={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>{compositeSummary(c)}</Box>
          </ButtonBase>
          {!c.builtin && (
            <Tooltip title="Modifier">
              <ButtonBase onClick={() => onEdit(c)} aria-label="Modifier" sx={{ flexShrink: 0, width: 26, height: 24, borderRadius: 'var(--radius-sm)', color: 'var(--muted)', cursor: 'pointer', '&:hover': { color: 'var(--accent)', bgcolor: 'var(--accent-soft)' } }}>
                <Pencil size={14} strokeWidth={2} />
              </ButtonBase>
            </Tooltip>
          )}
          {!c.builtin && (
            <Tooltip title="Supprimer">
              <ButtonBase onClick={() => onDelete(c.id)} aria-label="Supprimer" sx={{ flexShrink: 0, width: 26, height: 24, borderRadius: 'var(--radius-sm)', color: 'var(--muted)', cursor: 'pointer', '&:hover': { color: 'var(--danger, #d4453f)', bgcolor: 'var(--danger-soft, rgba(212,69,63,.12))' } }}>
                <Trash2 size={14} strokeWidth={2} />
              </ButtonBase>
            </Tooltip>
          )}
        </Box>
      ))}
    </Box>
  );
}

export interface GrapesStudioProps {
  cfg: StudioConfigState;
  /** Breakpoint d'aperçu, piloté par le toggle du page header (le sélecteur device natif GrapesJS est masqué). */
  breakpoint: Breakpoint;
  /** Mode d'édition. `guided` bride l'UI (onglets Blocs+Style, blocs curés, pas d'import) ; `advanced` = complet. */
  mode: StudioMode;
}

export default function GrapesStudio({ cfg, breakpoint, mode }: GrapesStudioProps) {
  const { t } = useTranslation();
  const { notify } = useNotification();
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  // Miroir d'état de l'éditeur : permet à la modale d'import (React) de se (re)rendre une fois l'éditeur
  // monté, sans relire la ref (les refs ne déclenchent pas de rendu).
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  // Template choisi depuis la galerie StudioHome (« Utiliser ce template ») : transmis via le state de
  // navigation, consommé une fois l'éditeur + les pages prêts (cf. effet d'auto-import plus bas).
  const location = useLocation();
  const navigate = useNavigate();
  const autoImportedRef = useRef(false);
  // Ouverture de la modale d'import (pilotée par le bouton de panneau via la commande GrapesJS).
  const [importOpen, setImportOpen] = useState(false);
  const [funnelPickerOpen, setFunnelPickerOpen] = useState(false);
  const [compositeCreatorOpen, setCompositeCreatorOpen] = useState(false);
  // Composite en cours d'édition (null = création d'un nouveau composite).
  const [editingComposite, setEditingComposite] = useState<CompositeWidget | null>(null);
  const [publishing, setPublishing] = useState(false);
  // Réduction du panneau latéral (bouton « réduire la colonne »).
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  // Option A — UI 100 % custom : les managers GrapesJS sont montés dans NOS conteneurs (panneau droit),
  // via `appendTo` à l'init. Plus aucun panneau GrapesJS par défaut (`panels: { defaults: [] }`).
  const blocksRef = useRef<HTMLDivElement>(null);
  const stylesRef = useRef<HTMLDivElement>(null);
  const layersRef = useRef<HTMLDivElement>(null);
  const traitsRef = useRef<HTMLDivElement>(null);
  // Bloc actuellement surligné dans la palette (suit la sélection du canvas) — sert au re-scroll quand on
  // revient sur l'onglet « Blocs » (la palette est `display:none` sur les autres vues → scroll impossible).
  const selectedBlockIdRef = useRef<string | null>(null);
  // Skin widgets activé (session) → réinjecté dans l'iframe à chaque (re)chargement de page.
  const widgetSkinOnRef = useRef(false);
  const [activeView, setActiveView] = useState<EditorView>('blocks');
  // Mode GUIDÉ : onglets restreints (Blocs + Style). Les blocs sont curés via CSS (`data-guided`),
  // l'import est masqué (cf. barre d'outils). Le mode Avancé garde TOUS les onglets/blocs/l'import.
  const guided = mode === 'guided';
  const visibleTabs = guided ? VIEW_TABS.filter((t) => GUIDED_VIEWS.has(t.key)) : VIEW_TABS;
  // Si l'onglet actif n'est plus visible (passage en Guidé alors qu'on était sur Calques/Réglages/Composites),
  // on retombe sur « Blocs ». Effet (≠ rendu) → ne perturbe pas le rendu en cours.
  useEffect(() => {
    if (guided && !GUIDED_VIEWS.has(activeView)) setActiveView('blocks');
  }, [guided, activeView]);
  // États des actions toggle de la barre d'outils.
  const [previewOn, setPreviewOn] = useState(false);
  const [fullscreenOn, setFullscreenOn] = useState(false);
  const [outlineOn, setOutlineOn] = useState(false);
  // `patch` change d'identité à chaque rendu de config ; on le lit via ref pour ne pas réinitialiser
  // l'éditeur (l'effet d'init ne dépend QUE de l'id de la config).
  const patchRef = useRef(cfg.patch);
  patchRef.current = cfg.patch;

  // Accesseur de config COURANTE pour les coutures (montage SDK live, import) : la ref suit chaque
  // rendu, mais l'éditeur n'est PAS réinitialisé (les vues lisent `getConfig()` au (re)mount).
  const configRef = useRef(cfg.config);
  configRef.current = cfg.config;

  // ─── Multi-page + multi-langue ────────────────────────────────────────────────
  // L'état des pages est résolu via `useSitePages` (find-or-create du site + chargement des pages). En
  // mode page, l'éditeur édite la SitePage active ; sinon (API sites indisponible) repli mono-page.
  // `editLocale` = langue d'ÉDITION (undefined = langue par défaut du site). `useSitePages` filtre les
  // pages par langue et estampille le CRUD ; un changement de langue re-sélectionne l'accueil de la langue.
  const [editLocale, setEditLocale] = useState<string | undefined>(undefined);
  const pages = useSitePages(cfg.config?.id ?? undefined, editLocale);
  const pageMode = pages.ready && pages.selectedPage != null;

  // Persistance par page : référencée par le listener `update` (qui ne change pas d'identité avec le
  // débounce). On lit `pageMode`/page active/savePageBlocks via une ref unique pour router l'écriture
  // sans réinitialiser l'éditeur ni recréer le listener à chaque rendu.
  const persistTargetRef = useRef<{ pageMode: boolean; pageId: number | null; savePageBlocks: (id: number, blocks: string) => Promise<void> }>({
    pageMode: false,
    pageId: null,
    savePageBlocks: pages.savePageBlocks,
  });
  persistTargetRef.current = {
    pageMode,
    pageId: pages.selectedPageId,
    savePageBlocks: pages.savePageBlocks,
  };

  // Garde-fou d'hydratation : `loadProjectData` déclenche des événements `update` ; sans ce drapeau, le
  // listener de persistance ré-écrirait immédiatement la page tout juste chargée (et écraserait les
  // autres pages avec le contenu courant pendant le switch). On suspend la persistance le temps du load.
  const hydratingRef = useRef(false);

  // Id de la page (ou 'legacy') déjà hydratée dans l'éditeur. Évite de ré-hydrater à chaque frappe (la
  // sauvegarde change l'identité de la page mais pas son id) et juste après l'init (déjà chargé via
  // `projectData`). Déclaré avant l'effet d'init qui le renseigne avec la page initiale.
  const lastHydratedRef = useRef<number | 'legacy' | null>(null);

  // L'éditeur est monté UNE fois par config (clé = id). Le layout initial est capturé à l'init ; le
  // thème est propagé à chaud par l'effet réactif plus bas (sans réinitialiser l'éditeur).
  const configId = cfg.config?.id;

  // Contenu initial chargé à l'init : page active si dispo, sinon repli `config.pageLayout` mono-page.
  // Lu via ref pour ne pas faire dépendre l'effet d'init de la résolution (asynchrone) des pages.
  const initialBlocksRef = useRef<string | null | undefined>(undefined);
  initialBlocksRef.current = pageMode && pages.selectedPage ? pages.selectedPage.blocks : cfg.config?.pageLayout;

  useEffect(() => {
    const container = containerRef.current;
    // Conteneurs des managers (panneau droit) requis à l'init pour `appendTo` (option A — UI custom).
    const blocksEl = blocksRef.current;
    const stylesEl = stylesRef.current;
    const layersEl = layersRef.current;
    const traitsEl = traitsRef.current;
    if (!container || !blocksEl || !stylesEl || !layersEl || !traitsEl || cfg.loading || !cfg.config) return;

    // R5 — médiathèque : l'Asset Manager GrapesJS uploade vers la médiathèque Clenzy (org-scopée) et
    // sert l'URL publique keyless. `editorRef.current` est résolu à l'upload (éditeur déjà monté).
    const handleAssetUpload = async (e: DragEvent): Promise<void> => {
      const ed = editorRef.current;
      if (!ed) return;
      for (const file of extractUploadFiles(e)) {
        try {
          const asset = await mediaApi.upload(file);
          ed.AssetManager.add(resolveMediaUrl(asset.url));
        } catch {
          /* upload média échoué : non bloquant, l'utilisateur réessaie */
        }
      }
    };

    const editor = grapesjs.init({
      container,
      height: '100%',
      // Option A — AUCUN panneau GrapesJS par défaut : la barre d'outils + le panneau droit sont 100 %
      // React (cf. rendu). Les managers ci-dessous sont montés dans NOS conteneurs via `appendTo`.
      panels: { defaults: [] },
      blockManager: { appendTo: blocksEl },
      layerManager: { appendTo: layersEl },
      selectorManager: { appendTo: stylesEl },
      styleManager: { appendTo: stylesEl },
      traitManager: { appendTo: traitsEl },
      // Devices alignés sur les breakpoints du page header (largeurs = FRAME_WIDTH).
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Desktop', width: '' },
          { id: 'tablet', name: 'Tablet', width: '834px' },
          { id: 'mobile', name: 'Mobile', width: '390px' },
        ],
      },
      // L'app gère la persistance (cf. listener `update` ci-dessous) → pas de storage interne.
      storageManager: false,
      // R5 — Asset Manager branché sur la médiathèque Clenzy (upload custom → URL publique keyless).
      assetManager: { uploadFile: handleAssetUpload },
      // Thème initial de l'iframe du canvas. Les changements ultérieurs passent par l'effet réactif
      // (`applyCanvasThemeCss`), qui met à jour un `<style>` dédié sans réinitialiser l'éditeur.
      canvasCss: buildCanvasThemeCss(cfg.config),
      // PAS de `projectData` ici : le contenu est chargé APRÈS l'enregistrement des types (texte +
      // widgets), pour que la détection s'applique au parse HTML (texte importé → éditable, marqueurs
      // booking → composants), au lieu d'être parsé en composants neutres non éditables.
    });
    editorRef.current = editor;
    setEditorInstance(editor);
    // R5 — pré-charge la médiathèque existante de l'org dans l'Asset Manager (non bloquant).
    mediaApi.list()
      .then((assets) => { editor.AssetManager.add(assets.map((a) => resolveMediaUrl(a.url))); })
      .catch(() => { /* médiathèque indisponible : aucun asset pré-chargé */ });

    // Contexte des coutures : accesseur de config courante (lu au (re)mount des vues live SDK).
    const ctx = { getConfig: () => configRef.current };

    registerBaseBlocks(editor);
    registerBookingComponents(editor, ctx);
    registerTextEditing(editor);

    // Contenu initial chargé APRÈS les types → le parse HTML applique la détection texte/widget (texte
    // éditable au double-clic, marqueurs hydratés en aperçu). Persistance suspendue le temps du chargement.
    lastHydratedRef.current = persistTargetRef.current.pageMode ? persistTargetRef.current.pageId : 'legacy';
    hydratingRef.current = true;
    try {
      loadPageInto(editor, initialBlocksRef.current);
    } finally {
      setTimeout(() => { hydratingRef.current = false; }, 0);
    }

    // Persistance débouncée : `update` se déclenche à toute mutation du projet. On sérialise l'enveloppe
    // grapes (html + css + projectData) ; l'écriture est routée vers la page active (multi-page) ou
    // `config.pageLayout` (repli mono-page). Suspendue pendant l'hydratation (cf. `hydratingRef`).
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onUpdate = () => {
      if (hydratingRef.current) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          const target = persistTargetRef.current;
          const envelope = serializeEnvelope(editor);
          if (target.pageMode && target.pageId != null) {
            void target.savePageBlocks(target.pageId, envelope).catch(() => { /* erreur exposée par le hook */ });
          } else {
            // Repli mono-page : on conserve l'enveloppe grapes dans `config.pageLayout` (cohérent avec
            // le parse qui accepte aussi projectData brut). L'enregistrement réseau reste piloté par le hook.
            patchRef.current({ pageLayout: envelope });
          }
        } catch {
          /* sérialisation impossible : on n'écrase pas le brouillon courant */
        }
      }, PERSIST_DEBOUNCE_MS);
    };
    editor.on('update', onUpdate);

    // Synchro sélection canvas → palette de blocs (droite) : surligne + scrolle le bloc correspondant au
    // composant sélectionné. Mapping : marqueur `data-clenzy-widget` (booking) ou type de composant (natifs)
    // → id de bloc, ciblé via l'attribut DOM `data-cz-block` posé à l'enregistrement des blocs.
    const clearBlockHighlight = () => {
      blocksRef.current?.querySelectorAll('.cz-block-active').forEach((el) => el.classList.remove('cz-block-active'));
    };
    const highlightBlockForSelection = (component?: { getAttributes?: () => Record<string, unknown>; get?: (k: string) => unknown }) => {
      const root = blocksRef.current;
      if (!root) return;
      clearBlockHighlight();
      const attrs = component?.getAttributes?.() ?? {};
      const marker = typeof attrs[BOOKING_WIDGET_ATTR] === 'string' ? (attrs[BOOKING_WIDGET_ATTR] as string) : undefined;
      const rawType = component?.get?.('type');
      const type = typeof rawType === 'string' ? rawType : undefined;
      // Résout l'id de bloc quel que soit le vocabulaire (booking-* déposé, step runtime de template, natif).
      const id = resolveBlockId(marker, type);
      if (!id || !/^[\w-]+$/.test(id)) { selectedBlockIdRef.current = null; return; }
      const el = root.querySelector(`[data-cz-block="${id}"]`);
      if (el) {
        el.classList.add('cz-block-active');
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        selectedBlockIdRef.current = id;
      } else {
        selectedBlockIdRef.current = null;
      }
    };
    const onDeselected = () => { clearBlockHighlight(); selectedBlockIdRef.current = null; };
    editor.on('component:selected', highlightBlockForSelection);
    editor.on('component:deselected', onDeselected);

    // ── Validation de composition au niveau CANVAS : marque (contour + badge) les widgets booking posés
    // sur la page sans leur prérequis. Marquage DOM-only (jamais persisté/exporté), réappliqué à chaque
    // changement. La page entière = un ensemble (présence), comme le composeur.
    let validationTimer: ReturnType<typeof setTimeout> | null = null;
    // Re-valide quand le CONTENU du canvas change (un widget se remplit via l'état SDK, sans événement
    // GrapesJS → sinon le placeholder « vide » resterait superposé au contenu rempli).
    let canvasObserver: MutationObserver | null = null;
    const runCanvasValidation = () => {
      // Feuille STRUCTURELLE des widgets headless RE-garantie dans l'iframe à chaque mutation du canvas
      // (add/render/observer) : c'est ce qui pose le layout `.sb` + le repli des panneaux. (`ensureStructuralStyles`
      // est idempotent + resynchronise le contenu → fiable même si le contenu de page a rechargé l'iframe.)
      ensureStructuralStyles(editor.Canvas.getDocument());
      ensureValidationStyle(editor.Canvas.getDocument());
      const wrapper = editor.getWrapper();
      const comps = wrapper ? wrapper.find(`[${BOOKING_WIDGET_ATTR}]`) : [];
      const items = comps
        .map((c) => {
          const marker = c.getAttributes?.()[BOOKING_WIDGET_ATTR];
          const type = c.get?.('type');
          return { c, id: resolveBlockId(typeof marker === 'string' ? marker : undefined, typeof type === 'string' ? type : undefined) };
        })
        .filter((x): x is { c: (typeof comps)[number]; id: string } => typeof x.id === 'string');
      const byId = new Map<string, string[]>();
      for (const w of validateComposition(items.map((x) => x.id))) {
        if (w.severity !== 'warning') continue; // canvas = prérequis durs seulement (infos restent au composeur)
        const arr = byId.get(w.widgetId) ?? [];
        arr.push(w.message);
        byId.set(w.widgetId, arr);
      }
      for (const { c, id } of items) {
        const el = c.getEl?.();
        if (!el) continue;
        const msgs = byId.get(id);
        if (msgs && msgs.length) { el.classList.add('cz-widget-invalid'); el.setAttribute('data-cz-warn', msgs.join(' · ')); }
        else { el.classList.remove('cz-widget-invalid'); el.removeAttribute('data-cz-warn'); }
        // Placeholder d'aperçu : un widget qui rend VIDE (rien de VISIBLE) reste visible/étiqueté.
        // `innerText` (≠ textContent) ignore les éléments cachés (`[hidden]`) → la page formulaire masquée
        // que `BaitlyWidget` rend en mode composé ne fausse plus la détection. Stable (≠ hauteur, pas de boucle).
        // Un widget dont le contenu est un CHAMP (input/select) ou une ICÔNE (svg/img) n'a pas d'`innerText`
        // mais N'EST PAS vide (ex. « Recherche ville » = input, « Filtre » = icône) → ne pas le marquer.
        const isEmpty = !el.innerText?.trim() && !el.querySelector('input, select, textarea, button, svg, img');
        if (isEmpty) {
          const label = BOOKING_WIDGET_DEFS.find((d) => d.id === id)?.label ?? id;
          el.classList.add('cz-widget-empty');
          el.setAttribute('data-cz-name', `${label} — aperçu selon le contexte`);
        } else {
          el.classList.remove('cz-widget-empty');
          el.removeAttribute('data-cz-name');
        }
      }
    };
    const scheduleValidation = () => { if (validationTimer) clearTimeout(validationTimer); validationTimer = setTimeout(runCanvasValidation, 250); };
    const onCanvasLoad = () => {
      // Feuille STRUCTURELLE des widgets headless injectée EXPLICITEMENT dans l'iframe du canvas (doc sûr via
      // Canvas.getDocument) → le layout `.sb` des composites + le repli des panneaux s'appliquent dans
      // l'éditeur comme dans l'aperçu (sinon, au drop, mountPrimitive peut viser le mauvais document).
      ensureStructuralStyles(editor.Canvas.getDocument());
      runCanvasValidation();
      // Réinjecte le skin dans la nouvelle iframe s'il est activé CETTE SESSION **ou** déjà PERSISTÉ (sentinel
      // `.cb-skin-v1` présent dans le CSS projet). Sans la détection du sentinel, un RELOAD remet
      // `widgetSkinOnRef` à false → le <style> canvas FIABLE (transitoire) n'est pas réinjecté, et seul le CSS
      // persisté INCOMPLET subsiste (le parser GrapesJS ignore certaines règles `::after`/`var()`) →
      // l'habillage « template » disparaît. La détection le restaure automatiquement au chargement.
      if (!widgetSkinOnRef.current && editor.Css.getRule(WIDGET_SKIN_SENTINEL)) widgetSkinOnRef.current = true;
      if (widgetSkinOnRef.current) applyWidgetSkinToCanvas(editor, cfg.config?.primaryColor, cfg.config?.fontFamily);
      // (Re)branche l'observer sur le nouveau document d'iframe. `childList`+`subtree` SEULEMENT : nos
      // marquages (classes/attributs) ne déclenchent pas l'observer → aucune boucle.
      canvasObserver?.disconnect();
      const cdoc = editor.Canvas.getDocument();
      if (cdoc?.body) {
        canvasObserver = new MutationObserver(scheduleValidation);
        canvasObserver.observe(cdoc.body, { childList: true, subtree: true });
      }
    };
    editor.on('load', onCanvasLoad);
    editor.on('component:add', scheduleValidation);
    editor.on('component:remove', scheduleValidation);
    editor.on('component:update', scheduleValidation);

    return () => {
      if (timer) clearTimeout(timer);
      if (validationTimer) clearTimeout(validationTimer);
      canvasObserver?.disconnect();
      editor.off('update', onUpdate);
      editor.off('component:selected', highlightBlockForSelection);
      editor.off('component:deselected', onDeselected);
      editor.off('load', onCanvasLoad);
      editor.off('component:add', scheduleValidation);
      editor.off('component:remove', scheduleValidation);
      editor.off('component:update', scheduleValidation);
      editor.destroy();
      editorRef.current = null;
      setEditorInstance(null);
      // L'éditeur est détruit (changement de config) : la modale d'import n'a plus de cible.
      setImportOpen(false);
    };
    // Réinitialisation uniquement au changement de config (id) ou fin de chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, cfg.loading]);

  // Au retour sur l'onglet « Blocs », re-scrolle vers le bloc surligné (s'il existe) : la palette est
  // `display:none` sur les autres vues, donc le scroll déclenché à la sélection n'a pas pu s'appliquer.
  useEffect(() => {
    if (activeView !== 'blocks') return;
    const id = selectedBlockIdRef.current;
    if (!id) return;
    blocksRef.current?.querySelector(`[data-cz-block="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [activeView]);

  // ── Hydratation par PAGE active (sans réinitialiser l'éditeur) ─────────────────
  // Au changement de page active, on recharge son projectData via `loadProjectData` (l'éditeur survit).
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || cfg.loading) return;
    // Tant que les pages ne sont pas résolues (et sans erreur), on attend : ne pas hydrater en 'legacy'
    // prématurément alors que le mode page va s'activer.
    const sitesPending = cfg.config != null && !pages.ready && pages.error == null;
    if (sitesPending) return;
    const key: number | 'legacy' = pageMode && pages.selectedPage ? pages.selectedPage.id : 'legacy';
    if (lastHydratedRef.current === key) return;
    lastHydratedRef.current = key;
    const source = pageMode && pages.selectedPage ? pages.selectedPage.blocks : cfg.config?.pageLayout;
    // Suspend la persistance le temps du chargement (load émet des `update`).
    hydratingRef.current = true;
    try {
      // Charge projectData (ré-éditable) OU enveloppe html+css (template importé) OU canvas vierge.
      loadPageInto(editor, source);
    } finally {
      // Relâche au prochain tick : laisse passer les `update` synchrones émis par le load.
      setTimeout(() => { hydratingRef.current = false; }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.ready, pages.error, pages.selectedPageId, cfg.loading]);

  // ── Thème réactif (sans réinitialiser l'éditeur) ──────────────────────────────
  // Quand un champ de thème de l'org change (primaryColor / police / tokens / CSS custom), on met à
  // jour le CSS du canvas (style dédié dans l'iframe) ET on re-rend les widgets live pour que le SDK
  // se remonte avec le nouveau thème. La signature isole les champs pertinents (évite les re-rendus
  // sur d'autres mutations de config, ex. nom du projet).
  const c = cfg.config;
  const themeSig = c
    ? JSON.stringify([c.primaryColor, c.fontFamily, c.designTokens, c.customCss, c.defaultCurrency, c.defaultLanguage])
    : '';
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !c) return;
    applyCanvasThemeCss(editor, c);
    rerenderBookingWidgets(editor);
    // Dépend uniquement de la signature de thème ; `c` est lu via la ref dans les helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [themeSig]);

  // ── Device piloté par le page header (le sélecteur device natif GrapesJS est masqué via CSS) ──
  useEffect(() => {
    if (editorInstance) editorInstance.setDevice(GJS_DEVICE[breakpoint]);
  }, [breakpoint, editorInstance]);

  // ── Gestion des pages (B4) : sauvegarde la page courante avant de switcher/ajouter ─────────────
  // Force la sauvegarde immédiate de l'enveloppe grapes de la page active (court-circuite le débounce),
  // pour ne pas perdre les dernières frappes au changement de page. No-op hors mode page.
  const flushActivePage = useCallback(async (): Promise<boolean> => {
    const editor = editorRef.current;
    const target = persistTargetRef.current;
    if (!editor || !target.pageMode || target.pageId == null) return true;
    try {
      await target.savePageBlocks(target.pageId, serializeEnvelope(editor));
      return true;
    } catch {
      return false; // on reste sur la page courante si l'enregistrement échoue
    }
  }, []);

  const handleSelectPage = useCallback(async (id: number) => {
    if (id === pages.selectedPageId) return;
    if (!(await flushActivePage())) return;
    pages.selectPage(id);
  }, [pages, flushActivePage]);

  const handleAddPage = useCallback(async () => {
    if (!(await flushActivePage())) return;
    await pages.addPage();
  }, [pages, flushActivePage]);

  // Changement de LANGUE d'édition : flush la page courante, puis bascule (undefined = langue par défaut).
  // `useSitePages` re-sélectionne alors l'accueil de la langue → l'effet d'hydratation recharge le canvas.
  const handleSelectLocale = useCallback(async (code: string) => {
    if (code === pages.activeLocale) return;
    if (!(await flushActivePage())) return;
    setEditLocale(code === pages.defaultLocale ? undefined : code);
  }, [pages.activeLocale, pages.defaultLocale, flushActivePage]);

  // Ajoute une langue au site (déclare + bootstrappe ses pages) puis bascule dessus en édition.
  const handleAddLanguage = useCallback(async (code: string) => {
    if (!(await flushActivePage())) return;
    await pages.addLanguage(code);
    setEditLocale(code);
  }, [pages, flushActivePage]);

  // Traduit (IA) la page active depuis la langue par défaut. Source = page `locale=null` de même path
  // (sinon repli sur la page courante) → traduit le texte → écrase la page active + recharge le canvas.
  const [translating, setTranslating] = useState(false);
  const handleTranslatePage = useCallback(async () => {
    const editor = editorRef.current;
    const site = pages.site;
    const current = pages.selectedPage;
    if (!editor || !site || !current || pages.activeLocale === pages.defaultLocale || translating) return;
    const source = pages.defaultPageByPath(current.path) ?? current;
    const hc = parseHtmlCssEnvelope(source.blocks);
    if (!hc) return;
    setTranslating(true);
    try {
      const { html } = await sitesApi.translateHtml(site.id, { html: hc.html, targetLocale: pages.activeLocale });
      const env = JSON.stringify({ format: GRAPES_FORMAT, html, css: hc.css });
      await pages.savePageBlocks(current.id, env);
      // Recharge le canvas avec la traduction (page active inchangée → l'effet d'hydratation ne se redéclenche pas).
      hydratingRef.current = true;
      try { loadPageInto(editor, env); } finally { setTimeout(() => { hydratingRef.current = false; }, 0); }
      lastHydratedRef.current = current.id;
    } catch {
      /* échec traduction : la page reste inchangée (erreur réseau/IA) */
    } finally {
      setTranslating(false);
    }
  }, [pages, translating]);

  // Traduit TOUTES les pages de la langue active (depuis leurs sources par défaut), best-effort séquentiel.
  const handleTranslateAll = useCallback(async () => {
    const editor = editorRef.current;
    const site = pages.site;
    if (!editor || !site || pages.activeLocale === pages.defaultLocale || translating) return;
    const targets = pages.pages;
    if (targets.length === 0) return;
    setTranslating(true);
    try {
      let activeEnv: string | null = null;
      for (const pg of targets) {
        const source = pages.defaultPageByPath(pg.path) ?? pg;
        const hc = parseHtmlCssEnvelope(source.blocks);
        if (!hc) continue;
        const { html } = await sitesApi.translateHtml(site.id, { html: hc.html, targetLocale: pages.activeLocale });
        const env = JSON.stringify({ format: GRAPES_FORMAT, html, css: hc.css });
        await pages.savePageBlocks(pg.id, env);
        if (pg.id === pages.selectedPageId) activeEnv = env;
      }
      // Recharge la page active avec sa traduction (les autres sont déjà persistées).
      if (activeEnv) {
        hydratingRef.current = true;
        try { loadPageInto(editor, activeEnv); } finally { setTimeout(() => { hydratingRef.current = false; }, 0); }
        lastHydratedRef.current = pages.selectedPageId;
      }
    } catch {
      /* échec : certaines pages peuvent rester non traduites (best-effort) */
    } finally {
      setTranslating(false);
    }
  }, [pages, translating]);

  // Auto-traduction IA (P1) de la page ACTIVE vers des langues cibles choisies : crée les variantes
  // localisées EN BROUILLON via l'endpoint dédié (relecture humaine), puis recharge les pages du site.
  // Distinct du « Traduire (IA) » in-place ci-dessus : ici on génère des variantes à relire, sans écraser.
  const [autoTranslateOpen, setAutoTranslateOpen] = useState(false);
  // Cibles proposées = langues supportées hors langue de la page active (sa propre langue).
  const autoTranslateTargets = SUPPORTED_LOCALES.filter((l) => l !== pages.activeLocale);

  const handleAutoTranslatePage = useCallback(async (targets: string[]) => {
    const site = pages.site;
    const current = pages.selectedPage;
    if (!site || !current) {
      throw new Error(t('bookingEngine.studio.ai.translate.noPage', 'Aucune page sélectionnée.'));
    }
    // S'assure que le brouillon courant est persisté avant de traduire (la source doit être à jour).
    await flushActivePage();
    const result = await sitesApi.autoTranslatePage(site.id, current.id, targets);
    const created = result.createdPages.length;
    const skipped = result.skippedLocales.length;
    setAutoTranslateOpen(false);
    if (created > 0) {
      notify.success(
        t('bookingEngine.studio.ai.translate.success', '{{count}} variante(s) créée(s) en brouillon — à relire avant publication.', { count: created }),
      );
    } else {
      notify.info(
        t('bookingEngine.studio.ai.translate.noneCreated', 'Aucune variante créée (langues déjà traduites).'),
      );
    }
    if (skipped > 0) {
      notify.info(
        t('bookingEngine.studio.ai.translate.skipped', '{{count}} langue(s) ignorée(s) (déjà traduite(s)).', { count: skipped }),
      );
    }
    // Recharge site + pages pour faire apparaître les nouvelles variantes (barre de langues + pages).
    try { await pages.reload(); } catch { /* best-effort : les variantes existent côté serveur */ }
    return result;
  }, [pages, flushActivePage, notify, t]);

  // Repartir de zéro (B4) : supprime toutes les pages sauf l'accueil, vide l'accueil, et blanchit le canvas.
  const handleReset = useCallback(async () => {
    const homeId = pages.pages.find((p) => p.type === 'HOME')?.id ?? null;
    try {
      await pages.resetSite();
    } catch {
      return; // erreurs exposées par le hook
    }
    const editor = editorRef.current;
    if (editor) {
      // L'accueil reste la page active (id inchangé) → l'effet d'hydratation ne se redéclenche pas :
      // on blanchit donc le canvas manuellement (persistance suspendue le temps du chargement).
      hydratingRef.current = true;
      try {
        editor.loadProjectData({ pages: [{ component: '' }] } as unknown as ProjectData);
      } finally {
        setTimeout(() => { hydratingRef.current = false; }, 0);
      }
    }
    lastHydratedRef.current = homeId;
  }, [pages]);

  // Import d'un template natif multi-page (galerie) : crée/maj une SitePage par page (non destructif),
  // applique le thème (couleur/police de marque), charge l'accueil dans le canvas. Repli mono-page si
  // l'API sites est indisponible : charge juste l'accueil (persisté dans config.pageLayout).
  const handleImportTemplate = useCallback(async (template: GalleryTemplate) => {
    setImportOpen(false);
    const editor = editorRef.current;

    // Thème de marque : reflété live via l'effet réactif + persisté par le hook config.
    const themeChanges: Partial<BookingEngineConfig> = {};
    if (template.theme?.primaryColor) themeChanges.primaryColor = template.theme.primaryColor;
    if (template.theme?.fontFamily) themeChanges.fontFamily = template.theme.fontFamily;
    if (Object.keys(themeChanges).length > 0) cfg.patch(themeChanges);

    // Skin cosmétique des widgets baké dans CHAQUE page (light DOM) : variables de marque du template
    // + feuille de base. Les widgets headless sont ainsi habillés dès l'import, et restent surchargeables.
    const skinBlock = buildWidgetSkinBlock(template.theme?.primaryColor, template.theme?.fontFamily);
    const envelopeOf = (p: { html: string; css: string }) =>
      JSON.stringify({ format: GRAPES_FORMAT, html: p.html, css: `${p.css}\n\n${skinBlock}` });

    if (pages.ready) {
      try {
        const result = await pages.importPages(
          template.pages.map((p) => ({
            path: p.path,
            type: p.type,
            title: p.title,
            seoTitle: p.seoTitle ?? null,
            seoDescription: p.seoDescription ?? null,
            blocks: envelopeOf(p),
          })),
        );
        // L'accueil est désormais sélectionné ; s'il l'était déjà, l'effet d'hydratation ne se redéclenche
        // pas → on charge son contenu manuellement dans le canvas (comme handleReset). Persistance
        // suspendue : importPages a déjà écrit les pages (auto-conversion projectData au 1er edit).
        if (editor && result) {
          hydratingRef.current = true;
          try {
            loadPageInto(editor, result.homeBlocks);
          } finally {
            setTimeout(() => { hydratingRef.current = false; }, 0);
          }
          lastHydratedRef.current = result.homeId;
        }
      } catch {
        /* échec API : erreurs exposées par le hook ; on n'écrase pas le canvas courant */
      }
      return;
    }

    // Repli mono-page : pas de SitePages → on charge l'accueil (NON suspendu → persisté en pageLayout).
    if (editor) {
      const home = template.pages.find((p) => p.type === 'HOME') ?? template.pages[0];
      if (home) loadPageInto(editor, envelopeOf(home));
    }
  }, [pages, cfg]);

  // ── Auto-import du template de galerie ─────────────────────────────────────────
  // « Utiliser ce template » (StudioHome) crée le booking engine puis navigue ici avec `templateId` en
  // state. Une fois l'éditeur monté ET les pages résolues (ou en repli mono-page), on importe une seule
  // fois, puis on consomme le state (replace) pour éviter un ré-import au rechargement.
  useEffect(() => {
    if (autoImportedRef.current) return;
    const templateId = (location.state as { templateId?: string } | null)?.templateId;
    if (!templateId) return;
    if (!editorInstance || cfg.loading) return;
    // Attendre que les SitePages soient résolues (ready) ou définitivement en erreur (repli mono-page).
    if (cfg.config != null && !pages.ready && pages.error == null) return;
    autoImportedRef.current = true;
    const template = GALLERY_TEMPLATES.find((t) => t.id === templateId);
    if (template) void handleImportTemplate(template);
    // Consomme le state : un rechargement ne doit pas ré-importer par-dessus les modifications de l'hôte.
    navigate(location.pathname, { replace: true, state: null });
  }, [editorInstance, cfg.loading, cfg.config, pages.ready, pages.error, location, navigate, handleImportTemplate]);

  // Publication (B4) : enregistre le brouillon courant puis fige l'instantané publié (servi au public).
  const handlePublish = useCallback(async () => {
    if (!pageMode || pages.selectedPageId == null) return;
    setPublishing(true);
    try {
      if (!(await flushActivePage())) return;
      await pages.publishPage(pages.selectedPageId);
    } catch {
      /* erreurs exposées par le hook */
    } finally {
      setPublishing(false);
    }
  }, [pageMode, pages, flushActivePage]);

  // Modifications non publiées : brouillon serveur divergent (la frappe en cours est figée au flush).
  const needsPublish = pageMode && (pages.selectedPage?.dirty ?? false);

  // ── Barre d'outils (option A) : actions pilotant l'éditeur via commandes GrapesJS / UndoManager ──
  const doUndo = useCallback(() => { editorRef.current?.UndoManager.undo(); }, []);
  const doRedo = useCallback(() => { editorRef.current?.UndoManager.redo(); }, []);
  const openCode = useCallback(() => { editorRef.current?.runCommand('export-template'); }, []);
  const handleFunnel = useCallback(() => { setFunnelPickerOpen(true); }, []);
  // Dépose le skin cosmétique des widgets dans le CSS de la page courante (idempotent via sentinelle) +
  // applique les variables de marque de l'org. Point de départ stylable pour les sites hors galerie.
  const insertWidgetStyles = useCallback(() => {
    const ed = editorRef.current;
    if (!ed) return;
    widgetSkinOnRef.current = true;
    // Affichage éditeur FIABLE : injection raw dans l'iframe (le navigateur parse le skin).
    applyWidgetSkinToCanvas(ed, cfg.config?.primaryColor, cfg.config?.fontFamily);
    // Persistance/export (best-effort) : ajout au CSS projet (le parser GrapesJS peut ignorer certaines
    // règles `::after`/`var()` → l'affichage reste assuré par le <style> canvas ci-dessus).
    try {
      if (!ed.Css.getRule(WIDGET_SKIN_SENTINEL)) ed.Css.addRules(WIDGET_SKIN_CSS);
      const vars: Record<string, string> = {};
      if (cfg.config?.primaryColor) vars['--cb-accent'] = cfg.config.primaryColor;
      if (cfg.config?.fontFamily) vars['--cb-font'] = cfg.config.fontFamily;
      if (Object.keys(vars).length) ed.Css.setRule('.cb-widget', vars);
      ed.trigger('update');
    } catch { /* parser GrapesJS : affichage éditeur déjà garanti par le <style> canvas */ }
  }, [cfg.config?.primaryColor, cfg.config?.fontFamily]);
  const handleInsertFunnel = useCallback((widgetIds: string[]) => {
    const ed = editorRef.current;
    if (ed) insertFunnel(ed, widgetIds);
  }, []);
  // P3 — parcours custom de l'org, persistés en JSON dans `config.funnelPresets` (re-parsé à chaque rendu,
  // payload léger). Save = id généré + append ; delete = filtre. Écriture débouncée par le hook config.
  const savedFunnelPresets = parseSavedPresets(cfg.config?.funnelPresets);
  const handleSaveFunnelPreset = useCallback((preset: { id?: string; label: string; widgetIds: string[] }) => {
    const current = parseSavedPresets(cfg.config?.funnelPresets);
    // `id` connu + déjà présent → mise à jour en place (édition d'un custom) ; sinon → création (fork / nouveau).
    if (preset.id && current.some((p) => p.id === preset.id)) {
      const next = current.map((p) =>
        p.id === preset.id ? { ...p, label: preset.label, widgetIds: preset.widgetIds } : p,
      );
      cfg.patch({ funnelPresets: serializeSavedPresets(next) });
      return;
    }
    const id = preset.id ?? `custom-${Date.now().toString(36)}`;
    cfg.patch({ funnelPresets: serializeSavedPresets([...current, { id, label: preset.label, widgetIds: preset.widgetIds }]) });
  }, [cfg]);
  const handleDeleteFunnelPreset = useCallback((id: string) => {
    const current = parseSavedPresets(cfg.config?.funnelPresets).filter((p) => p.id !== id);
    cfg.patch({ funnelPresets: serializeSavedPresets(current) });
  }, [cfg]);

  // ── Widgets composites (P1–P3) : bibliothèque persistée par org dans `config.compositeWidgets`. ──
  const savedComposites = parseSavedComposites(cfg.config?.compositeWidgets);
  // Expose les composites comme BLOCS draggables (catégorie « Composites » du panneau Blocs), re-synchronisés
  // à l'init de l'éditeur et à chaque changement de la bibliothèque.
  useEffect(() => {
    const ed = editorRef.current;
    if (ed) registerCompositeBlocks(ed, [...BUILTIN_COMPOSITES, ...savedComposites]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorInstance, cfg.config?.compositeWidgets]);
  const handleInsertComposite = useCallback((c: CompositeWidget) => {
    const ed = editorRef.current;
    if (ed) insertComposite(ed, c);
  }, []);
  const handleInsertCompositeDraft = useCallback((d: CompositeDraft) => {
    const ed = editorRef.current;
    if (!ed) return;
    // Règles éditées dans le mini-éditeur (par classe) → fusionnées dans le CSS du template global.
    if (d.css?.trim()) ed.addStyle(d.css);
    insertComposite(ed, { id: `composite-${Date.now().toString(36)}`, name: d.name, html: d.html });
  }, []);
  const handleSaveComposite = useCallback((d: CompositeDraft) => {
    const ed = editorRef.current;
    // Règles éditées (par classe) → CSS du template global (persisté avec la page via onUpdate).
    if (ed && d.css?.trim()) ed.addStyle(d.css);
    // Le CSS rejoint le template (global) ; on ne stocke QUE name/html dans la bibliothèque du composite.
    const widget = { name: d.name, html: d.html };
    const current = parseSavedComposites(cfg.config?.compositeWidgets);
    // Édition : met à jour le composite existant (même id) ; sinon en crée un nouveau.
    const editId = editingComposite && current.some((c) => c.id === editingComposite.id) ? editingComposite.id : null;
    const next = editId
      ? current.map((c) => (c.id === editId ? { ...c, ...widget } : c))
      : [...current, { id: `composite-${Date.now().toString(36)}`, ...widget } as CompositeWidget];
    // Persistance IMMÉDIATE (PUT) → le composite survit à un reload / une reconnexion.
    void cfg.patchPersist({ compositeWidgets: serializeSavedComposites(next) }).catch(() => { /* erreur exposée par le hook */ });
  }, [cfg, editingComposite]);
  const handleEditComposite = useCallback((c: CompositeWidget) => {
    setEditingComposite(c);
    setCompositeCreatorOpen(true);
  }, []);
  const handleDeleteComposite = useCallback((id: string) => {
    const current = parseSavedComposites(cfg.config?.compositeWidgets).filter((c) => c.id !== id);
    void cfg.patchPersist({ compositeWidgets: serializeSavedComposites(current) }).catch(() => { /* erreur exposée par le hook */ });
  }, [cfg]);
  const togglePreview = useCallback(() => {
    const ed = editorRef.current; if (!ed) return;
    setPreviewOn((on) => { if (on) ed.stopCommand('preview'); else ed.runCommand('preview'); return !on; });
  }, []);
  const toggleFullscreen = useCallback(() => {
    const ed = editorRef.current; if (!ed) return;
    setFullscreenOn((on) => { if (on) ed.stopCommand('fullscreen'); else ed.runCommand('fullscreen'); return !on; });
  }, []);
  const toggleOutline = useCallback(() => {
    const ed = editorRef.current; if (!ed) return;
    setOutlineOn((on) => { if (on) ed.stopCommand('sw-visibility'); else ed.runCommand('sw-visibility'); return !on; });
  }, []);

  if (cfg.loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)' }}>
        Chargement de l’éditeur…
      </Box>
    );
  }

  const chromeHidden = previewOn; // en aperçu : on masque toute la chrome (barre + pages + panneau)

  return (
    <Box className="clenzy-grapes" sx={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Barre des pages (multi-page) — masquée en aperçu. */}
      {pageMode && !chromeHidden && (
        <Box sx={{ display: 'flex', alignItems: 'center', flexShrink: 0, borderBottom: '1px solid var(--line)', bgcolor: 'var(--bg)' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <PagesBar
              pages={pages.pages}
              selectedId={pages.selectedPageId}
              onSelect={handleSelectPage}
              onAdd={handleAddPage}
              onRename={pages.renamePage}
              onDelete={pages.deletePage}
              onMove={pages.movePage}
              onReset={handleReset}
              busy={pages.loading}
            />
          </Box>
          {/* Barre de LANGUES : bascule la langue d'édition (chips) + ajoute une langue supportée. La
              langue par défaut édite les pages `locale=null` ; les autres leurs variantes traduites. */}
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 1, flexShrink: 0, borderLeft: '1px solid var(--line)' }}>
            {pages.availableLocales.map((loc) => {
              const active = loc === pages.activeLocale;
              return (
                <ButtonBase
                  key={loc}
                  onClick={() => { void handleSelectLocale(loc); }}
                  aria-pressed={active}
                  sx={{
                    height: 24, px: 1, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--fw-semibold)', letterSpacing: '.04em', cursor: 'pointer',
                    color: active ? 'var(--on-accent)' : 'var(--muted)',
                    bgcolor: active ? 'var(--accent)' : 'transparent',
                    '&:hover': { bgcolor: active ? 'var(--accent)' : 'var(--hover)', color: active ? 'var(--on-accent)' : 'var(--ink)' },
                  }}
                >
                  {LOCALE_LABEL[loc] ?? loc.toUpperCase()}
                </ButtonBase>
              );
            })}
            {SUPPORTED_LOCALES.filter((l) => !pages.availableLocales.includes(l)).map((loc) => (
              <Tooltip key={loc} title={`Ajouter la langue ${LOCALE_LABEL[loc] ?? loc.toUpperCase()} (copie de la langue par défaut, à traduire)`}>
                <ButtonBase
                  onClick={() => { void handleAddLanguage(loc); }}
                  disabled={pages.loading}
                  sx={{
                    height: 24, px: 0.75, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--fw-medium)', color: 'var(--muted)', border: '1px dashed var(--line)',
                    cursor: 'pointer', '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
                    '&.Mui-disabled': { opacity: 0.4 },
                  }}
                >
                  + {LOCALE_LABEL[loc] ?? loc.toUpperCase()}
                </ButtonBase>
              </Tooltip>
            ))}
            {/* Auto-traduction IA (P1) : crée des VARIANTES en brouillon de la page active vers les
                langues choisies (relecture humaine), via l'endpoint dédié — distinct du « Traduire »
                in-place ci-dessous. Toujours disponible dès qu'une page est sélectionnée. */}
            {pages.selectedPage && autoTranslateTargets.length > 0 && (
              <Tooltip title={t('bookingEngine.studio.ai.translate.pageTooltip', 'Traduire cette page (IA) — crée des variantes en brouillon')}>
                <ButtonBase
                  onClick={() => setAutoTranslateOpen(true)}
                  disabled={pages.loading}
                  aria-label={t('bookingEngine.studio.ai.translate.pageAction', 'Traduire (IA)')}
                  sx={{
                    height: 24, px: 1, ml: 0.5, borderRadius: 'var(--radius-sm)', display: 'inline-flex',
                    alignItems: 'center', gap: 0.5, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)',
                    color: 'var(--accent)', border: '1px solid var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: 'var(--accent)', color: 'var(--on-accent)' },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  <Languages size={13} strokeWidth={2.2} />
                  {t('bookingEngine.studio.ai.translate.pageAction', 'Traduire (IA)')}
                </ButtonBase>
              </Tooltip>
            )}
            {/* Traduction in-place : visible seulement hors langue par défaut. Traduit la page active. */}
            {pages.activeLocale !== pages.defaultLocale && (
              <Tooltip title="Traduire cette page depuis la langue par défaut (IA)">
                <ButtonBase
                  onClick={() => { void handleTranslatePage(); }}
                  disabled={translating || pages.loading}
                  sx={{
                    height: 24, px: 1, ml: 0.5, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--fw-semibold)', color: 'var(--accent)', border: '1px solid var(--accent)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    '&:hover': { bgcolor: 'var(--accent)', color: 'var(--on-accent)' },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  {translating ? 'Traduction…' : 'Traduire (IA)'}
                </ButtonBase>
              </Tooltip>
            )}
            {pages.activeLocale !== pages.defaultLocale && (
              <Tooltip title="Traduire TOUTES les pages de cette langue (IA)">
                <ButtonBase
                  onClick={() => { void handleTranslateAll(); }}
                  disabled={translating || pages.loading}
                  sx={{
                    height: 24, px: 0.75, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-2xs)',
                    fontWeight: 'var(--fw-medium)', color: 'var(--muted)', border: '1px solid var(--line)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                    '&:hover': { color: 'var(--accent)', borderColor: 'var(--accent)' },
                    '&.Mui-disabled': { opacity: 0.5 },
                  }}
                >
                  Tout
                </ButtonBase>
              </Tooltip>
            )}
          </Box>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1, flexShrink: 0 }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: needsPublish ? 'var(--warn, #B26B00)' : 'var(--ok)' }}>
              <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: needsPublish ? 'var(--warn, #D4A574)' : 'var(--ok)' }} />
              {needsPublish ? 'Brouillon non publié' : 'Publié'}
            </Box>
            <Tooltip title={needsPublish ? 'Publier la version en ligne' : 'Aucune modification à publier'}>
              <Box component="span">
                <ButtonBase
                  onClick={() => { handlePublish(); }}
                  disabled={publishing || !needsPublish}
                  sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 28, px: 1.5,
                    borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
                    fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                    '&:hover': { bgcolor: 'var(--accent-deep)' },
                    '&.Mui-disabled': { opacity: 0.45 },
                    '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                  }}
                >
                  <Rocket size={14} strokeWidth={2} /> {publishing ? 'Publication…' : 'Publier'}
                </ButtonBase>
              </Box>
            </Tooltip>
          </Box>
        </Box>
      )}

      {/* Barre d'outils de l'éditeur (option A — 100 % React, un seul style de bouton). Masquée en aperçu. */}
      {!chromeHidden && (
        <Box
          className="cz-editor-toolbar"
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, height: 44, px: 1,
            borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)',
          }}
        >
          <ToolBtn icon={Undo2} title="Annuler" onClick={doUndo} />
          <ToolBtn icon={Redo2} title="Rétablir" onClick={doRedo} />
          <Box sx={{ width: '1px', height: 20, bgcolor: 'var(--line)', mx: 0.5 }} />
          {/* Import = mode Avancé uniquement (import de design multi-standards). Masqué en Guidé. */}
          {!guided && <ToolBtn icon={FolderInput} title="Importer un design" label="Importer" onClick={() => setImportOpen(true)} />}
          <ToolBtn icon={Workflow} title="Parcours de réservation (modèles + composeur)" label="Funnel" onClick={handleFunnel} />
          <ToolBtn icon={PaintBucket} title="Insérer les styles de widgets (skin de base, à personnaliser)" label="Styles widgets" onClick={insertWidgetStyles} />
          <Box sx={{ flex: 1, minWidth: 8 }} />
          <ToolBtn icon={SquareDashed} title="Afficher les contours d'édition" active={outlineOn} onClick={toggleOutline} />
          <ToolBtn icon={Eye} title="Aperçu" active={previewOn} onClick={togglePreview} />
          <ToolBtn icon={Maximize} title="Plein écran" active={fullscreenOn} onClick={toggleFullscreen} />
          <ToolBtn icon={Code} title="Voir le code généré" onClick={openCode} />
          <Box sx={{ width: '1px', height: 20, bgcolor: 'var(--line)', mx: 0.5 }} />
          <ToolBtn
            icon={panelCollapsed ? PanelLeftOpen : PanelLeftClose}
            title={panelCollapsed ? 'Afficher le panneau' : 'Réduire le panneau'}
            onClick={() => setPanelCollapsed((c) => !c)}
          />
        </Box>
      )}

      {/* Canvas (GrapesJS) + panneau droit (managers React). */}
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Zone canvas (relative) : ancre la dalle du constructeur SANS couvrir le panneau droit (onglets). */}
        <Box sx={{ flex: 1, minWidth: 0, height: '100%', position: 'relative' }}>
          <Box ref={containerRef} sx={{ width: '100%', height: '100%' }} />
          {/* Dalle du constructeur de composite : overlay de la SEULE zone canvas (≠ plein écran). */}
          <CompositeBuilder
            open={compositeCreatorOpen}
            config={cfg.config}
            initial={editingComposite}
            getTemplateCss={() => editorRef.current?.getCss() ?? ''}
            onClose={() => { setCompositeCreatorOpen(false); setEditingComposite(null); }}
            onInsert={handleInsertCompositeDraft}
            onSave={handleSaveComposite}
          />
        </Box>
        {/* Panneau droit : conteneurs des managers, TOUJOURS montés (cible `appendTo`) ; on bascule la
            vue par `display` et on réduit la largeur à 0 (sans démonter) au repli / en aperçu. */}
        <Box
          className="cz-rightpanel"
          sx={{
            flexShrink: 0, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            // Replié pendant l'édition d'un composite → le constructeur (+ sa propre palette) est l'UNIQUE
            // colonne de droite (pas de double colonne avec le panneau du Studio).
            width: panelCollapsed || chromeHidden || compositeCreatorOpen ? 0 : 300,
            borderLeft: panelCollapsed || chromeHidden || compositeCreatorOpen ? 'none' : '1px solid var(--line)',
            bgcolor: 'var(--card)',
          }}
        >
          {/* Sélecteur de vue — en tête du panneau droit (segmented), FIXE (hors zone de scroll). */}
          {!panelCollapsed && !chromeHidden && (
            <Box sx={{ flexShrink: 0, display: 'flex', justifyContent: 'center', p: 1, borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
              <Box sx={{ display: 'inline-flex', gap: 0.25, p: 0.25, borderRadius: 'var(--radius-md)', bgcolor: 'var(--field)' }}>
                {visibleTabs.map(({ key, icon: Icon, label }) => {
                  const active = key === activeView;
                  return (
                    <Tooltip key={key} title={label}>
                      <ButtonBase
                        onClick={() => setActiveView(key)}
                        aria-label={label}
                        aria-pressed={active}
                        sx={{
                          width: 34, height: 28, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                          color: active ? 'var(--accent)' : 'var(--muted)',
                          bgcolor: active ? 'var(--card)' : 'transparent',
                          boxShadow: active ? 'var(--shadow-card)' : 'none',
                          transition: 'color var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out)',
                          '&:hover': { color: active ? 'var(--accent)' : 'var(--ink)' },
                          '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
                        }}
                      >
                        <Icon size={16} strokeWidth={2} />
                      </ButtonBase>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          )}
          {/* Contenu — SEUL à scroller : la barre de défilement n'apparaît plus au niveau des onglets. */}
          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
            {/* `data-guided` (mode Guidé) → la palette se restreint au set curé via CSS (`grapesStudio.css`). */}
            <Box ref={blocksRef} {...(guided ? { 'data-guided': '' } : {})} sx={{ display: activeView === 'blocks' ? 'block' : 'none' }} />
            {activeView === 'composites' && (
              <CompositesPanel
                composites={[...BUILTIN_COMPOSITES, ...savedComposites]}
                onInsert={handleInsertComposite}
                onEdit={handleEditComposite}
                onDelete={handleDeleteComposite}
                onNew={() => { setEditingComposite(null); setCompositeCreatorOpen(true); }}
              />
            )}
            <Box ref={stylesRef} sx={{ display: activeView === 'styles' ? 'block' : 'none' }} />
            <Box ref={layersRef} sx={{ display: activeView === 'layers' ? 'block' : 'none' }} />
            <Box ref={traitsRef} sx={{ display: activeView === 'traits' ? 'block' : 'none' }} />
          </Box>
        </Box>
      </Box>

      {/* Aperçu : seule affordance visible = quitter l'aperçu. */}
      {chromeHidden && (
        <Tooltip title="Quitter l'aperçu">
          <ButtonBase
            onClick={togglePreview}
            aria-label="Quitter l'aperçu"
            sx={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              height: 32, px: 1.5, display: 'inline-flex', alignItems: 'center', gap: 0.5,
              borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
              fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer',
              boxShadow: 'var(--shadow-card)',
              '&:hover': { bgcolor: 'var(--accent-deep)' },
            }}
          >
            <Eye size={15} strokeWidth={2} /> Quitter l’aperçu
          </ButtonBase>
        </Tooltip>
      )}

      <ImportPanel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        editor={editorInstance}
        onImportTemplate={handleImportTemplate}
      />
      <FunnelPicker
        open={funnelPickerOpen}
        onClose={() => setFunnelPickerOpen(false)}
        onInsert={handleInsertFunnel}
        savedPresets={savedFunnelPresets}
        onSave={handleSaveFunnelPreset}
        onDelete={handleDeleteFunnelPreset}
      />
      <TranslateModal
        open={autoTranslateOpen}
        onClose={() => setAutoTranslateOpen(false)}
        targetName={pages.selectedPage?.title ?? null}
        availableTargets={autoTranslateTargets}
        onTranslate={handleAutoTranslatePage}
      />
    </Box>
  );
}
