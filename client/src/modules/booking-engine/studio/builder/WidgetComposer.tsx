import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Box, ButtonBase, Switch, Tooltip } from '@mui/material';
import { Plus, Trash2, ChevronUp, ChevronDown, FolderInput, GripVertical } from 'lucide-react';
import {
  WIDGET_CATEGORIES, getWidgetDef, isWidgetType, renderRawWidget,
  type WidgetType, type WidgetProps,
} from './widgetRegistry';
import { themeStyle, type CanvasTheme } from './BuilderCanvas';
import type { StudioConfigState } from '../useStudioConfig';

/**
 * Composeur de la barre de réservation (Phase 1) : on ASSEMBLE des micro-widgets — seuls ou glissés
 * dans un conteneur `group` (« composant vide adaptable ») — au lieu d'un gros composant figé.
 * Persisté dans `config.componentConfig` (clé `widgetLayout`). Aperçu via le `render` du registre ;
 * rendu RÉEL sur le site = Phase 2 (BaitlyWidget).
 *
 * DnD natif (même pattern que BlockTree) : glisser depuis la palette → déposer sur le canvas ou DANS
 * un conteneur ; glisser un widget existant dans/hors d'un conteneur. ↑/↓ = réordonnancement fin.
 */

let seq = 0;
const nextId = () => `w${++seq}`;

export interface WidgetInstance {
  id: string;
  type: WidgetType;
  props: WidgetProps;
  children?: WidgetInstance[];
}

/** Zone de dépôt : racine (top-level) ou l'id d'un conteneur `group`. */
type DropZone = 'root' | string;
/** Charge glissée : nouveau widget (palette) ou déplacement d'un widget existant. */
type DragPayload = { kind: 'new'; type: WidgetType } | { kind: 'move'; id: string } | null;

function makeWidget(type: WidgetType): WidgetInstance {
  const w: WidgetInstance = { id: nextId(), type, props: { ...getWidgetDef(type).defaultProps } };
  if (type === 'group') w.children = [];
  return w;
}

function serialize(items: WidgetInstance[]): string {
  const strip = (w: WidgetInstance): unknown => ({
    type: w.type, props: w.props, ...(w.children ? { children: w.children.map(strip) } : {}),
  });
  return JSON.stringify({ widgetLayout: items.map(strip) });
}

function parseLayout(componentConfig: string | null | undefined): WidgetInstance[] {
  if (!componentConfig) return [];
  try {
    const obj = JSON.parse(componentConfig);
    const arr = obj?.widgetLayout;
    if (!Array.isArray(arr)) return [];
    const build = (raw: unknown, allowChildren: boolean): WidgetInstance | null => {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as { type?: unknown; props?: unknown; children?: unknown };
      if (!isWidgetType(r.type)) return null;
      const w: WidgetInstance = { id: nextId(), type: r.type, props: { ...getWidgetDef(r.type).defaultProps, ...(r.props as WidgetProps ?? {}) } };
      if (r.type === 'group' && allowChildren) {
        w.children = Array.isArray(r.children) ? r.children.map((c) => build(c, false)).filter((x): x is WidgetInstance => !!x && x.type !== 'group') : [];
      }
      return w;
    };
    return arr.map((r) => build(r, true)).filter((x): x is WidgetInstance => !!x);
  } catch {
    return [];
  }
}

/** Fusionne `patch` dans le JSON `componentConfig` (préserve les autres clés : widgetLayout, styleMode…). */
function patchComponentConfig(componentConfig: string | null | undefined, patch: Record<string, unknown>): string {
  let base: Record<string, unknown> = {};
  if (componentConfig) {
    try { const o = JSON.parse(componentConfig); if (o && typeof o === 'object') base = o as Record<string, unknown>; } catch { /* repart de zéro */ }
  }
  return JSON.stringify({ ...base, ...patch });
}

/** Mode de style du widget composé : `template` (design appliqué) ou `none` (headless). */
type StyleMode = 'template' | 'none';
function parseStyleMode(componentConfig: string | null | undefined): StyleMode {
  if (!componentConfig) return 'template';
  try { return (JSON.parse(componentConfig) as { styleMode?: unknown }).styleMode === 'none' ? 'none' : 'template'; } catch { return 'template'; }
}

