import { useEffect, useRef, useState } from 'react';
import { Box, ButtonBase, TextField } from '@mui/material';
import { X, Plus, Save, Boxes, Eye } from 'lucide-react';
import grapesjs, { type Editor, type ToolbarButtonProps, type Component } from 'grapesjs';
import { registerBookingComponents, setupEditorInteraction, setCanvasInert, blockLabelHtml } from './bookingComponents';
import { ensureStructuralStyles, STRUCTURAL_STYLE_ID } from '../../sdk/headless';
import { buildFilterGroupHtml } from './searchBarRules';
import { buildCompositeInner, type CompositeWidget } from './compositeWidgets';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';

/** Icône « ouvrir le groupe » (ungroup) — contenu SVG de l'item toolbar (hérite du style natif GrapesJS). */
const EXPLODE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'
  + '<path d="M14 4h3a3 3 0 0 1 3 3v3"/><path d="M10 20H7a3 3 0 0 1-3-3v-3"/></svg>';

/** Icône « compact ↔ déplié » (chevrons gauche/droite) pour basculer le mode du groupe filtre. */
const MODE_ICON_SVG =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="m9 7-5 5 5 5"/><path d="m15 7 5 5-5 5"/></svg>';

/** Lit les sous-filtres (`subs`) sérialisés sur le widget Filtre (défaut : tous). */
const readFilterSubs = (comp: Component): string[] | undefined => {
  const props = comp.getAttributes()['data-clenzy-props'];
  if (typeof props !== 'string') return undefined;
  try {
    const parsed = JSON.parse(props) as { subs?: unknown };
    if (Array.isArray(parsed.subs)) return parsed.subs.filter((x): x is string => typeof x === 'string');
  } catch { /* props illisibles → tous les sous-filtres par défaut */ }
  return undefined;
};

/**
 * Widgets « ÉCLATABLES » : type GrapesJS → markup de remplacement. RESTREINT l'action « Ouvrir le groupe » aux
 * seuls widgets qui CONTIENNENT des sous-widgets (aujourd'hui : le Filtre). Le Filtre devient un GROUPE
 * CONSERVÉ basculable compact ↔ déplié, dont les sous-filtres sont de vrais widgets éditables.
 */
const EXPLODE_BUILDERS: Record<string, (comp: Component) => string> = {
  'booking-filter': (comp) => buildFilterGroupHtml(readFilterSubs(comp)),
};

/** HTML d'éclatement d'un composant SI son type est éclatable, sinon `''`. */
const explodeHtmlFor = (comp: Component): string => {
  const builder = EXPLODE_BUILDERS[String(comp.get('type'))];
  return builder ? builder(comp) : '';
};

/**
 * Constructeur de widget COMPOSITE — MINI-ÉDITEUR GrapesJS embarqué (DnD), MUTUALISÉ avec le booking engine :
 * mêmes blocs (`registerBookingComponents`), mêmes composants live, même CSS (structural + template) que la
 * page. L'utilisateur dépose/déplace les widgets librement ; l'AGENCEMENT qu'il crée EST le composite (markup
 * libre). « Enregistrer » sérialise le markup du canvas → `CompositeWidget.html`.
 */
export interface CompositeDraft {
  name: string;
  /** Markup libre du canvas (source de vérité du rendu). */
  html: string;
  /** Règles CSS éditées dans le mini-éditeur (par classe) → à fusionner dans le CSS du template global. */
  css: string;
}

export interface CompositeBuilderProps {
  open: boolean;
  config: BookingEngineConfig | null;
  /** Composite à MODIFIER (pré-remplit le canvas) ; absent/null = création. */
  initial?: CompositeWidget | null;
  /** CSS du template courant → injecté dans le canvas pour habiller les widgets comme la page. */
  getTemplateCss?: () => string;
  /** Skin widgets de l'engine (`--cb-*` dérivés des tokens) → le composite s'affiche STYLÉ comme sur le
   *  site publié (WYSIWYG), au lieu de neutre. Absent/null = pas de skin (rendu structurel nu). */
  getSkinCss?: () => string;
  onClose: () => void;
  onInsert: (c: CompositeDraft) => void;
  onSave: (c: CompositeDraft) => void;
}

