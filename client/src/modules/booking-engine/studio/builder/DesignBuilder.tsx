import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonBase, Tooltip } from '@mui/material';
import { Check, LayoutTemplate, PanelRightClose, PanelRightOpen, SquarePen, Palette, Code2, FileText, Undo2, Redo2, Rocket } from 'lucide-react';
import BlockTree from './BlockTree';
import BuilderCanvas from './BuilderCanvas';
import PagePreview from './PagePreview';
import WidgetPreview from './WidgetPreview';
import SiteWidgetPreview, { type WidgetPlacement } from './SiteWidgetPreview';
import BlockInspector from './BlockInspector';
import ThemeInspector from './ThemeInspector';
import CssInspector from './CssInspector';
import PageInspector from './PageInspector';
import PagesBar from './PagesBar';
import { BLOCK_REGISTRY, getBlockDef, columnCountOf, type BlockProps, type BlockType } from './blockRegistry';
import type { Breakpoint } from '../StudioShell';
import type { StudioConfigState } from '../useStudioConfig';
import { useSitePages } from '../useSitePages';
import SiteTemplatePicker from '../SiteTemplatePicker';
import type { SiteTemplate } from '../siteTemplates';
import type { BookingEngineConfig } from '../../../../services/api/bookingEngineApi';

/**
 * Builder 3-pane du Baitly Studio (F2 + F2b) : arbre de blocs (gauche) · canvas WYSIWYG (centre) ·
 * pane droit à onglets Bloc / Thème. La page composée (liste de blocs) est PERSISTÉE dans
 * config.pageLayout (JSON) : hydratée au chargement, ré-injectée dans la config à chaque mutation
 * → enregistrée avec le reste de la config (PUT). Le thème édite primaryColor/fontFamily.
 */

export interface BlockInstance {
  id: string;
  type: BlockType;
  props: BlockProps;
  /** Conteneur `columns` : un tableau de blocs par colonne (un niveau d'imbrication). */
  children?: BlockInstance[][];
}

let blockIdSeq = 0;
const nextBlockId = () => `b${++blockIdSeq}`;

function makeBlock(type: BlockType): BlockInstance {
  const block: BlockInstance = { id: nextBlockId(), type, props: { ...getBlockDef(type).defaultProps } };
  if (type === 'columns') block.children = Array.from({ length: columnCountOf(block.props) }, () => []);
  return block;
}

/** Page de démarrage : structure crédible proposée si aucune page n'a encore été composée. */
function makeStarter(): BlockInstance[] {
  return (['hero', 'propertyGrid', 'amenities', 'cta', 'footer'] as BlockType[]).map(makeBlock);
}

/** Sérialise un bloc (récursif pour les colonnes), sans les ids éphémères. */
function serializeBlock(b: BlockInstance): unknown {
  const out: { type: BlockType; props: BlockProps; children?: unknown[][] } = { type: b.type, props: b.props };
  if (b.children) out.children = b.children.map((col) => col.map(serializeBlock));
  return out;
}

/** Sérialise les blocs pour la persistance (type + props + children). */
function serializeLayout(blocks: BlockInstance[]): string {
  return JSON.stringify(blocks.map(serializeBlock));
}

function isBlockLike(b: unknown): b is { type: BlockType; props?: BlockProps; children?: unknown } {
  return !!b && typeof (b as { type?: unknown }).type === 'string' && (b as { type: string }).type in BLOCK_REGISTRY;
}

/** Parse les blocs feuilles d'une colonne (pas de `columns` imbriqué). */
function parseLeaf(arr: unknown): BlockInstance[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(isBlockLike)
    .filter((b) => b.type !== 'columns')
    .map((b) => ({ id: nextBlockId(), type: b.type, props: { ...getBlockDef(b.type).defaultProps, ...(b.props ?? {}) } }));
}

