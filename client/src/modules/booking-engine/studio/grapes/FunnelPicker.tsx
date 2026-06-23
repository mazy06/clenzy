import { createElement, useMemo, useRef, useState } from 'react';
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
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, px: 2.75, py: 2, borderBottom: '1px solid var(--line)' }}>
        <Box sx={{ flexShrink: 0, width: 42, height: 42, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent)', color: 'var(--on-accent)', display: 'grid', placeItems: 'center' }}>
          <Workflow size={20} strokeWidth={2} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box component="h2" sx={{ m: 0, fontSize: 'var(--text-md)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)', letterSpacing: '-.01em' }}>
            Parcours de réservation
          </Box>
          <Box component="p" sx={{ m: '4px 0 0', fontSize: 'var(--text-2xs)', color: 'var(--muted)', lineHeight: 1.45, maxWidth: '62ch' }}>
            Démarrez avec un modèle prêt à l'emploi, ou composez votre propre parcours, écran par écran.
          </Box>
        </Box>
        <ButtonBase onClick={onClose} aria-label="Fermer" sx={{ flexShrink: 0, width: 34, height: 34, borderRadius: 'var(--radius-sm)', border: '1px solid var(--line)', color: 'var(--muted)', display: 'grid', placeItems: 'center', cursor: 'pointer', '&:hover': { bgcolor: 'var(--hover)', color: 'var(--ink)' } }}>
          <X size={18} strokeWidth={2} />
        </ButtonBase>
      </Box>

      {/* ── Onglets ── */}
      <Box sx={{ display: 'flex', gap: 0.75, px: 2.75, pt: 1.5 }}>
        <TabBtn label="Modèles" count={BUILTIN_FUNNEL_PRESETS.length} active={activeTab === 'models'} onClick={() => setTab('models')} />
        {showSavedTab && (
          <TabBtn label="Mes parcours" count={savedPresets.length} active={activeTab === 'saved'} onClick={() => setTab('saved')} />
        )}
        <TabBtn label="Composer sur mesure" active={activeTab === 'compose'} onClick={() => setTab('compose')} />
      </Box>

      {/* ── Corps (scroll) ── */}
      <Box ref={bodyRef} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', px: 2.75, py: 2.5 }}>
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.75, px: 1.5, py: 1, borderRadius: 'var(--radius-md)', bgcolor: 'var(--accent-soft)', border: '1px solid var(--line)' }}>
                <Box sx={{ flexShrink: 0, width: 27, height: 27, borderRadius: 'var(--radius-sm)', bgcolor: 'var(--card)', color: 'var(--accent)', display: 'grid', placeItems: 'center' }}>
                  <Pencil size={15} strokeWidth={2} />
                </Box>
                <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 'var(--text-2xs)', color: 'var(--body)', lineHeight: 1.4 }}>
                  Basé sur <Box component="span" sx={{ fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>« {baseLabel} »</Box>
                  {' — '}{editingId ? 'vos modifications mettront à jour ce parcours.' : 'vos modifications créeront un nouveau parcours personnalisé.'}
                </Box>
                <SecondaryBtn icon={RotateCcw} label="Repartir de zéro" onClick={resetComposer} />
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              {/* Widgets disponibles */}
              <Panel title="Widgets disponibles" pill={`${selected.length} sélectionné${selected.length > 1 ? 's' : ''}`}>
                <Box sx={{ maxHeight: 340, overflowY: 'auto', p: 1 }}>
                  {widgetGroups.map((g) => (
                    <Box key={g.category} sx={{ mb: 1.25 }}>
                      <Box sx={{ px: 0.75, pt: 0.75, pb: 0.75, fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--muted)' }}>{g.category}</Box>
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
                            <Box sx={{ flexShrink: 0, width: 32, height: 32, borderRadius: 'var(--radius-sm)', bgcolor: on ? 'var(--card)' : 'var(--hover)', color: on ? 'var(--accent)' : 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                              <WidgetGlyph id={w.id} size={17} />
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Box component="span" sx={{ display: 'block', fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>{w.label}</Box>
                              {w.description && <Box component="span" sx={{ display: 'block', fontSize: 'var(--text-2xs)', color: 'var(--muted)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.description}</Box>}
                            </Box>
                            <Box sx={{
                              flexShrink: 0, width: 20, height: 20, borderRadius: 'var(--radius-xs, 5px)',
                              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--line)'}`,
                              bgcolor: on ? 'var(--accent)' : 'transparent', color: 'var(--on-accent)',
                              display: 'grid', placeItems: 'center',
                            }}>
                              {on && <Check size={12} strokeWidth={3} />}
                            </Box>
                          </ButtonBase>
                        );
                      })}
                    </Box>
                  ))}
                </Box>
              </Panel>

              {/* Ordre du parcours */}
              <Panel title="Ordre du parcours" pill={String(selected.length)}>
                <Box sx={{ flex: 1, minHeight: 200, maxHeight: 340, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {selected.length === 0 ? (
                    <Box sx={{ m: 'auto', textAlign: 'center', maxWidth: 240, px: 1.25, py: 3 }}>
                      <Box sx={{ width: 46, height: 46, borderRadius: 'var(--radius-md)', bgcolor: 'var(--hover)', color: 'var(--muted)', display: 'grid', placeItems: 'center', mx: 'auto', mb: 1.5 }}>
                        <Workflow size={22} strokeWidth={1.75} />
                      </Box>
                      <Box component="p" sx={{ m: 0, fontSize: 'var(--text-sm)', color: 'var(--muted)', lineHeight: 1.5 }}>
                        Cochez des widgets à gauche pour composer votre parcours, étape par étape.
                      </Box>
                    </Box>
                  ) : selected.map((id, i) => (
                    <Box key={id} sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1.25, py: 1, bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
                      <Box sx={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', bgcolor: 'var(--hover)', color: 'var(--body)', fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', display: 'grid', placeItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</Box>
                      <Box sx={{ flexShrink: 0, width: 28, height: 28, borderRadius: 'var(--radius-sm)', bgcolor: 'var(--hover)', color: 'var(--muted)', display: 'grid', placeItems: 'center' }}>
                        <WidgetGlyph id={id} size={15} />
                      </Box>
                      <Box component="span" sx={{ flex: 1, minWidth: 0, fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>{widgetLabel(id)}</Box>
                      <IconAction title="Monter" icon={ChevronUp} disabled={i === 0} onClick={() => move(id, -1)} />
                      <IconAction title="Descendre" icon={ChevronDown} disabled={i === selected.length - 1} onClick={() => move(id, 1)} />
                      <IconAction title="Retirer" icon={X} danger onClick={() => toggleWidget(id)} />
                    </Box>
                  ))}
                </Box>
                <Box sx={{ borderTop: '1px solid var(--line)', px: 1.75, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box component="span" sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>
                    {selected.length === 0 ? 'Aucun widget' : `${selected.length} écran${selected.length > 1 ? 's' : ''} dans le parcours`}
                  </Box>
                  <Box sx={{ ml: 'auto' }}>
                    <PrimaryBtn icon={Plus} label={baseLabel && !editingId ? 'Créer le parcours' : editingId ? 'Insérer ce parcours' : 'Insérer le parcours'} onClick={insertCustom} disabled={selected.length === 0} />
                  </Box>
                </Box>
              </Panel>
            </Box>

            {/* Avertissements de composition (prérequis manquants) — non bloquants. */}
            {compositionWarnings.length > 0 && (
              <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 0.5, px: 1.5, py: 1.25, borderRadius: 'var(--radius-md)', border: '1px solid var(--line)', bgcolor: 'var(--hover)' }}>
                {compositionWarnings.map((w) => (
                  <Box key={`${w.severity}:${w.widgetId}:${w.capability}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>
                    <Box component="span" sx={{ flexShrink: 0, color: w.severity === 'warning' ? 'var(--accent)' : 'var(--muted)', display: 'inline-flex' }}>
                      {w.severity === 'warning' ? <AlertTriangle size={13} strokeWidth={2} /> : <Info size={13} strokeWidth={2} />}
                    </Box>
                    {w.message}
                  </Box>
                ))}
              </Box>
            )}

            {/* Enregistrement dans « Mes parcours » (P3) */}
            {onSave && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
                <Box component="span" sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', mr: 0.5 }}>
                  {editingId ? 'Mettre à jour ce parcours enregistré' : 'Enregistrer dans « Mes parcours »'}
                </Box>
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
              </Box>
            )}
          </>
        )}
      </Box>
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
        <Box component="span" sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', borderRadius: 'var(--radius-xs, 5px)', px: 0.75, py: '1px', bgcolor: active ? 'var(--card)' : 'var(--hover)', color: 'inherit', fontVariantNumeric: 'tabular-nums' }}>{count}</Box>
      )}
    </ButtonBase>
  );
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return <Box sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', mb: 1.5 }}>{children}</Box>;
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.75 }}>{children}</Box>;
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
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Box component="span" sx={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-semibold)', color: 'var(--ink)' }}>{p.label}</Box>
          {p.badge && (
            <Box component="span" sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', px: 0.75, py: '1px', borderRadius: 999, bgcolor: 'var(--hover)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{p.badge}</Box>
          )}
        </Box>
        {onDelete && !p.builtin && <IconAction title="Supprimer" icon={Trash2} danger onClick={onDelete} />}
      </Box>

      {p.description && <Box sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)', lineHeight: 1.4, mt: -0.75 }}>{p.description}</Box>}

      {/* Visualisation du parcours : étapes numérotées + flèches */}
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, p: 1.25, bgcolor: 'var(--hover)', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)' }}>
        {steps.map((s, i) => (
          <Box key={`${s}-${i}`} sx={{ display: 'contents' }}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, bgcolor: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)', pl: 0.5, pr: 1, py: 0.5 }}>
              <Box component="span" sx={{ flexShrink: 0, width: 17, height: 17, borderRadius: '50%', bgcolor: 'var(--hover)', color: 'var(--body)', fontSize: '10px', fontWeight: 'var(--fw-semibold)', display: 'grid', placeItems: 'center', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</Box>
              <Box component="span" sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-medium)', color: 'var(--ink)' }}>{s}</Box>
            </Box>
            {i < steps.length - 1 && <Box component="span" sx={{ color: 'var(--muted)', display: 'grid', placeItems: 'center' }}><ChevronRight size={14} strokeWidth={2.4} /></Box>}
          </Box>
        ))}
      </Box>

      {/* Pied : méta + actions */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 'auto' }}>
        <Box component="span" sx={{ fontSize: 'var(--text-2xs)', color: 'var(--muted)' }}>
          <Box component="span" sx={{ color: 'var(--body)', fontWeight: 'var(--fw-medium)' }}>{p.widgetIds.length} widgets</Box>{screensMeta}
        </Box>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          <SecondaryBtn icon={Pencil} label="Modifier" onClick={onEdit} />
          <InsertBtn onClick={onInsert} />
        </Box>
      </Box>
    </Box>
  );
}

function Panel({ title, pill, children }: { title: string; pill: string; children: React.ReactNode }) {
  return (
    <Box sx={{ border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', bgcolor: 'var(--card)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.75, py: 1.25, borderBottom: '1px solid var(--line)' }}>
        <Box component="span" sx={{ fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{title}</Box>
        <Box component="span" sx={{ ml: 'auto', fontSize: 'var(--text-2xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--muted)', bgcolor: 'var(--hover)', borderRadius: 'var(--radius-xs, 5px)', px: 0.75, py: '1px', fontVariantNumeric: 'tabular-nums' }}>{pill}</Box>
      </Box>
      {children}
    </Box>
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
      <Box component="span">
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
      </Box>
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
