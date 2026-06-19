import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, Tooltip } from '@mui/material';
import { Rocket } from 'lucide-react';
import grapesjs, { type Editor, type ProjectData } from 'grapesjs';
import 'grapesjs/dist/css/grapes.min.css';
import type { StudioConfigState } from '../useStudioConfig';
import type { BookingEngineConfig, DesignTokens } from '../../../../services/api/bookingEngineApi';
import { registerBookingComponents } from './bookingComponents';
import { BOOKING_WIDGET_DEFS } from './bookingWidgetDefs';
import ImportPanel from './ImportPanel';
import type { GalleryTemplate } from './import/galleryTemplates';
import { sanitizeHtml, sanitizeCss } from './import/sanitizeHtml';
import PagesBar from '../builder/PagesBar';
import { useSitePages } from '../useSitePages';
import type { Breakpoint } from '../StudioShell';
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

/** Id stable de la commande GrapesJS qui ouvre le panneau d'import (référencé par le bouton de panneau). */
const IMPORT_COMMAND_ID = 'clenzy:open-import';

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

/** Blocs de base (section, texte, image, colonnes) du BlockManager. */
function registerBaseBlocks(editor: Editor): void {
  const bm = editor.BlockManager;
  bm.add('section', {
    label: 'Section',
    category: 'Structure',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/></svg>',
    content: '<section style="padding:48px 24px"><h2>Titre de section</h2><p>Décrivez votre offre ici.</p></section>',
  });
  bm.add('text', {
    label: 'Texte',
    category: 'Basique',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
    content: { type: 'text', content: 'Insérez votre texte' },
  });
  bm.add('image', {
    label: 'Image',
    category: 'Basique',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></svg>',
    content: { type: 'image' },
    activate: true,
  });
  bm.add('columns', {
    label: 'Colonnes',
    category: 'Structure',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="8" height="16" rx="1"/><rect x="13" y="4" width="8" height="16" rx="1"/></svg>',
    content: `<div style="display:flex;gap:24px;padding:24px">
  <div style="flex:1">Colonne 1</div>
  <div style="flex:1">Colonne 2</div>
</div>`,
  });
}

/**
 * Enregistre la commande d'ouverture du panneau d'import + le bouton « Importer » du panneau d'options
 * (barre d'actions en haut à droite). La commande délègue à `onOpenImport` (callback React qui ouvre la
 * modale `ImportPanel`), ce qui garde toute l'UI d'import en React (≠ DOM brut de l'ancienne modale).
 */