/** Retire le widget `id` partout (racine + groupes) ; renvoie le widget retiré + le reste. */
function extract(items: WidgetInstance[], id: string): { pulled: WidgetInstance | null; rest: WidgetInstance[] } {
  let pulled: WidgetInstance | null = null;
  const rest: WidgetInstance[] = [];
  for (const w of items) {
    if (w.id === id) { pulled = w; continue; }
    if (w.children?.some((c) => c.id === id)) {
      pulled = w.children.find((c) => c.id === id) ?? null;
      rest.push({ ...w, children: w.children.filter((c) => c.id !== id) });
    } else {
      rest.push(w);
    }
  }
  return { pulled, rest };
}

export interface WidgetComposerProps {
  cfg: StudioConfigState;
  theme?: CanvasTheme;
}

export default function WidgetComposer({ cfg, theme }: WidgetComposerProps) {
  const { patch } = cfg;
  const [items, setItems] = useState<WidgetInstance[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragPayload>(null);
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const [styleMode, setStyleMode] = useState<StyleMode>('template');
  const hydratedRef = useRef<number | null>(null);

  useEffect(() => {
    const id = cfg.config?.id ?? null;
    if (id == null || hydratedRef.current === id) return;
    hydratedRef.current = id;
    setItems(parseLayout(cfg.config?.componentConfig));
    setStyleMode(parseStyleMode(cfg.config?.componentConfig));
  }, [cfg.config?.id, cfg.config?.componentConfig]);

  const commit = useCallback((next: WidgetInstance[]) => {
    setItems(next);
    patch({ componentConfig: patchComponentConfig(cfg.config?.componentConfig, { widgetLayout: JSON.parse(serialize(next)).widgetLayout }) });
  }, [patch, cfg.config?.componentConfig]);

  const changeStyleMode = useCallback((mode: StyleMode) => {
    setStyleMode(mode);
    patch({ componentConfig: patchComponentConfig(cfg.config?.componentConfig, { styleMode: mode }) });
  }, [patch, cfg.config?.componentConfig]);

  const selected = useMemo(() => {
    const find = (list: WidgetInstance[]): WidgetInstance | null => {
      for (const w of list) {
        if (w.id === selectedId) return w;
        if (w.children) { const f = find(w.children); if (f) return f; }
      }
      return null;
    };
    return selectedId ? find(items) : null;
  }, [items, selectedId]);

  /** Insère un widget dans une zone (racine ou groupe). Les `group` vont toujours à la racine. */
  const insertInto = (list: WidgetInstance[], w: WidgetInstance, zone: DropZone): WidgetInstance[] => {
    if (zone === 'root' || w.type === 'group') return [...list, w];
    return list.map((it) => it.id === zone && it.type === 'group' ? { ...it, children: [...(it.children ?? []), w] } : it);
  };

  const addTo = (type: WidgetType, zone: DropZone) => {
    const w = makeWidget(type);
    commit(insertInto(items, w, zone));
    setSelectedId(w.id);
  };

  const moveTo = (id: string, zone: DropZone) => {
    const { pulled, rest } = extract(items, id);
    if (!pulled) return;
    commit(insertInto(rest, pulled, zone));
    setSelectedId(id);
  };

  const addWidget = (type: WidgetType) => {
    // Clic palette : dans le groupe sélectionné si pertinent, sinon racine.
    const targetGroup = selected?.type === 'group' ? selected.id
      : (selected && items.find((it) => it.children?.some((c) => c.id === selected.id))?.id) || 'root';
    addTo(type, type === 'group' ? 'root' : targetGroup);
  };

  const removeWidget = (id: string) => {
    commit(items.filter((w) => w.id !== id).map((w) => w.children ? { ...w, children: w.children.filter((c) => c.id !== id) } : w));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const move = (id: string, dir: -1 | 1) => {
    const reorder = (list: WidgetInstance[]): WidgetInstance[] => {
      const i = list.findIndex((w) => w.id === id);
      if (i < 0) return list.map((w) => w.children ? { ...w, children: reorder(w.children) } : w);
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    };
    commit(reorder(items));
  };

  const ungroup = (id: string) => moveTo(id, 'root');

  const setProp = (id: string, key: string, value: string | number | boolean) => {
    const apply = (list: WidgetInstance[]): WidgetInstance[] => list.map((w) =>
      w.id === id ? { ...w, props: { ...w.props, [key]: value } } : (w.children ? { ...w, children: apply(w.children) } : w));
    commit(apply(items));
  };

  const inGroup = (id: string) => items.some((w) => w.children?.some((c) => c.id === id));

  // ── DnD ────────────────────────────────────────────────────────────────
  const clearDrag = () => { setDrag(null); setDropZone(null); };
  const handleDrop = (zone: DropZone) => {
    if (!drag) return;
    if (drag.kind === 'new') addTo(drag.type, zone);
    else moveTo(drag.id, zone);
    clearDrag();
  };
  const zoneDragOver = (e: React.DragEvent, zone: DropZone) => {
    if (!drag) return;
    e.preventDefault();
    if (zone !== 'root') e.stopPropagation();
    setDropZone(zone);
  };

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
      {/* Palette */}
      <Box sx={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--line)', overflowY: 'auto', p: 1.5, bgcolor: 'var(--card)' }}>
        <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.04em', mb: 0.5 }}>Micro-widgets</Box>
        <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', mb: 1.5 }}>Glisse sur le canvas ou dans un conteneur (ou clique pour ajouter).</Box>
        {WIDGET_CATEGORIES.map((cat) => (
          <Box key={cat.category} sx={{ mb: 1.25 }}>
            <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.04em', mb: 0.5, px: 0.25 }}>{cat.label}</Box>
            {cat.types.map((t) => {
              const def = getWidgetDef(t);
              const Icon = def.icon;
              return (
                <ButtonBase
                  key={t}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', t); setDrag({ kind: 'new', type: t }); }}
                  onDragEnd={clearDrag}
                  onClick={() => addWidget(t)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1, width: '100%', textAlign: 'left',
                    px: 1.25, py: 0.85, mb: 0.4, borderRadius: 'var(--radius-md)', color: 'var(--ink)', cursor: 'grab',
                    '&:hover': { bgcolor: 'var(--hover)' }, '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: 1 },
                  }}
                >
                  <Box sx={{ display: 'inline-flex', color: def.isContainer ? 'var(--accent)' : 'var(--muted)' }}><Icon size={16} strokeWidth={2} /></Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>{def.label}</Box>
                    <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)', lineHeight: 1.3 }}>{def.description}</Box>
                  </Box>
                  <Plus size={14} strokeWidth={2} style={{ marginLeft: 'auto', color: 'var(--muted)', flexShrink: 0 }} />
                </ButtonBase>
              );
            })}
          </Box>
        ))}
      </Box>

      {/* Colonne centrale : barre d'outils (toggle de style) + canvas */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      {/* Barre d'outils : toggle « design du template » ↔ « aucun CSS (headless) ». */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 2, height: 46, flexShrink: 0, borderBottom: '1px solid var(--line)', bgcolor: 'var(--card)' }}>
        <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>Design du template</Box>
        <Switch
          size="small"
          checked={styleMode === 'template'}
          onChange={(e) => changeStyleMode(e.target.checked ? 'template' : 'none')}
          inputProps={{ 'aria-label': 'Appliquer le design du template' }}
        />
        <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--faint)' }}>
          {styleMode === 'template'
            ? 'Le widget hérite du thème + CSS de la page.'
            : 'Aucun CSS (headless) — le widget rend du HTML brut, à styler soi-même.'}
        </Box>
      </Box>
      {/* Canvas (zone de dépôt racine) */}
      <Box
        style={themeStyle(theme)}
        onDragOver={(e) => zoneDragOver(e, 'root')}
        onDrop={(e) => { e.preventDefault(); handleDrop('root'); }}
        sx={{
          flex: 1, minWidth: 0, overflowY: 'auto', bgcolor: 'var(--bg-2, var(--bg))', p: 3,
          outline: dropZone === 'root' && drag ? '2px dashed var(--accent)' : '2px dashed transparent', outlineOffset: -8,
        }}
      >
        {items.length === 0 ? (
          <Box sx={{ minHeight: 240, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: 'var(--muted)', gap: 1 }}>
            <Box sx={{ fontSize: 'var(--text-md)' }}>Barre de réservation vide</Box>
            <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--faint)', maxWidth: 360 }}>
              Glisse des micro-widgets ici. Dépose un <b>Conteneur</b> puis glisse-y plusieurs widgets pour composer une barre de recherche.
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-start' }}>
            {items.map((w) => (
              <WidgetNode key={w.id} w={w} selectedId={selectedId} dropZone={dropZone} dragging={!!drag} raw={styleMode === 'none'}
                onSelect={setSelectedId} onMove={move} onRemove={removeWidget} onUngroup={ungroup}
                onNodeDragStart={(id) => setDrag({ kind: 'move', id })} onDragEnd={clearDrag}
                onZoneDragOver={zoneDragOver} onZoneDrop={handleDrop} inGroup={false} />
            ))}
          </Box>
        )}
      </Box>
      </Box>

      {/* Inspecteur */}
      <Box sx={{ width: 256, flexShrink: 0, borderLeft: '1px solid var(--line)', overflowY: 'auto', p: 1.75, bgcolor: 'var(--card)' }}>
        {selected ? (
          <>
            <Box sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', mb: 0.5 }}>{getWidgetDef(selected.type).label}</Box>
            <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', mb: 1.5 }}>{getWidgetDef(selected.type).description}</Box>
            {selected.type === 'group' ? (
              <>
                <SelectRow label="Sens" value={String(selected.props.direction ?? 'row')}
                  options={[['row', 'Ligne'], ['column', 'Colonne']]} onChange={(v) => setProp(selected.id, 'direction', v)} />
                <SelectRow label="Espacement" value={String(selected.props.gap ?? 'md')}
                  options={[['sm', 'Petit'], ['md', 'Moyen'], ['lg', 'Grand']]} onChange={(v) => setProp(selected.id, 'gap', v)} />
              </>
            ) : (
              Object.keys(selected.props).filter((k) => typeof selected.props[k] === 'string').map((k) => (
                <TextRow key={k} label={k} value={String(selected.props[k] ?? '')} onChange={(v) => setProp(selected.id, k, v)} />
              ))
            )}
            {selected.type !== 'group' && inGroup(selected.id) ? (
              <ButtonBase onClick={() => ungroup(selected.id)} sx={{ mt: 1.5, display: 'inline-flex', alignItems: 'center', gap: 0.75, fontSize: 'var(--text-sm)', color: 'var(--body)', cursor: 'pointer', '&:hover': { color: 'var(--ink)' } }}>
                <FolderInput size={14} strokeWidth={2} /> Sortir du conteneur
              </ButtonBase>
            ) : null}
          </>
        ) : (
          <Box sx={{ fontSize: 'var(--text-sm)', color: 'var(--muted)' }}>Sélectionne un widget pour l'éditer.</Box>
        )}
      </Box>
    </Box>
  );
}