/** Parse un layout persisté. null si absent/invalide ; [] si page sauvegardée vide. */
function parseLayout(json: string | null | undefined): BlockInstance[] | null {
  if (!json) return null;
  try {
    const arr: unknown = JSON.parse(json);
    if (!Array.isArray(arr)) return null;
    return arr.filter(isBlockLike).map((b) => {
      const block: BlockInstance = { id: nextBlockId(), type: b.type, props: { ...getBlockDef(b.type).defaultProps, ...(b.props ?? {}) } };
      if (b.type === 'columns') {
        block.children = Array.isArray(b.children)
          ? (b.children as unknown[]).map(parseLeaf)
          : Array.from({ length: columnCountOf(block.props) }, () => []);
      }
      return block;
    });
  } catch {
    return null;
  }
}

// ─── Helpers d'arbre (mutations tree-aware : top-level + blocs imbriqués dans les colonnes) ───

/** Mappe le bloc d'id `id` (recherche récursive dans les colonnes) via `fn`. */
function mapBlockById(blocks: BlockInstance[], id: string, fn: (b: BlockInstance) => BlockInstance): BlockInstance[] {
  return blocks.map((b) => {
    if (b.id === id) return fn(b);
    if (b.children) return { ...b, children: b.children.map((col) => mapBlockById(col, id, fn)) };
    return b;
  });
}

function findBlockById(blocks: BlockInstance[], id: string | null): BlockInstance | null {
  if (!id) return null;
  for (const b of blocks) {
    if (b.id === id) return b;
    if (b.children) {
      for (const col of b.children) {
        const found = findBlockById(col, id);
        if (found) return found;
      }
    }
  }
  return null;
}

function removeBlockById(blocks: BlockInstance[], id: string): BlockInstance[] {
  return blocks
    .filter((b) => b.id !== id)
    .map((b) => (b.children ? { ...b, children: b.children.map((col) => removeBlockById(col, id)) } : b));
}

/** Déplace un bloc parmi SES frères (liste top-level OU colonne). No-op si en bord. */
function moveBlockById(blocks: BlockInstance[], id: string, dir: -1 | 1): BlockInstance[] {
  const i = blocks.findIndex((b) => b.id === id);
  if (i >= 0) {
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return blocks;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  }
  return blocks.map((b) => (b.children ? { ...b, children: b.children.map((col) => moveBlockById(col, id, dir)) } : b));
}

/** Ajoute `block` à la fin de la colonne `colIndex` du conteneur `parentId`. */
function addToColumn(blocks: BlockInstance[], parentId: string, colIndex: number, block: BlockInstance): BlockInstance[] {
  return mapBlockById(blocks, parentId, (parent) => {
    if (!parent.children) return parent;
    return { ...parent, children: parent.children.map((col, ci) => (ci === colIndex ? [...col, block] : col)) };
  });
}

/** Redimensionne le tableau de colonnes à `n` ; le contenu des colonnes en trop bascule dans la dernière. */
function resizeColumns(children: BlockInstance[][] | undefined, n: number): BlockInstance[][] {
  const cur = children ?? [];
  if (n >= cur.length) return Array.from({ length: n }, (_, i) => cur[i] ?? []);
  const kept = cur.slice(0, n).map((col) => [...col]);
  const overflow = cur.slice(n).flat();
  kept[n - 1] = [...kept[n - 1], ...overflow];
  return kept;
}

/**
 * Cible de glisser-déposer (2.7), exprimée par `beforeId` (insère AVANT ce bloc ; `null` = en fin de
 * liste) → robuste aux décalages d'index causés par le retrait préalable du bloc déplacé.
 */
export type DropTarget =
  | { kind: 'root'; beforeId: string | null }
  | { kind: 'col'; parentId: string; colIndex: number; beforeId: string | null };

/** Retire le bloc d'id `id` (et son sous-arbre) ; renvoie le bloc retiré + l'arbre sans lui. */
function extractBlockById(blocks: BlockInstance[], id: string): { block: BlockInstance | null; rest: BlockInstance[] } {
  let found: BlockInstance | null = null;
  const walk = (list: BlockInstance[]): BlockInstance[] => {
    const out: BlockInstance[] = [];
    for (const b of list) {
      if (b.id === id) { found = b; continue; }
      out.push(b.children ? { ...b, children: b.children.map(walk) } : b);
    }
    return out;
  };
  const rest = walk(blocks);
  return { block: found, rest };
}