const TPL_STYLE_ID = 'cz-cb-template-css';
const SKIN_STYLE_ID = 'cz-cb-skin-css';

/** Injecte/maj un `<style>` (idempotent) dans le document du canvas. */
function injectStyle(doc: Document | null | undefined, id: string, css: string): void {
  if (!doc) return;
  let el = doc.getElementById(id) as HTMLStyleElement | null;
  if (!el) { el = doc.createElement('style'); el.id = id; (doc.head ?? doc.documentElement).appendChild(el); }
  if (el.textContent !== css) el.textContent = css;
}

/** Blocs de MISE EN PAGE du mini-éditeur (styles INLINE → markup auto-suffisant, pas de CSS séparé). */
function registerLayoutBlocks(editor: Editor): void {
  const bm = editor.BlockManager;
  bm.add('cz-row', {
    label: blockLabelHtml('Ligne', 'Aligne les widgets côte à côte (adaptatif).'),
    category: 'Mise en page',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="8" width="5" height="8" rx="1"/><rect x="10" y="8" width="5" height="8" rx="1"/><rect x="17" y="8" width="4" height="8" rx="1"/></svg>',
    content: '<div data-cz-row style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px;width:100%"></div>',
  });
  bm.add('cz-stack', {
    label: blockLabelHtml('Colonne', 'Empile les widgets les uns sous les autres.'),
    category: 'Mise en page',
    media: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="16" height="5" rx="1"/><rect x="4" y="11" width="16" height="5" rx="1"/></svg>',
    content: '<div data-cz-stack style="display:flex;flex-direction:column;gap:12px;width:100%"></div>',
  });
}