function WidgetNode({ w, selectedId, dropZone, dragging, raw, onSelect, onMove, onRemove, onUngroup, onNodeDragStart, onDragEnd, onZoneDragOver, onZoneDrop, inGroup }: {
  w: WidgetInstance; selectedId: string | null; dropZone: DropZone | null; dragging: boolean; raw: boolean;
  onSelect: (id: string) => void; onMove: (id: string, dir: -1 | 1) => void; onRemove: (id: string) => void; onUngroup: (id: string) => void;
  onNodeDragStart: (id: string) => void; onDragEnd: () => void;
  onZoneDragOver: (e: React.DragEvent, zone: DropZone) => void; onZoneDrop: (zone: DropZone) => void; inGroup: boolean;
}) {
  const def = getWidgetDef(w.type);
  const active = w.id === selectedId;
  const isGroup = w.type === 'group';
  const isGroupDrop = isGroup && dropZone === w.id && dragging;
  // En headless, la chrome d'édition (sélection / survol / bordure du conteneur) reste VISIBLE mais
  // NEUTRE — pas la couleur d'accent du template (puisqu'aucun style n'est appliqué au widget).
  const selColor = raw ? 'var(--muted)' : 'var(--accent)';
  const hoverColor = raw ? 'var(--line)' : 'var(--accent-soft)';
  const childRendered = w.children?.map((c) => (
    <WidgetNode key={c.id} w={c} selectedId={selectedId} dropZone={dropZone} dragging={dragging} raw={raw}
      onSelect={onSelect} onMove={onMove} onRemove={onRemove} onUngroup={onUngroup}
      onNodeDragStart={onNodeDragStart} onDragEnd={onDragEnd} onZoneDragOver={onZoneDragOver} onZoneDrop={onZoneDrop} inGroup />
  ));
  return (
    <Box sx={{ position: 'relative', maxWidth: '100%' }}>
      <Box
        draggable
        onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', w.id); onNodeDragStart(w.id); }}
        onDragEnd={onDragEnd}
        onClick={(e) => { e.stopPropagation(); onSelect(w.id); }}
        {...(w.type === 'group' ? {
          onDragOver: (e: React.DragEvent) => onZoneDragOver(e, w.id),
          onDrop: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); onZoneDrop(w.id); },
        } : {})}
        sx={{
          position: 'relative', borderRadius: raw ? 'var(--radius-sm)' : 999, cursor: 'grab',
          // En headless, le conteneur garde une bordure neutre persistante (visible mais sans style).
          ...(isGroup && raw ? { border: '1px dashed var(--line)', p: 1 } : {}),
          outline: active ? `2px solid ${selColor}` : (isGroupDrop ? `2px dashed ${selColor}` : '2px solid transparent'), outlineOffset: 2,
          '&:hover': { outlineColor: active ? selColor : hoverColor },
        }}
      >
        {raw ? renderRawWidget(w.type, w.props, childRendered) : def.render(w.props, childRendered)}
      </Box>
      {active ? (
        <Box sx={{ position: 'absolute', top: -12, right: 0, display: 'flex', gap: 0.25, bgcolor: 'var(--ink)', borderRadius: 'var(--radius-sm)', px: 0.25, py: 0.1, zIndex: 2 }}>
          <Ctl title="Glisser"><GripVertical size={12} /></Ctl>
          <Ctl title="Monter" onClick={() => onMove(w.id, -1)}><ChevronUp size={13} /></Ctl>
          <Ctl title="Descendre" onClick={() => onMove(w.id, 1)}><ChevronDown size={13} /></Ctl>
          {inGroup ? <Ctl title="Sortir du conteneur" onClick={() => onUngroup(w.id)}><FolderInput size={12} /></Ctl> : null}
          <Ctl title="Supprimer" onClick={() => onRemove(w.id)}><Trash2 size={12} /></Ctl>
        </Box>
      ) : null}
    </Box>
  );
}

function Ctl({ title, onClick, children }: { title: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Tooltip title={title}>
      <ButtonBase onClick={onClick ? (e) => { e.stopPropagation(); onClick(); } : undefined} sx={{ width: 22, height: 20, borderRadius: 'var(--radius-sm)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.18)' } }}>
        {children}
      </ButtonBase>
    </Tooltip>
  );
}

function TextRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', mb: 0.5, textTransform: 'capitalize' }}>{label}</Box>
      <Box component="input" value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        sx={{ width: '100%', height: 34, px: 1, fontSize: 'var(--text-sm)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none', '&:focus': { borderColor: 'var(--accent)' } }} />
    </Box>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', mb: 0.5 }}>{label}</Box>
      <Box component="select" value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        sx={{ width: '100%', height: 34, px: 1, fontSize: 'var(--text-sm)', color: 'var(--ink)', bgcolor: 'var(--field)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', outline: 'none' }}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </Box>
    </Box>
  );
}
