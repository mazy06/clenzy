import { createElement, useMemo, useRef, useState } from 'react';
import { cn } from '../../../../utils/cn';
import { Box, ButtonBase, Dialog, TextField, Tooltip } from '@mui/material';
import { X, Plus, Trash2, ChevronUp, ChevronDown, ChevronRight, Check, Save, Workflow, Pencil, RotateCcw, AlertTriangle, Info } from 'lucide-react';
import {
  BUILTIN_FUNNEL_PRESETS,
  widgetLabel,
  type FunnelPreset,
} from './funnelPresets';
import { BOOKING_WIDGET_DEFS } from './bookingWidgetDefs';
import { validateComposition } from './funnelRules';

/**
 * Sélecteur de PARCOURS de réservation (funnels customisables) — design « Baitly funnel modal ».
 *  - onglet MODÈLES : cartes avec visualisation du parcours (étapes + flèches) → insérer ou « partir de ce modèle » ;
 *  - onglet MES PARCOURS : customs de l'org (P3), éditables / supprimables ;
 *  - onglet COMPOSER : choix + ordonnancement des widgets, fork d'un modèle ou création ex nihilo.
 * Insertion MULTIPLE (≠ toggle) : on peut empiler plusieurs parcours sur la page.
 */
export interface FunnelPickerProps {
  open: boolean;
  onClose: () => void;
  /** Insère un parcours = liste ordonnée d'ids widgets. */
  onInsert: (widgetIds: string[]) => void;
  /** Parcours custom de l'org (P3). */
  savedPresets?: FunnelPreset[];
  /**
   * Enregistrer un parcours custom (P3). Si absent → bloc « enregistrer » masqué.
   * `id` présent = mise à jour en place d'un custom existant ; absent = création (fork d'un modèle / nouveau).
   */
  onSave?: (preset: { id?: string; label: string; widgetIds: string[] }) => void;
  /** Supprimer un parcours custom (P3). */
  onDelete?: (id: string) => void;
}

type TabKey = 'models' | 'saved' | 'compose';