/** Insère `block` dans `list` avant `beforeId` (ou en fin si `null`/introuvable). */
function insertInList(list: BlockInstance[], block: BlockInstance, beforeId: string | null): BlockInstance[] {
  const i = beforeId === null ? -1 : list.findIndex((b) => b.id === beforeId);
  if (i < 0) return [...list, block];
  const next = [...list];
  next.splice(i, 0, block);
  return next;
}

function insertAtTarget(blocks: BlockInstance[], block: BlockInstance, target: DropTarget): BlockInstance[] {
  if (target.kind === 'root') return insertInList(blocks, block, target.beforeId);
  return mapBlockById(blocks, target.parentId, (parent) => {
    if (!parent.children) return parent;
    return { ...parent, children: parent.children.map((col, ci) => (ci === target.colIndex ? insertInList(col, block, target.beforeId) : col)) };
  });
}

type RightTab = 'block' | 'page' | 'theme' | 'css';

/** Onglets du pane droit (icônes utilisées en mode replié). « Page » n'apparaît qu'en multi-page. */
const ALL_RIGHT_TABS: { value: RightTab; label: string; icon: typeof SquarePen }[] = [
  { value: 'block', label: 'Bloc', icon: SquarePen },
  { value: 'page', label: 'Page', icon: FileText },
  { value: 'theme', label: 'Thème', icon: Palette },
  { value: 'css', label: 'CSS', icon: Code2 },
];

const paneIconBtnSx = {
  width: 36, height: 32, borderRadius: 'var(--radius-md)', cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)',
  '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' },
  '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
} as const;

export interface DesignBuilderProps {
  breakpoint: Breakpoint;
  cfg: StudioConfigState;
}