export default function CompositeBuilder({ open, config, initial, getTemplateCss, getSkinCss, onClose, onInsert, onSave }: CompositeBuilderProps) {
  const [name, setName] = useState('');
  // `interactive` = mode INTERAGIR (contenu vivant : ouvrir le filtre, voir le caché, tester). false = ÉDITION (inerte).
  const [interactive, setInteractive] = useState(false);
  // Onglet du panneau droit : palette de blocs ↔ panneau de style (Selector + Style Manager).
  const [rightTab, setRightTab] = useState<'blocks' | 'style'>('blocks');
  const editorRef = useRef<Editor | null>(null);
  const canvasElRef = useRef<HTMLDivElement>(null);
  const blocksElRef = useRef<HTMLDivElement>(null);
  const selectorElRef = useRef<HTMLDivElement>(null);
  const styleElRef = useRef<HTMLDivElement>(null);
  // Refs pour éviter des closures obsolètes dans l'init (qui ne tourne qu'à l'ouverture).
  const configRef = useRef(config); configRef.current = config;
  const tplRef = useRef(getTemplateCss); tplRef.current = getTemplateCss;
  const skinRef = useRef(getSkinCss); skinRef.current = getSkinCss;
  const initialRef = useRef(initial); initialRef.current = initial;

  useEffect(() => { if (open) { setName(initial?.name ?? ''); setInteractive(false); setRightTab('blocks'); } }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const canvasEl = canvasElRef.current;
    const blocksEl = blocksElRef.current;
    const selectorEl = selectorElRef.current;
    const styleEl = styleElRef.current;
    if (!canvasEl || !blocksEl) return;

    const editor = grapesjs.init({
      container: canvasEl,
      height: '100%',
      fromElement: false,
      storageManager: false,
      // Les éditions de style produisent des RÈGLES (par classe), jamais du style inline → ce sont des
      // « règles du template » (cf. décision : CSS template global).
      avoidInlineStyle: true,
      panels: { defaults: [] },
      blockManager: { appendTo: blocksEl },
      // Style ciblé par CLASSE (componentFirst:false) → on édite `.sb__group`, `.sb__field`… = règles du template.
      selectorManager: { appendTo: selectorEl ?? undefined, componentFirst: false },
      styleManager: {
        appendTo: styleEl ?? undefined,
        sectors: [
          { name: 'Disposition', open: true, properties: ['display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self', 'gap'] },
          { name: 'Dimensions', open: false, properties: ['width', 'min-width', 'max-width', 'height', 'padding', 'margin'] },
          { name: 'Typographie', open: false, properties: ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'color', 'text-align'] },
          { name: 'Décoration', open: false, properties: ['background-color', 'border-radius', 'border', 'box-shadow', 'opacity'] },
        ],
      },
    });
    editorRef.current = editor;

    registerLayoutBlocks(editor);
    registerBookingComponents(editor, { getConfig: () => configRef.current });
    setupEditorInteraction(editor); // contenu live inerte en édition (sélection/drag fiables), interactif en aperçu

    // CSS du canvas : structural (layout `.sb`/`.cb-*` + repli des panneaux) + CSS du template (habillage).
    const applyCanvasCss = () => {
      const doc = editor.Canvas.getDocument();
      ensureStructuralStyles(doc);
      injectStyle(doc, TPL_STYLE_ID, tplRef.current?.() ?? '');
      // Skin de l'engine (tokens `--cb-*` + cosmétique de base des widgets) → le composite s'affiche STYLÉ
      // comme sur le site (WYSIWYG). Sans skin (aucun template) → rien injecté → rendu structurel neutre.
      injectStyle(doc, SKIN_STYLE_ID, skinRef.current?.() ?? '');
      // Cascade : on place les feuilles INJECTÉES EN TÊTE du <head> du canvas, donc AVANT le <style> du
      // CssComposer GrapesJS → les éditions du Style Manager (mêmes sélecteurs de classe) gagnent et
      // s'affichent EN DIRECT. Ordre final (faible→fort) : skin → structural → template → (CssComposer).
      const head = doc?.head;
      if (head) {
        for (const id of [TPL_STYLE_ID, STRUCTURAL_STYLE_ID, SKIN_STYLE_ID]) {
          const el = doc?.getElementById(id);
          if (el && head.firstChild !== el) head.insertBefore(el, head.firstChild);
        }
      }
    };
    editor.on('load', applyCanvasCss);
    editor.on('canvas:frame:load', applyCanvasCss);

    // Déclencheur du filtre compact = VERROUILLÉ (icône seule, ni déplaçable ni supprimable individuellement).
    editor.DomComponents.addType('cz-filter-toggle', {
      isComponent: (el) => (el.getAttribute?.('data-cz-filter-toggle') != null ? { type: 'cz-filter-toggle' } : undefined),
      model: { defaults: { draggable: false, selectable: false, droppable: false, copyable: false, removable: false, editable: false, highlightable: false } },
    });

    // Commande « ouvrir le groupe » : un widget ÉCLATABLE (cf. EXPLODE_BUILDERS) est REMPLACÉ par un GROUPE
    // CONSERVÉ (le Filtre) qui expose ses sous-filtres comme de VRAIS composants éditables. À la même position.
    editor.Commands.add('cz-explode', {
      run(ed) {
        const target = ed.getSelected();
        if (!target) return;
        const html = explodeHtmlFor(target);
        if (!html.trim()) return;
        const parent = target.parent();
        if (!parent) return;
        const at = target.index();
        target.remove();
        const added = parent.append(html, { at });
        const groupComp = Array.isArray(added) ? added[0] : added;
        if (groupComp) ed.select(groupComp);
      },
    });

    // Commande « compact ↔ déplié » : bascule l'état du groupe filtre (classe `--compact` / `--expanded`).
    editor.Commands.add('cz-filter-mode', {
      run(ed) {
        const c = ed.getSelected();
        if (!c) return;
        const compact = (c.getClasses?.() ?? []).includes('cb-filter-group--compact');
        c.removeClass(compact ? 'cb-filter-group--compact' : 'cb-filter-group--expanded');
        c.addClass(compact ? 'cb-filter-group--expanded' : 'cb-filter-group--compact');
      },
    });

    // À la sélection : (a) composant redimensionnable (poignées → règles, cf. avoidInlineStyle) ; (b) icône
    // « ouvrir le groupe » sur les widgets éclatables (Filtre…) ; (c) icône « compact/déplié » sur le groupe filtre.
    editor.on('component:selected', () => {
      const comp = editor.getSelected();
      if (!comp) return;
      if (!comp.get('resizable')) comp.set('resizable', true);
      const tb: ToolbarButtonProps[] = [...((comp.get('toolbar') as ToolbarButtonProps[] | undefined) ?? [])];
      let changed = false;
      if (EXPLODE_BUILDERS[String(comp.get('type'))] && !tb.some((t) => t.command === 'cz-explode')) {
        tb.push({ attributes: { class: 'cz-tlb-explode', title: 'Ouvrir le groupe : éditer les sous-widgets (déplacer, aligner)' }, command: 'cz-explode', label: EXPLODE_ICON_SVG });
        changed = true;
      }
      if (comp.getAttributes()['data-cz-filter'] != null && !tb.some((t) => t.command === 'cz-filter-mode')) {
        tb.push({ attributes: { class: 'cz-tlb-explode', title: 'Basculer le filtre : compact (icône) ↔ déplié (critères en ligne)' }, command: 'cz-filter-mode', label: MODE_ICON_SVG });
        changed = true;
      }
      if (changed) comp.set('toolbar', tb);
    });

    // Édition : charge le markup existant. Composite LEGACY (sans `html`) → on reconstruit son markup
    // depuis kind/widgetIds (migration transparente vers le markup libre à la prochaine sauvegarde).
    const init = initialRef.current;
    const html = init ? (init.html?.trim() ? init.html : buildCompositeInner(init)) : '';
    if (html.trim()) editor.setComponents(html);

    return () => { editor.destroy(); editorRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const draft = (): CompositeDraft => ({
    name: name.trim() || 'Composite',
    html: editorRef.current?.getHtml() ?? '',
    // Règles éditées (par classe) → fusionnées dans le CSS du template global par l'appelant (GrapesStudio).
    css: editorRef.current?.getCss?.() ?? '',
  });
  const insert = () => { onInsert(draft()); onClose(); };
  const save = () => { if (name.trim()) { onSave(draft()); onClose(); } };
  // Bascule ÉDITION (inerte : sélection/déplacement fiables) ↔ INTERAGIR (contenu vivant : ouvrir le filtre, voir
  // le caché, tester). On ne touche PAS à la commande `preview` de GrapesJS (qui rendrait le canvas non cliquable).
  const toggleInteractive = () => {
    const ed = editorRef.current; if (!ed) return;
    setInteractive((on) => { const next = !on; setCanvasInert(ed, !next); return next; });
  };

  return (
    <Box sx={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', flexDirection: 'column', bgcolor: 'var(--bg)' }}>
      {/* En-tête */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.5, borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)', flexShrink: 0 }}>
        <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, color: 'var(--ink)' }}>
          <Boxes size={18} strokeWidth={2} />
          <Box component="span" sx={{ fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)' }}>{initial ? 'Modifier le composite' : 'Constructeur de composite'}</Box>
        </Box>
        <Box sx={{ flex: 1 }} />
        <ButtonBase onClick={toggleInteractive} aria-pressed={interactive}
          title={interactive ? 'Revenir au mode édition (sélection / déplacement des widgets)' : 'Mode interagir : ouvrir le filtre, voir le contenu caché, tester'}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 32, px: 1.5, borderRadius: 'var(--radius-md)', border: '1px solid', borderColor: interactive ? 'var(--accent)' : 'var(--line)', color: interactive ? 'var(--accent)' : 'var(--body)', bgcolor: interactive ? 'var(--accent-soft)' : 'transparent', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', '&:hover': { borderColor: 'var(--accent)', color: interactive ? 'var(--accent)' : 'var(--ink)' } }}>
          <Eye size={14} strokeWidth={2} /> {interactive ? 'Éditer' : 'Interagir'}
        </ButtonBase>
        <ButtonBase onClick={insert}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 32, px: 1.5, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', color: 'var(--body)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' } }}>
          <Plus size={14} strokeWidth={2} /> Insérer sans enregistrer
        </ButtonBase>
        <ButtonBase onClick={save} disabled={!name.trim()}
          sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 34, px: 1.75, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--accent-deep)' }, '&.Mui-disabled': { opacity: 0.45 } }}>
          <Save size={15} strokeWidth={2} /> Enregistrer
        </ButtonBase>
        <ButtonBase onClick={onClose} aria-label="Fermer" sx={{ ml: 0.5, width: 34, height: 34, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>
          <X size={18} strokeWidth={2} />
        </ButtonBase>
      </Box>

      {/* Corps : canvas DnD (gauche) + palette de blocs (droite) */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, bgcolor: 'var(--bg)' }}>
          <Box ref={canvasElRef} sx={{ width: '100%', height: '100%' }} />
        </Box>

        <Box sx={{ flexShrink: 0, width: 300, height: '100%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
          {/* En-tête fixe : nom + onglets Blocs / Style. */}
          <Box sx={{ p: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 1.25, flexShrink: 0 }}>
            <TextField value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du composite" size="small" fullWidth
              sx={{ '& .MuiInputBase-root': { bgcolor: 'var(--field)', color: 'var(--ink)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' }, '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--line)' }, '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent)' } }} />
            <Box sx={{ display: 'flex', gap: 0.5, p: 0.5, bgcolor: 'var(--field)', borderRadius: 'var(--radius-md)' }}>
              {(['blocks', 'style'] as const).map((tab) => (
                <ButtonBase key={tab} onClick={() => setRightTab(tab)}
                  sx={{ flex: 1, height: 30, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', bgcolor: rightTab === tab ? 'var(--card)' : 'transparent', color: rightTab === tab ? 'var(--ink)' : 'var(--muted)', '&:hover': { color: 'var(--ink)' } }}>
                  {tab === 'blocks' ? 'Blocs' : 'Style'}
                </ButtonBase>
              ))}
            </Box>
          </Box>

          {/* Onglet BLOCS : aide + palette de blocs GrapesJS (montée via `appendTo`, toujours montée). */}
          <Box sx={{ display: rightTab === 'blocks' ? 'flex' : 'none', flexDirection: 'column', gap: 1.25, flex: 1, minHeight: 0, px: 2, pb: 2, overflowY: 'auto' }}>
            <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
              Glisse les blocs sur le canvas (ou dans une « Ligne » pour les aligner). L'agencement que tu crées EST le composite.
              Sélectionne le widget « Filtre » puis l'icône <Box component="span" sx={{ color: 'var(--body)', fontWeight: 'var(--fw-medium)' }}>⧉ Ouvrir le groupe</Box> : le filtre est <Box component="span" sx={{ color: 'var(--body)', fontWeight: 'var(--fw-medium)' }}>conservé</Box> et ses sous-filtres deviennent de vrais widgets éditables (déplacer, aligner, styler). L'icône <Box component="span" sx={{ color: 'var(--body)', fontWeight: 'var(--fw-medium)' }}>⮂ compact/déplié</Box> bascule entre filtre compact (icône → menu) et critères en ligne.
            </Box>
            <Box ref={blocksElRef} sx={{ flex: 1, minHeight: 0 }} />
          </Box>

          {/* Onglet STYLE : sélecteurs (classes) + Style Manager. Toujours montés (cibles `appendTo`). */}
          <Box sx={{ display: rightTab === 'style' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
            <Box sx={{ px: 2, pb: 1, fontSize: 'var(--text-2xs)', color: 'var(--muted)', lineHeight: 1.4 }}>
              Sélectionne un élément (groupe, champ…) puis édite layout & style. Les règles s'appliquent <Box component="span" sx={{ color: 'var(--body)', fontWeight: 'var(--fw-medium)' }}>par classe</Box> → elles rejoignent le CSS du template à l'enregistrement.
            </Box>
            <Box ref={selectorElRef} sx={{ flexShrink: 0 }} />
            <Box ref={styleElRef} sx={{ flex: 1, minHeight: 0 }} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