export default function FunnelPicker({ open, onClose, onInsert, savedPresets = [], onSave, onDelete }: FunnelPickerProps) {
  const [tab, setTab] = useState<TabKey>('models');
  // Composition sur-mesure : liste ORDONNÉE d'ids widgets sélectionnés.
  const [selected, setSelected] = useState<string[]>([]);
  const [presetName, setPresetName] = useState('');
  // Contexte d'édition : `editingId` = id d'un custom mis à jour EN PLACE (null = création / fork d'un modèle).
  // `baseLabel` = libellé du parcours dont on est parti (bandeau « basé sur »).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [baseLabel, setBaseLabel] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  // Avertissements de composition (prérequis manquants) — non bloquants.
  const compositionWarnings = useMemo(() => validateComposition(selected), [selected]);

  // Widgets groupés par catégorie (ordre du registre) pour le composeur.
  const widgetGroups = useMemo(() => {
    const map = new Map<string, typeof BOOKING_WIDGET_DEFS>();
    for (const d of BOOKING_WIDGET_DEFS) {
      const arr = map.get(d.category) ?? [];
      arr.push(d);
      map.set(d.category, arr);
    }
    return Array.from(map, ([category, items]) => ({ category, items }));
  }, []);

  const toggleWidget = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((w) => w !== id) : [...cur, id]));
  const move = (id: string, dir: -1 | 1) =>
    setSelected((cur) => {
      const i = cur.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length) return cur;
      const next = [...cur];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const insert = (widgetIds: string[]) => {
    if (widgetIds.length === 0) return;
    onInsert(widgetIds);
    onClose();
  };
  const insertCustom = () => insert(selected);

  /** Partir d'un parcours existant : modèle intégré → fork (nouveau custom) ; custom → mise à jour en place. */
  const startFrom = (preset: FunnelPreset) => {
    setSelected([...preset.widgetIds]);
    setBaseLabel(preset.label);
    if (preset.builtin) {
      setEditingId(null);
      setPresetName(`${preset.label} personnalisé`);
    } else {
      setEditingId(preset.id);
      setPresetName(preset.label);
    }
    setTab('compose');
    requestAnimationFrame(() => { if (bodyRef.current) bodyRef.current.scrollTop = 0; });
  };
  const resetComposer = () => {
    setSelected([]);
    setPresetName('');
    setEditingId(null);
    setBaseLabel(null);
  };
  const saveCustom = () => {
    if (!onSave || selected.length === 0 || !presetName.trim()) return;
    onSave({ id: editingId ?? undefined, label: presetName.trim(), widgetIds: selected });
    resetComposer();
  };

  const showSavedTab = savedPresets.length > 0;
  const activeTab: TabKey = tab === 'saved' && !showSavedTab ? 'models' : tab;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{ sx: { width: '100%', maxWidth: 1040, m: 2, bgcolor: 'var(--card)', color: 'var(--body)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      {/* ── En-tête ── */}
      <div className="flex items-start gap-2 px-4 py-3 border-b border-[var(--line)]">
        <div className="shrink-0 w-[42px] h-[42px] rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--on-accent)] grid place-items-[center]">
          <Workflow size={20} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="m-0 text-[var(--text-md)] font-[var(--fw-semibold)] text-[var(--ink)] tracking-[-.01em]">
            Parcours de réservation
          </h2>
          <p className="m-[4px 0 0] text-[var(--text-2xs)] text-[var(--muted)] leading-[1.45] max-w-[62ch]">
            Démarrez avec un modèle prêt à l'emploi, ou composez votre propre parcours, écran par écran.
          </p>
        </div>
        <ButtonBase onClick={onClose} aria-label="Fermer" sx={{ flexShrink: 0, width: 34, height: 34, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>
          <X size={18} strokeWidth={2} />
        </ButtonBase>
      </div>

      {/* ── Onglets ── */}
      <div className="flex gap-1 px-4 pt-2">
        <TabBtn label="Modèles" count={BUILTIN_FUNNEL_PRESETS.length} active={activeTab === 'models'} onClick={() => setTab('models')} />
        {showSavedTab && (
          <TabBtn label="Mes parcours" count={savedPresets.length} active={activeTab === 'saved'} onClick={() => setTab('saved')} />
        )}
        <TabBtn label="Composer sur mesure" active={activeTab === 'compose'} onClick={() => setTab('compose')} />
      </div>

      {/* ── Corps (scroll) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-[16.5px] py-[15px]" ref={bodyRef}>
        {activeTab === 'models' && (
          <>
            <SecLabel>Choisissez un modèle</SecLabel>
            <CardGrid>
              {BUILTIN_FUNNEL_PRESETS.map((p) => (
                <FunnelCard key={p.id} preset={p} onInsert={() => insert(p.widgetIds)} onEdit={() => startFrom(p)} />
              ))}
            </CardGrid>
          </>
        )}

        {activeTab === 'saved' && (
          <>
            <SecLabel>Vos parcours enregistrés</SecLabel>
            <CardGrid>
              {savedPresets.map((p) => (
                <FunnelCard
                  key={p.id}
                  preset={p}
                  onInsert={() => insert(p.widgetIds)}
                  onEdit={() => startFrom(p)}
                  onDelete={onDelete ? () => onDelete(p.id) : undefined}
                />
              ))}
            </CardGrid>
          </>
        )}

        {activeTab === 'compose' && (
          <>
            <SecLabel>{editingId ? 'Modifier le parcours' : 'Composez votre parcours'}</SecLabel>

            {baseLabel && (
              <div className="flex items-center gap-2 mb-2.5 px-2 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent-soft)] border border-[var(--line)]">
                <div className="shrink-0 w-[27px] h-[27px] rounded-[var(--radius-sm)] bg-[var(--card)] text-[var(--accent)] grid place-items-[center]">
                  <Pencil size={15} strokeWidth={2} />
                </div>
                <span className="flex-1 min-w-0 text-[var(--text-2xs)] text-[var(--body)] leading-[1.4]">
                  Basé sur <span className="font-[var(--fw-semibold)] text-[var(--ink)]">« {baseLabel} »</span>
                  {' — '}{editingId ? 'vos modifications mettront à jour ce parcours.' : 'vos modifications créeront un nouveau parcours personnalisé.'}
                </span>
                <SecondaryBtn icon={RotateCcw} label="Repartir de zéro" onClick={resetComposer} />
              </div>
            )}

            <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1fr_1fr] gap-3">
              {/* Widgets disponibles */}
              <Panel title="Widgets disponibles" pill={`${selected.length} sélectionné${selected.length > 1 ? 's' : ''}`}>
                <div className="max-h-[340px] overflow-y-auto p-1.5">
                  {widgetGroups.map((g) => (
                    <div className="mb-2" key={g.category}>
                      <div className="px-1 pt-1 pb-1 text-[var(--text-2xs)] font-[var(--fw-semibold)] uppercase tracking-[.08em] text-[var(--muted)]">{g.category}</div>
                      {g.items.map((w) => {
                        const on = selectedSet.has(w.id);
                        return (
                          <ButtonBase
                            key={w.id}
                            onClick={() => toggleWidget(w.id)}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 1.25, width: '100%', justifyContent: 'flex-start',
                              px: 1.25, py: 1, borderRadius: 'var(--radius-md)', textAlign: 'left', cursor: 'pointer',
                              border: '1px solid', borderColor: on ? 'var(--accent)' : 'transparent',
                              bgcolor: on ? 'var(--accent-soft)' : 'transparent',
                              transition: 'background var(--duration-fast) var(--ease-out)',
                              '&:hover': { bgcolor: on ? 'var(--accent-soft)' : 'var(--hover)' },
                            }}
                          >
                            <div className={cn('shrink-0 w-[32px] h-[32px] rounded-[var(--radius-sm)] grid place-items-[center]', on ? 'bg-[var(--card)]' : 'bg-[var(--hover)]', on ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}>
                              <WidgetGlyph id={w.id} size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block text-[var(--text-sm)] font-[var(--fw-medium)] text-[var(--ink)]">{w.label}</span>
                              {w.description && <span className="block text-[var(--text-2xs)] text-[var(--muted)] leading-[1.3] whitespace-nowrap overflow-hidden text-ellipsis">{w.description}</span>}
                            </div>
                            <div className={cn('shrink-0 w-[20px] h-[20px] rounded-[var(--radius-xs,_5px)] text-[var(--on-accent)] grid place-items-[center]', on ? 'bg-[var(--accent)]' : 'bg-[transparent]')} style={{ border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}` }}>
                              {on && <Check size={12} strokeWidth={3} />}
                            </div>
                          </ButtonBase>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </Panel>

              {/* Ordre du parcours */}
              <Panel title="Ordre du parcours" pill={String(selected.length)}>
                <div className="flex-1 min-h-[200px] max-h-[340px] overflow-y-auto p-2 flex flex-col gap-1.5">
                  {selected.length === 0 ? (
                    <div className="m-auto text-center max-w-[240px] px-2 py-4">
                      <div className="w-[46px] h-[46px] rounded-[var(--radius-md)] bg-[var(--hover)] text-[var(--muted)] grid place-items-[center] mx-auto mb-[9px]">
                        <Workflow size={22} strokeWidth={1.75} />
                      </div>
                      <p className="m-0 text-[var(--text-sm)] text-[var(--muted)] leading-[1.5]">
                        Cochez des widgets à gauche pour composer votre parcours, étape par étape.
                      </p>
                    </div>
                  ) : selected.map((id, i) => (
                    <div className="flex items-center gap-2 px-2 py-1.5 bg-[var(--card)] border border-[var(--line)] rounded-[var(--radius-md)]" key={id}>
                      <div className="shrink-0 w-[22px] h-[22px] rounded-[50%] bg-[var(--hover)] text-[var(--body)] text-[var(--text-2xs)] grid place-items-[center] tabular-nums" style={{ fontWeight: 'var(--fw-semibold)' }}>{i + 1}</div>
                      <div className="shrink-0 w-[28px] h-[28px] rounded-[var(--radius-sm)] bg-[var(--hover)] text-[var(--muted)] grid place-items-[center]">
                        <WidgetGlyph id={id} size={15} />
                      </div>
                      <span className="flex-1 min-w-0 text-[var(--text-sm)] font-[var(--fw-medium)] text-[var(--ink)]">{widgetLabel(id)}</span>
                      <IconAction title="Monter" icon={ChevronUp} disabled={i === 0} onClick={() => move(id, -1)} />
                      <IconAction title="Descendre" icon={ChevronDown} disabled={i === selected.length - 1} onClick={() => move(id, 1)} />
                      <IconAction title="Retirer" icon={X} danger onClick={() => toggleWidget(id)} />
                    </div>
                  ))}
                </div>
                <div className="border-t border-[var(--line)] px-2.5 py-2 flex items-center gap-2">
                  <span className="text-[var(--text-2xs)] text-[var(--muted)]">
                    {selected.length === 0 ? 'Aucun widget' : `${selected.length} écran${selected.length > 1 ? 's' : ''} dans le parcours`}
                  </span>
                  <div className="ms-auto">
                    <PrimaryBtn icon={Plus} label={baseLabel && !editingId ? 'Créer le parcours' : editingId ? 'Insérer ce parcours' : 'Insérer le parcours'} onClick={insertCustom} disabled={selected.length === 0} />
                  </div>
                </div>
              </Panel>
            </div>

            {/* Avertissements de composition (prérequis manquants) — non bloquants. */}
            {compositionWarnings.length > 0 && (
              <div className="mt-2 flex flex-col gap-0.5 px-2 py-2 rounded-[var(--radius-md)] border border-[var(--line)] bg-[var(--hover)]">
                {compositionWarnings.map((w) => (
                  <div className="flex items-center gap-1 text-[var(--text-2xs)] text-[var(--muted)]" key={`${w.severity}:${w.widgetId}:${w.capability}`}>
                    <span className={cn('shrink-0 inline-flex', w.severity === 'warning' ? 'text-[var(--accent)]' : 'text-[var(--muted)]')}>
                      {w.severity === 'warning' ? <AlertTriangle size={13} strokeWidth={2} /> : <Info size={13} strokeWidth={2} />}
                    </span>
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Enregistrement dans « Mes parcours » (P3) */}
            {onSave && (
              <div className="mt-3 pt-3 border-t border-[var(--line)] flex flex-wrap items-center gap-2">
                <span className="text-[var(--text-2xs)] text-[var(--muted)] me-0.5">
                  {editingId ? 'Mettre à jour ce parcours enregistré' : 'Enregistrer dans « Mes parcours »'}
                </span>
                <TextField
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Nom du parcours"
                  size="small"
                  sx={{
                    flex: 1, minWidth: 180,
                    '& .MuiInputBase-root': { bgcolor: 'var(--field)', color: 'var(--ink)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)' },
                    '& .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--line)' },
                    '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent)' },
                  }}
                />
                <SecondaryBtn icon={Save} label={editingId ? 'Mettre à jour' : 'Enregistrer'} onClick={saveCustom} disabled={selected.length === 0 || !presetName.trim()} />
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

/* ── Sous-composants ──────────────────────────────────────────────────────── */

function TabBtn({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 1, borderRadius: 'var(--radius-md)',
        fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', cursor: 'pointer',
        color: active ? 'var(--accent)' : 'var(--muted)', bgcolor: active ? 'var(--accent-soft)' : 'transparent',
        transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
        '&:hover': { bgcolor: active ? 'var(--accent-soft)' : 'var(--hover)', color: active ? 'var(--accent)' : 'var(--ink)' },
      }}
    >
      {label}
      {typeof count === 'number' && (
        <span className={cn('text-[var(--text-2xs)] rounded-[var(--radius-xs,_5px)] px-[4.5px] py-px text-[inherit] tabular-nums', active ? 'bg-[var(--card)]' : 'bg-[var(--hover)]')} style={{ fontWeight: 'var(--fw-semibold)' }}>{count}</span>
      )}
    </ButtonBase>
  );
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[var(--text-2xs)] font-[var(--fw-semibold)] tracking-[.1em] uppercase text-[var(--muted)] mb-2">{children}</div>;
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-[10.5px]">{children}</div>;
}

/** Étapes affichées : `steps` curatées (modèles) sinon dérivées des libellés de widgets (customs). */
function flowSteps(p: FunnelPreset): string[] {
  return p.steps && p.steps.length ? p.steps : p.widgetIds.map(widgetLabel);
}

function FunnelCard({ preset: p, onInsert, onEdit, onDelete }: { preset: FunnelPreset; onInsert: () => void; onEdit: () => void; onDelete?: () => void }) {
  const steps = flowSteps(p);
  const screensMeta = p.steps && p.steps.length ? ` · ${p.steps.length} écran${p.steps.length > 1 ? 's' : ''}` : '';
  return (
    <Box sx={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'var(--card)', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5, transition: 'border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out)', '&:hover': { borderColor: 'var(--accent)', boxShadow: 'var(--shadow-sm, 0 6px 18px rgba(28,40,70,.08))' } }}>
      {/* Titre + badge + (supprimer) */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
          <span className="text-[var(--text-sm)] font-[var(--fw-semibold)] text-[var(--ink)]">{p.label}</span>
          {p.badge && (
            <span className="text-[var(--text-2xs)] px-[4.5px] py-px rounded-[7992px] bg-[var(--hover)] text-[var(--muted)] whitespace-nowrap" style={{ fontWeight: 'var(--fw-semibold)' }}>{p.badge}</span>
          )}
        </div>
        {onDelete && !p.builtin && <IconAction title="Supprimer" icon={Trash2} danger onClick={onDelete} />}
      </div>

      {p.description && <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', lineHeight: 1.4, mt: -0.75 }}>{p.description}</Box>}

      {/* Visualisation du parcours : étapes numérotées + flèches */}
      <div className="flex items-center flex-wrap gap-1 p-2 bg-[var(--hover)] border border-[var(--line)] rounded-[var(--radius-md)]">
        {steps.map((s, i) => (
          <Box key={`${s}-${i}`} sx={{ display: 'contents' }}>
            <div className="inline-flex items-center gap-1 bg-[var(--card)] border border-[var(--line)] rounded-[var(--radius-sm)] ps-0.5 pe-1.5 py-0.5">
              <span className="shrink-0 w-[17px] h-[17px] rounded-[50%] bg-[var(--hover)] text-[var(--body)] text-[10px] grid place-items-[center] tabular-nums" style={{ fontWeight: 'var(--fw-semibold)' }}>{i + 1}</span>
              <span className="text-[var(--text-2xs)] font-[var(--fw-medium)] text-[var(--ink)]">{s}</span>
            </div>
            {i < steps.length - 1 && <span className="text-[var(--muted)] grid place-items-[center]"><ChevronRight size={14} strokeWidth={2.4} /></span>}
          </Box>
        ))}
      </div>

      {/* Pied : méta + actions */}
      <div className="flex items-center gap-1.5 mt-auto">
        <span className="text-[var(--text-2xs)] text-[var(--muted)]">
          <span className="text-[var(--body)] font-[var(--fw-medium)]">{p.widgetIds.length} widgets</span>{screensMeta}
        </span>
        <div className="ms-auto flex gap-1.5">
          <SecondaryBtn icon={Pencil} label="Modifier" onClick={onEdit} />
          <InsertBtn onClick={onInsert} />
        </div>
      </div>
    </Box>
  );
}

function Panel({ title, pill, children }: { title: string; pill: string; children: React.ReactNode }) {
  return (
    <div className="border border-[var(--line)] rounded-[var(--radius-md)] bg-[var(--card)] overflow-hidden flex flex-col">
      <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-[var(--line)]">
        <span className="text-[var(--text-2xs)] font-[var(--fw-semibold)] tracking-[.08em] uppercase text-[var(--muted)]">{title}</span>
        <span className="ms-auto text-[var(--text-2xs)] text-[var(--muted)] bg-[var(--hover)] rounded-[var(--radius-xs,_5px)] px-[4.5px] py-px tabular-nums" style={{ fontWeight: 'var(--fw-semibold)' }}>{pill}</span>
      </div>
      {children}
    </div>
  );
}

/** Rend l'icône SVG d'un widget du registre (DOM statique, paths lucide). */
function WidgetGlyph({ id, size = 17 }: { id: string; size?: number }) {
  const def = BOOKING_WIDGET_DEFS.find((d) => d.id === id);
  if (!def) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {def.icon.paths.map((node, i) => createElement(node.tag, { key: i, ...node.attrs }))}
    </svg>
  );
}

function IconAction({ title, icon: Icon, onClick, disabled, danger }: { title: string; icon: typeof X; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <Tooltip title={title}>
      <span>
        <ButtonBase
          onClick={onClick}
          disabled={disabled}
          aria-label={title}
          sx={{
            width: 26, height: 24, borderRadius: 'var(--radius-sm)', color: 'var(--muted)', cursor: 'pointer',
            '&:hover': danger
              ? { color: 'var(--danger, #d4453f)', bgcolor: 'var(--danger-soft, rgba(212,69,63,.12))' }
              : { color: 'var(--ink)', bgcolor: 'var(--hover)' },
            '&.Mui-disabled': { opacity: 0.35 },
          }}
        >
          <Icon size={14} strokeWidth={2} />
        </ButtonBase>
      </span>
    </Tooltip>
  );
}

/** Bouton « Insérer » (outline accent → plein au survol), façon CTA de carte. */
function InsertBtn({ onClick }: { onClick: () => void }) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 32, px: 1.5, borderRadius: 'var(--radius-md)',
        border: '1px solid var(--accent)', color: 'var(--accent)', bgcolor: 'transparent',
        fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer',
        transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
        '&:hover': { bgcolor: 'var(--accent)', color: 'var(--on-accent)' },
        '&:active': { transform: 'translateY(1px)' },
      }}
    >
      <Plus size={15} strokeWidth={2} /> Insérer
    </ButtonBase>
  );
}

function PrimaryBtn({ icon: Icon, label, onClick, disabled }: { icon: typeof X; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <ButtonBase onClick={onClick} disabled={disabled} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, height: 34, px: 1.75, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', cursor: 'pointer', '&:hover': { bgcolor: 'var(--accent-deep)' }, '&.Mui-disabled': { opacity: 0.45 } }}>
      <Icon size={15} strokeWidth={2} /> {label}
    </ButtonBase>
  );
}

function SecondaryBtn({ icon: Icon, label, onClick, disabled }: { icon: typeof X; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <ButtonBase onClick={onClick} disabled={disabled} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, height: 30, px: 1.25, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', color: 'var(--body)', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', cursor: 'pointer', '&:hover': { borderColor: 'var(--accent)', color: 'var(--ink)' }, '&.Mui-disabled': { opacity: 0.45 } }}>
      <Icon size={14} strokeWidth={2} /> {label}
    </ButtonBase>
  );
}