export default function DesignBuilder({ breakpoint, cfg }: DesignBuilderProps) {
  const [blocks, setBlocks] = useState<BlockInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('block');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [previewView, setPreviewView] = useState<'page' | 'widget' | 'site'>('page');
  const [widgetPlacement, setWidgetPlacement] = useState<WidgetPlacement>('bottom');
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pageDirty, setPageDirty] = useState(false);
  const [pageSaving, setPageSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Historique undo/redo (2.7) : piles d'états de blocs. Réinitialisées au changement de page.
  const [past, setPast] = useState<BlockInstance[][]>([]);
  const [future, setFuture] = useState<BlockInstance[][]>([]);

  const { patch } = cfg;
  const pages = useSitePages(cfg.config?.id ?? undefined);
  const pageMode = pages.ready && pages.selectedPage != null;
  const isHomeActive = pages.selectedPage?.type === 'HOME';
  const rightTabs = ALL_RIGHT_TABS.filter((t) => t.value !== 'page' || pageMode);

  // Hydratation des blocs depuis la page active (re-déclenchée à chaque changement de page). Un ref
  // garde l'id déjà hydraté pour NE PAS ré-hydrater quand la config change (chaque frappe = nouvel
  // objet config) ni après une sauvegarde (l'identité de la page change mais pas son id).
  const lastHydratedRef = useRef<number | 'legacy' | null>(null);
  useEffect(() => {
    if (cfg.loading) return;
    const sitesPending = cfg.config != null && !pages.ready && pages.error == null;
    if (sitesPending) return; // attendre la résolution des pages
    const key: number | 'legacy' = pageMode && pages.selectedPage ? pages.selectedPage.id : 'legacy';
    if (lastHydratedRef.current === key) return;
    lastHydratedRef.current = key;
    const initial = pageMode && pages.selectedPage
      ? parseLayout(pages.selectedPage.blocks) ?? (pages.selectedPage.type === 'HOME' ? makeStarter() : [])
      : parseLayout(cfg.config?.pageLayout) ?? makeStarter();
    setBlocks(initial);
    setSelectedId(initial[0]?.id ?? null);
    setPageDirty(false);
    setPast([]);
    setFuture([]);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pages.ready, pages.error, pages.selectedPageId, cfg.loading]);

  // Repli intelligent par breakpoint : en desktop le canvas a besoin de toute la largeur → on
  // replie les deux colonnes ; en tablette/mobile le canvas est étroit → on les rouvre. (L'utilisateur
  // peut toujours surcharger manuellement avec les boutons de repli.)
  useEffect(() => {
    const collapse = breakpoint === 'desktop';
    setLeftCollapsed(collapse);
    setRightCollapsed(collapse);
  }, [breakpoint]);

  // Applique l'édition à la page active. Multi-page : marque la page « dirty » (persistée par page) ;
  // la page d'accueil est aussi reflétée dans config.pageLayout pour garder la page publique React
  // (SPA) en phase. Mode mono-page (repli si API sites indisponible) : tout va dans config.pageLayout.
  // Effets de persistance d'une nouvelle liste de blocs (sans toucher l'historique).
  const persist = useCallback((next: BlockInstance[]) => {
    setBlocks(next);
    if (pageMode) {
      // Draft/Live (2.7) : l'édition n'écrit que le brouillon (SitePage.blocks) ; la page publique
      // (SPA via config.pageLayout pour l'accueil + SSR via published_blocks) n'est mise à jour qu'à
      // la PUBLICATION (cf. handlePublish). En mono-page (pas de site), pas de draft/live : direct.
      setPageDirty(true);
    } else {
      patch({ pageLayout: serializeLayout(next) });
    }
  }, [patch, pageMode]);

  // Mutation utilisateur : empile l'état courant (undo), purge le redo, puis applique.
  const commit = useCallback((next: BlockInstance[]) => {
    setPast((p) => [...p, blocks]);
    setFuture([]);
    persist(next);
  }, [blocks, persist]);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const prev = past[past.length - 1];
    setPast(past.slice(0, -1));
    setFuture((f) => [blocks, ...f]);
    persist(prev);
    setSelectedId((cur) => (findBlockById(prev, cur) ? cur : prev[0]?.id ?? null));
  }, [past, blocks, persist]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture(future.slice(1));
    setPast((p) => [...p, blocks]);
    persist(next);
    setSelectedId((cur) => (findBlockById(next, cur) ? cur : next[0]?.id ?? null));
  }, [future, blocks, persist]);

  // Sauvegarde unifiée : page active (multi-page) + config (thème/CSS, et miroir pageLayout home).
  const dirty = cfg.dirty || (pageMode && pageDirty);
  const saving = cfg.saving || pageSaving;

  const handleSave = useCallback(async () => {
    try {
      if (pageMode && pageDirty && pages.selectedPageId != null) {
        setPageSaving(true);
        await pages.savePageBlocks(pages.selectedPageId, serializeLayout(blocks));
        setPageDirty(false);
      }
      if (cfg.dirty) await cfg.save();
    } catch {
      /* erreurs exposées par les hooks */
    } finally {
      setPageSaving(false);
    }
  }, [pageMode, pageDirty, pages, blocks, cfg]);

  // Publication (2.7) : enregistre le brouillon courant, fige l'instantané publié (servi au public),
  // et pour l'accueil reflète la version publiée dans config.pageLayout (page publique SPA). Tant
  // qu'on ne publie pas, la version en ligne reste intacte.
  const handlePublish = useCallback(async () => {
    if (!pageMode || pages.selectedPageId == null) return;
    setPublishing(true);
    try {
      if (pageDirty) {
        await pages.savePageBlocks(pages.selectedPageId, serializeLayout(blocks));
        setPageDirty(false);
      }
      await pages.publishPage(pages.selectedPageId);
      if (isHomeActive) {
        patch({ pageLayout: serializeLayout(blocks) });
        await cfg.save();
      }
    } catch {
      /* erreurs exposées par les hooks */
    } finally {
      setPublishing(false);
    }
  }, [pageMode, pages, pageDirty, blocks, isHomeActive, patch, cfg]);

  // Modifications non publiées : brouillon serveur divergent (dirty) OU édition locale non enregistrée.
  const needsPublish = pageMode && ((pages.selectedPage?.dirty ?? false) || pageDirty);

  // Bascule de page : enregistre la page courante si modifiée (évite la perte), puis change.
  const handleSelectPage = useCallback(async (id: number) => {
    if (id === pages.selectedPageId) return;
    if (pageMode && pageDirty && pages.selectedPageId != null) {
      setPageSaving(true);
      try {
        await pages.savePageBlocks(pages.selectedPageId, serializeLayout(blocks));
        setPageDirty(false);
      } catch {
        setPageSaving(false);
        return; // on reste sur la page courante si l'enregistrement échoue
      }
      setPageSaving(false);
    }
    pages.selectPage(id);
  }, [pageMode, pageDirty, pages, blocks]);

  // Ajout de page : enregistre la page courante au préalable (l'ajout sélectionne la nouvelle page).
  const handleAddPage = useCallback(async () => {
    if (pageMode && pageDirty && pages.selectedPageId != null) {
      try {
        await pages.savePageBlocks(pages.selectedPageId, serializeLayout(blocks));
        setPageDirty(false);
      } catch {
        return;
      }
    }
    await pages.addPage();
  }, [pageMode, pageDirty, pages, blocks]);

  const selected = useMemo(() => findBlockById(blocks, selectedId), [blocks, selectedId]);

  const onSelectBlock = (id: string) => { setSelectedId(id); setRightTab('block'); };

  const handleAdd = (type: BlockType) => {
    const block = makeBlock(type);
    commit([...blocks, block]);
    setSelectedId(block.id);
    setRightTab('block');
  };

  /** Ajoute un bloc DANS une colonne d'un conteneur (2.7). */
  const handleAddToColumn = (parentId: string, colIndex: number, type: BlockType) => {
    const block = makeBlock(type);
    commit(addToColumn(blocks, parentId, colIndex, block));
    setSelectedId(block.id);
    setRightTab('block');
  };

  // Déplacement ↑/↓ parmi les frères (top-level ou colonne).
  const handleMove = (id: string, dir: -1 | 1) => {
    commit(moveBlockById(blocks, id, dir));
  };

  // Glisser-déposer (2.7) : déplace un bloc (top-level OU imbriqué) vers une cible (racine ou colonne).
  const handleMoveBlock = (dragId: string, target: DropTarget) => {
    if (target.beforeId === dragId) return; // dépôt juste avant soi-même = no-op
    // Pas de conteneur DANS une colonne (pas d'imbrication de colonnes).
    if (target.kind === 'col' && findBlockById(blocks, dragId)?.type === 'columns') return;
    const { block, rest } = extractBlockById(blocks, dragId);
    if (!block) return;
    commit(insertAtTarget(rest, block, target));
    setSelectedId(block.id);
  };

  const handleRemove = (id: string) => {
    commit(removeBlockById(blocks, id));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const handleChange = (id: string, key: string, value: string | number | boolean) => {
    commit(mapBlockById(blocks, id, (b) => {
      const props = { ...b.props, [key]: value };
      // Conteneur : changer le nombre de colonnes redimensionne le tableau de colonnes.
      if (b.type === 'columns' && key === 'columnCount') {
        return { ...b, props, children: resizeColumns(b.children, columnCountOf(props)) };
      }
      return { ...b, props };
    }));
  };

  // Applique un template (thème + composition) ; null = page vierge (custom). Remplace la page courante.
  const applyTemplate = (tpl: SiteTemplate | null) => {
    setTemplatesOpen(false);
    const next: BlockInstance[] = tpl
      ? tpl.blocks.map((b) => ({ id: makeBlock(b.type).id, type: b.type, props: { ...getBlockDef(b.type).defaultProps, ...b.props } }))
      : [];
    commit(next);
    setSelectedId(next[0]?.id ?? null);
    setRightTab('block');
    setMode('edit');
    if (tpl) {
      const changes: Partial<BookingEngineConfig> = {
        primaryColor: tpl.preset.primaryColor,
        fontFamily: tpl.preset.fontFamily,
        designTokens: JSON.stringify(tpl.preset.tokens),
      };
      patch(changes);
    }
  };

  if (!hydrated) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 'var(--text-md)' }}>
        Chargement de l’éditeur…
      </Box>
    );
  }

  const theme = cfg.config
    ? {
        primaryColor: cfg.config.primaryColor,
        fontFamily: cfg.config.fontFamily,
        tokens: (() => { try { return cfg.config.designTokens ? JSON.parse(cfg.config.designTokens) : null; } catch { return null; } })(),
      }
    : undefined;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Barre : modèles (gauche) + bascule Éditer / Aperçu (droite). */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, height: 42, flexShrink: 0, borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
        {mode === 'preview' ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Segmented
              value={previewView}
              onChange={setPreviewView}
              options={[{ value: 'page', label: 'Page' }, { value: 'widget', label: 'Réservation' }, { value: 'site', label: 'Site' }]}
            />
            {previewView === 'site' && (
              <Segmented
                value={widgetPlacement}
                onChange={setWidgetPlacement}
                options={[{ value: 'bottom', label: 'Bas' }, { value: 'floating', label: 'Flottant' }, { value: 'top', label: 'Haut' }]}
              />
            )}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Tooltip title="Annuler">
              <ButtonBase onClick={undo} disabled={past.length === 0} aria-label="Annuler" sx={paneIconBtnSx}>
                <Undo2 size={16} strokeWidth={2} />
              </ButtonBase>
            </Tooltip>
            <Tooltip title="Rétablir">
              <ButtonBase onClick={redo} disabled={future.length === 0} aria-label="Rétablir" sx={paneIconBtnSx}>
                <Redo2 size={16} strokeWidth={2} />
              </ButtonBase>
            </Tooltip>
            <ButtonBase
              onClick={() => setTemplatesOpen(true)}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 30, px: 1.5,
                borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--card)', color: 'var(--body)',
                fontWeight: 'var(--fw-medium)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                transition: 'border-color var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
                '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            >
              <LayoutTemplate size={15} strokeWidth={2} /> Modèles
            </ButtonBase>
          </Box>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {pageMode && mode === 'edit' && (
            <>
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
                      display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 30, px: 1.5,
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
            </>
          )}
          <Segmented
            value={mode}
            onChange={setMode}
            options={[{ value: 'edit', label: 'Éditer' }, { value: 'preview', label: 'Aperçu' }]}
          />
        </Box>
      </Box>

      {mode === 'edit' && pageMode && (
        <PagesBar
          pages={pages.pages}
          selectedId={pages.selectedPageId}
          onSelect={handleSelectPage}
          onAdd={handleAddPage}
          onRename={pages.renamePage}
          onDelete={pages.deletePage}
          onMove={pages.movePage}
          busy={pageSaving}
        />
      )}

      {mode === 'preview' ? (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {previewView === 'page' ? (
            <PagePreview blocks={blocks} theme={theme} breakpoint={breakpoint} />
          ) : previewView === 'widget' ? (
            <WidgetPreview config={cfg.config} breakpoint={breakpoint} />
          ) : (
            <SiteWidgetPreview config={cfg.config} breakpoint={breakpoint} placement={widgetPlacement} />
          )}
        </Box>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <BlockTree
            blocks={blocks}
            selectedId={selectedId}
            onSelect={onSelectBlock}
            onAdd={handleAdd}
            onAddToColumn={handleAddToColumn}
            onMove={handleMove}
            onMoveBlock={handleMoveBlock}
            onRemove={handleRemove}
            collapsed={leftCollapsed}
            onToggleCollapse={() => setLeftCollapsed((v) => !v)}
          />

          <BuilderCanvas
            blocks={blocks}
            selectedId={selectedId}
            breakpoint={breakpoint}
            onSelect={onSelectBlock}
            theme={theme}
          />

          {rightCollapsed ? (
            /* Pane droit replié : bande d'icônes (déplier + onglets). */
            <Box sx={{ width: 52, flexShrink: 0, borderLeft: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 1 }}>
              <Tooltip title="Déplier" placement="left">
                <ButtonBase onClick={() => setRightCollapsed(false)} aria-label="Déplier le panneau" sx={paneIconBtnSx}>
                  <PanelRightOpen size={16} strokeWidth={2} />
                </ButtonBase>
              </Tooltip>
              {rightTabs.map((t) => {
                const Icon = t.icon;
                const active = rightTab === t.value;
                return (
                  <Tooltip key={t.value} title={t.label} placement="left">
                    <ButtonBase
                      onClick={() => { setRightTab(t.value); setRightCollapsed(false); }}
                      aria-label={t.label}
                      sx={{ ...paneIconBtnSx, color: active ? 'var(--accent)' : 'var(--muted)', bgcolor: active ? 'var(--accent-soft)' : 'transparent' }}
                    >
                      <Icon size={17} strokeWidth={2} />
                    </ButtonBase>
                  </Tooltip>
                );
              })}
            </Box>
          ) : (
          /* Pane droit : onglets Bloc / Thème / CSS + corps + barre de sauvegarde. */
          <Box sx={{ width: 296, flexShrink: 0, borderLeft: '1px solid var(--line)', bgcolor: 'var(--card)', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5, px: 1, height: 48, borderBottom: '1px solid var(--line)' }}>
          <Segmented
            value={rightTab}
            onChange={setRightTab}
            options={rightTabs.map((t) => ({ value: t.value, label: t.label }))}
          />
          <Tooltip title="Replier" placement="left">
            <ButtonBase onClick={() => setRightCollapsed(true)} aria-label="Replier le panneau" sx={paneIconBtnSx}>
              <PanelRightClose size={16} strokeWidth={2} />
            </ButtonBase>
          </Tooltip>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {rightTab === 'page' && pageMode && pages.selectedPage ? (
            <PageInspector page={pages.selectedPage} onSave={(c) => pages.updatePageMeta(pages.selectedPage!.id, c)} />
          ) : rightTab === 'theme' ? (
            <ThemeInspector config={cfg.config} patch={cfg.patch} />
          ) : rightTab === 'css' ? (
            <CssInspector config={cfg.config} patch={cfg.patch} blockTypes={blocks.map((b) => b.type)} />
          ) : (
            <BlockInspector block={selected} onChange={handleChange} />
          )}
        </Box>

        {dirty && (
          <Box sx={{ flexShrink: 0, borderTop: '1px solid var(--line)', p: 1.25, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, fontSize: 'var(--text-2xs)', color: cfg.error ? 'var(--err)' : 'var(--muted)' }}>
              {cfg.error ?? 'Modifications non enregistrées'}
            </Box>
            <ButtonBase
              onClick={() => { handleSave(); }}
              disabled={saving}
              sx={{
                display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 32, px: 1.5,
                borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)',
                fontWeight: 'var(--fw-semibold)', fontSize: 'var(--text-sm)', cursor: 'pointer',
                '&:hover': { bgcolor: 'var(--accent-deep)' },
                '&.Mui-disabled': { opacity: 0.5 },
                '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
              }}
            >
              {!saving && <Check size={14} strokeWidth={2.4} />}
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </ButtonBase>
          </Box>
        )}
          </Box>
          )}
        </Box>
      )}

      <SiteTemplatePicker open={templatesOpen} onClose={() => setTemplatesOpen(false)} onSelect={applyTemplate} />
    </Box>
  );
}

function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <Box sx={{ display: 'inline-flex', p: 0.25, gap: 0.25, bgcolor: 'var(--field)', borderRadius: 'var(--radius-md)' }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <ButtonBase
            key={o.value}
            onClick={() => onChange(o.value)}
            sx={{
              height: 28, px: 1.75, borderRadius: 'var(--radius-sm)', fontSize: 'var(--text-sm)', cursor: 'pointer',
              fontWeight: active ? 'var(--fw-semibold)' : 'var(--fw-medium)',
              color: active ? 'var(--ink)' : 'var(--muted)',
              bgcolor: active ? 'var(--card)' : 'transparent',
              boxShadow: active ? 'var(--shadow-card)' : 'none',
              transition: 'color var(--duration-fast) var(--ease-out)',
              '&:hover': { color: 'var(--ink)' },
              '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 2 },
            }}
          >
            {o.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