function registerImportButton(editor: Editor, onOpenImport: () => void): void {
  editor.Commands.add(IMPORT_COMMAND_ID, {
    run() {
      onOpenImport();
    },
  });
  editor.Panels.addButton('options', {
    id: IMPORT_COMMAND_ID,
    command: IMPORT_COMMAND_ID,
    label: 'Importer',
    attributes: { title: 'Importer un design' },
    // Pas togglable : action ponctuelle (ouvre l'import) plutôt qu'un mode persistant.
    togglable: false,
  });
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

export interface GrapesStudioProps {
  cfg: StudioConfigState;
  /** Breakpoint d'aperçu, piloté par le toggle du page header (le sélecteur device natif GrapesJS est masqué). */
  breakpoint: Breakpoint;
}

export default function GrapesStudio({ cfg, breakpoint }: GrapesStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);
  // Miroir d'état de l'éditeur : permet à la modale d'import (React) de se (re)rendre une fois l'éditeur
  // monté, sans relire la ref (les refs ne déclenchent pas de rendu).
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  // Ouverture de la modale d'import (pilotée par le bouton de panneau via la commande GrapesJS).
  const [importOpen, setImportOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // `patch` change d'identité à chaque rendu de config ; on le lit via ref pour ne pas réinitialiser
  // l'éditeur (l'effet d'init ne dépend QUE de l'id de la config).
  const patchRef = useRef(cfg.patch);
  patchRef.current = cfg.patch;

  // Accesseur de config COURANTE pour les coutures (montage SDK live, import) : la ref suit chaque
  // rendu, mais l'éditeur n'est PAS réinitialisé (les vues lisent `getConfig()` au (re)mount).
  const configRef = useRef(cfg.config);
  configRef.current = cfg.config;

  // ─── Multi-page (B4) ──────────────────────────────────────────────────────────
  // L'état des pages est résolu via `useSitePages` (find-or-create du site + chargement des pages). En
  // mode page, l'éditeur édite la SitePage active ; sinon (API sites indisponible) repli mono-page.
  const pages = useSitePages(cfg.config?.id ?? undefined);
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
    if (!container || cfg.loading || !cfg.config) return;

    // projectData ré-éditable de la page initiale (undefined si page vierge OU enveloppe html+css seule).
    const initialProject = parseInitialProject(initialBlocksRef.current);

    const editor = grapesjs.init({
      container,
      height: '100%',
      // Devices alignés sur les breakpoints du page header (largeurs = FRAME_WIDTH). Le sélecteur de
      // device NATIF de GrapesJS est masqué (CSS `.gjs-pn-devices-c`) : la bascule se fait via le header.
      deviceManager: {
        devices: [
          { id: 'desktop', name: 'Desktop', width: '' },
          { id: 'tablet', name: 'Tablet', width: '834px' },
          { id: 'mobile', name: 'Mobile', width: '390px' },
        ],
      },
      // L'app gère la persistance (cf. listener `update` ci-dessous) → pas de storage interne.
      storageManager: false,
      // Thème initial de l'iframe du canvas. Les changements ultérieurs passent par l'effet réactif
      // (`applyCanvasThemeCss`), qui met à jour un `<style>` dédié sans réinitialiser l'éditeur.
      canvasCss: buildCanvasThemeCss(cfg.config),
      projectData: initialProject,
    });
    editorRef.current = editor;
    setEditorInstance(editor);
    // Le contenu initial vient d'être chargé via `projectData` : l'effet d'hydratation par page ne doit
    // pas le ré-écraser. On marque la page initiale comme déjà hydratée (clé = id, ou 'legacy').
    lastHydratedRef.current = persistTargetRef.current.pageMode ? persistTargetRef.current.pageId : 'legacy';
    // Page initiale en enveloppe HTML+CSS seule (template natif importé, pas encore re-sérialisé avec
    // projectData) : `projectData` était undefined → on charge via setComponents+setStyle. Persistance
    // suspendue (l'auto-conversion en projectData se fera au 1er edit).
    if (!initialProject) {
      const hc = parseHtmlCssEnvelope(initialBlocksRef.current);
      if (hc) {
        hydratingRef.current = true;
        try {
          editor.setComponents(sanitizeHtml(hc.html));
          if (hc.css.trim()) editor.setStyle(sanitizeCss(hc.css));
        } finally {
          setTimeout(() => { hydratingRef.current = false; }, 0);
        }
      }
    }

    // Contexte des coutures : accesseur de config courante (lu au (re)mount des vues live SDK).
    const ctx = { getConfig: () => configRef.current };

    registerBaseBlocks(editor);
    registerBookingComponents(editor, ctx);
    // Couture import : commande + bouton de panneau « Importer » qui ouvre le panneau React `ImportPanel`.
    registerImportButton(editor, () => setImportOpen(true));

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

    return () => {
      if (timer) clearTimeout(timer);
      editor.off('update', onUpdate);
      editor.destroy();
      editorRef.current = null;
      setEditorInstance(null);
      // L'éditeur est détruit (changement de config) : la modale d'import n'a plus de cible.
      setImportOpen(false);
    };
    // Réinitialisation uniquement au changement de config (id) ou fin de chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configId, cfg.loading]);

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

    const envelopeOf = (p: { html: string; css: string }) =>
      JSON.stringify({ format: GRAPES_FORMAT, html: p.html, css: p.css });

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

  if (cfg.loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)' }}>
        Chargement de l’éditeur…
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Barre des pages (multi-page) : sélection / ajout / renommage / suppression / réordonnancement.
          N'apparaît qu'une fois le site résolu (mode page). En repli mono-page : barre masquée. */}
      {pageMode && (
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

      <Box ref={containerRef} className="clenzy-grapes" sx={{ flex: 1, minHeight: 0 }} />
      <ImportPanel
        open={importOpen}
        onClose={() => setImportOpen(false)}
        editor={editorInstance}
        onImportTemplate={handleImportTemplate}
      />
    </Box>
  );
}
