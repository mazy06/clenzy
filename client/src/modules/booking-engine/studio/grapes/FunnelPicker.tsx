import { createElement, useMemo, useRef, useState } from 'react';
import { cn } from '../../../../utils/cn';
import {
  Badge,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  Input,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../../../components/ui';
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
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      {/* La croix du gabarit est masquee : l'en-tete en porte deja une, calee
          sur le vocabulaire de tokens de ce module. */}
      <DialogContent
        showCloseButton={false}
        className="w-[calc(100%-24px)] max-w-[1040px] max-h-[92vh] flex flex-col gap-0 overflow-hidden rounded-xl border border-border bg-card p-0 text-foreground"
      >
      {/* ── En-tête ── */}
      <div className="flex items-start gap-2 border-b border-border px-4 py-3">
        <div className="grid size-[42px] shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Workflow size={20} strokeWidth={2} />
        </div>
        <div className="flex-1 min-w-0">
          <DialogTitle className="m-0 text-base font-semibold tracking-tight text-balance text-foreground">
            Parcours de réservation
          </DialogTitle>
          <DialogDescription className="mt-1 max-w-[62ch] text-2xs leading-snug text-muted-foreground">
            Démarrez avec un modèle prêt à l'emploi, ou composez votre propre parcours, écran par écran.
          </DialogDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Fermer"
          className="shrink-0"
        >
          <X size={18} strokeWidth={2} />
        </Button>
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
              <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-border bg-primary-soft px-2 py-1.5">
                <div className="grid size-[27px] shrink-0 place-items-center rounded-md bg-card text-primary">
                  <Pencil size={15} strokeWidth={2} />
                </div>
                <span className="min-w-0 flex-1 text-2xs leading-snug text-foreground">
                  Basé sur <span className="font-semibold text-foreground">« {baseLabel} »</span>
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
                      <div className="px-1 py-1 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{g.category}</div>
                      {g.items.map((w) => {
                        const on = selectedSet.has(w.id);
                        return (
                          <button
                            type="button"
                            key={w.id}
                            onClick={() => toggleWidget(w.id)}
                            className={cn(
                              'flex w-full cursor-pointer items-center justify-start gap-2 rounded-lg border px-2 py-1.5 text-start',
                              'transition-colors duration-150 ease-out-quart motion-reduce:transition-none',
                              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                              on
                                ? 'border-primary bg-primary-soft hover:bg-primary-soft'
                                : 'border-transparent bg-transparent hover:bg-muted',
                            )}
                          >
                            <div className={cn('grid size-8 shrink-0 place-items-center rounded-md', on ? 'bg-card text-primary' : 'bg-muted text-muted-foreground')}>
                              <WidgetGlyph id={w.id} size={17} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="block text-sm font-medium text-foreground">{w.label}</span>
                              {w.description && <span className="block truncate text-2xs leading-tight text-muted-foreground">{w.description}</span>}
                            </div>
                            <div className={cn('grid size-5 shrink-0 place-items-center rounded-sm border-[1.5px] text-primary-foreground', on ? 'border-primary bg-primary' : 'border-border bg-transparent')}>
                              {on && <Check size={12} strokeWidth={3} />}
                            </div>
                          </button>
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
                    <Empty className="m-auto max-w-[240px] px-2 py-4">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Workflow strokeWidth={1.75} />
                        </EmptyMedia>
                        <EmptyDescription className="text-sm">
                          Cochez des widgets à gauche pour composer votre parcours, étape par étape.
                        </EmptyDescription>
                      </EmptyHeader>
                    </Empty>
                  ) : selected.map((id, i) => (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5" key={id}>
                      <div className="grid size-[22px] shrink-0 place-items-center rounded-full bg-muted text-2xs font-semibold tabular-nums text-foreground">{i + 1}</div>
                      <div className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                        <WidgetGlyph id={id} size={15} />
                      </div>
                      <span className="min-w-0 flex-1 text-sm font-medium text-foreground">{widgetLabel(id)}</span>
                      <IconAction title="Monter" icon={ChevronUp} disabled={i === 0} onClick={() => move(id, -1)} />
                      <IconAction title="Descendre" icon={ChevronDown} disabled={i === selected.length - 1} onClick={() => move(id, 1)} />
                      <IconAction title="Retirer" icon={X} danger onClick={() => toggleWidget(id)} />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 border-t border-border px-2.5 py-2">
                  <span className="text-2xs text-muted-foreground">
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
              <div className="mt-2 flex flex-col gap-0.5 rounded-lg border border-border bg-muted p-2">
                {compositionWarnings.map((w) => (
                  <div className="flex items-center gap-1 text-2xs text-muted-foreground" key={`${w.severity}:${w.widgetId}:${w.capability}`}>
                    <span className={cn('inline-flex shrink-0', w.severity === 'warning' ? 'text-warning' : 'text-info')}>
                      {w.severity === 'warning' ? <AlertTriangle size={13} strokeWidth={2} /> : <Info size={13} strokeWidth={2} />}
                    </span>
                    {w.message}
                  </div>
                ))}
              </div>
            )}

            {/* Enregistrement dans « Mes parcours » (P3) */}
            {onSave && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <span className="me-0.5 text-2xs text-muted-foreground">
                  {editingId ? 'Mettre à jour ce parcours enregistré' : 'Enregistrer dans « Mes parcours »'}
                </span>
                {/* Pas de libelle : la phrase a gauche introduit le champ,
                    d'ou l'aria-label repris du placeholder. */}
                <Input
                  id="funnel-preset-name"
                  aria-label="Nom du parcours"
                  className="flex-1 min-w-[180px]"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Nom du parcours"
                />
                <SecondaryBtn icon={Save} label={editingId ? 'Mettre à jour' : 'Enregistrer'} onClick={saveCustom} disabled={selected.length === 0 || !presetName.trim()} />
              </div>
            )}
          </>
        )}
      </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sous-composants ──────────────────────────────────────────────────────── */

function TabBtn({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex cursor-pointer items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-medium',
        'transition-colors duration-150 ease-out-quart motion-reduce:transition-none',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        active
          ? 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary'
          : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
      {typeof count === 'number' && (
        <span className={cn('rounded-sm px-1 py-px text-2xs font-semibold tabular-nums text-[inherit]', active ? 'bg-card' : 'bg-muted')}>{count}</span>
      )}
    </button>
  );
}

function SecLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</div>;
}

function CardGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[1fr] min-[600px]:grid-cols-[1fr_1fr] gap-2.5">{children}</div>;
}

/** Étapes affichées : `steps` curatées (modèles) sinon dérivées des libellés de widgets (customs). */
function flowSteps(p: FunnelPreset): string[] {
  return p.steps && p.steps.length ? p.steps : p.widgetIds.map(widgetLabel);
}

function FunnelCard({ preset: p, onInsert, onEdit, onDelete }: { preset: FunnelPreset; onInsert: () => void; onEdit: () => void; onDelete?: () => void }) {
  const steps = flowSteps(p);
  const screensMeta = p.steps && p.steps.length ? ` · ${p.steps.length} écran${p.steps.length > 1 ? 's' : ''}` : '';
  return (
    <Card
      size="sm"
      className="relative transition-shadow duration-150 ease-out-quart hover:ring-primary motion-reduce:transition-none"
    >
      <CardContent className="flex flex-1 flex-col gap-2.5">
        {/* Titre + badge + (supprimer) */}
        <div className="flex items-center gap-1.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
            <span className="text-sm font-semibold text-foreground">{p.label}</span>
            {p.badge && <Badge variant="secondary" className="text-2xs">{p.badge}</Badge>}
          </div>
          {onDelete && !p.builtin && <IconAction title="Supprimer" icon={Trash2} danger onClick={onDelete} />}
        </div>

        {p.description && <p className="-mt-1 text-2xs leading-snug text-muted-foreground">{p.description}</p>}

        {/* Visualisation du parcours : étapes numérotées + flèches */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-2">
          {steps.map((s, i) => (
            <div key={`${s}-${i}`} className="contents">
              <div className="inline-flex items-center gap-1 rounded-md border border-border bg-card py-0.5 pe-1.5 ps-0.5">
                <span className="grid size-[17px] shrink-0 place-items-center rounded-full bg-muted text-2xs font-semibold tabular-nums text-foreground">{i + 1}</span>
                <span className="text-2xs font-medium text-foreground">{s}</span>
              </div>
              {i < steps.length - 1 && <span className="grid place-items-center text-muted-foreground"><ChevronRight size={14} strokeWidth={2.4} /></span>}
            </div>
          ))}
        </div>

        {/* Pied : méta + actions */}
        <div className="mt-auto flex items-center gap-1.5">
          <span className="text-2xs text-muted-foreground">
            <span className="font-medium text-foreground">{p.widgetIds.length} widgets</span>{screensMeta}
          </span>
          <div className="ms-auto flex gap-1.5">
            <SecondaryBtn icon={Pencil} label="Modifier" onClick={onEdit} />
            <InsertBtn onClick={onInsert} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Panel({ title, pill, children }: { title: string; pill: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-2">
        <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</span>
        <Badge variant="secondary" className="ms-auto text-2xs tabular-nums">{pill}</Badge>
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
    <Tooltip>
      <TooltipTrigger asChild>
        {/* span : un bouton desactive n'emet pas d'evenement de survol, l'ancre du
            tooltip doit donc vivre au-dessus de lui. */}
        <span className="inline-flex">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onClick}
            disabled={disabled}
            aria-label={title}
            className={cn(danger && 'hover:bg-destructive-soft hover:text-destructive-ink')}
          >
            <Icon size={14} strokeWidth={2} />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  );
}

/** Bouton « Insérer » (outline accent → plein au survol), façon CTA de carte. */
function InsertBtn({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      className="border-primary font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
    >
      <Plus size={15} strokeWidth={2} /> Insérer
    </Button>
  );
}

function PrimaryBtn({ icon: Icon, label, onClick, disabled }: { icon: typeof X; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled}>
      <Icon size={15} strokeWidth={2} /> {label}
    </Button>
  );
}

function SecondaryBtn({ icon: Icon, label, onClick, disabled }: { icon: typeof X; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <Button type="button" variant="outline" size="sm" onClick={onClick} disabled={disabled}>
      <Icon size={14} strokeWidth={2} /> {label}
    </Button>
  );
}
