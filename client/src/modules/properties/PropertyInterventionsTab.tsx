import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip, { type StatusTone } from '../../components/StatusChip';
import { Button, Card } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import {
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../../components/ui';
import {
  ChevronLeft,
  ChevronRight,
  CalendarMonth,
  ViewList,
  Build,
  Euro,
  CheckCircle,
  HourglassEmpty,
  PlayArrow,
  Cancel,
} from '../../icons';
import { useTranslation } from '../../hooks/useTranslation';
import {
  getInterventionStatusLabel,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import EmptyState from '../../components/EmptyState';
import { Money } from '../../components/Money';
import type { PropertyIntervention } from '../../hooks/usePropertyDetails';

// Statut intervention → ton sémantique du kit. La couleur elle-même n'est plus
// portée ici : la puce la déduit du ton, les aplats passent par les tables de
// classes ci-dessous.
function interventionStatusTone(status: string): StatusTone {
  const lower = status.toLowerCase();
  if (lower === 'completed' || lower === 'terminee' || lower === 'terminé') return 'ok';
  if (lower === 'in_progress' || lower === 'en_cours') return 'info';
  if (lower === 'cancelled' || lower === 'annulee') return 'neutral';
  return 'warn';
}

/** Pastille pleine d'un ton — un aplat prend la teinte vive, jamais l'encre (§2.4). */
const TONE_DOT_CLASS: Record<StatusTone, string> = {
  ok: 'bg-success',
  warn: 'bg-warning',
  err: 'bg-destructive',
  info: 'bg-info',
  accent: 'bg-primary',
  neutral: 'bg-muted-foreground',
};

/** Pastille d'icône d'une tuile de compteur : fond pastel + icône en teinte vive. */
const TONE_BADGE_CLASS: Record<StatusTone, string> = {
  ok: 'bg-success-soft text-success',
  warn: 'bg-warning-soft text-warning',
  err: 'bg-destructive-soft text-destructive',
  info: 'bg-info-soft text-info',
  accent: 'bg-primary-soft text-primary',
  neutral: 'bg-muted text-muted-foreground',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];
const DAY_LABELS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function buildCalendarGrid(monthAnchor: Date): Date[] {
  // 42 cells (6 weeks × 7 days), starts on Monday
  const start = startOfMonth(monthAnchor);
  const firstWeekday = (start.getDay() + 6) % 7; // 0 = Monday
  const firstCell = new Date(start);
  firstCell.setDate(start.getDate() - firstWeekday);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(firstCell);
    d.setDate(firstCell.getDate() + i);
    return d;
  });
}

// L'icône n'impose plus sa couleur : elle hérite de l'encre de la puce
// (`currentColor`), qui tient déjà le ton.
function statusIcon(status: string, size: number) {
  const lower = status.toLowerCase();
  if (lower === 'completed' || lower === 'terminee' || lower === 'terminé') {
    return <CheckCircle size={size} strokeWidth={2} />;
  }
  if (lower === 'in_progress' || lower === 'en_cours') {
    return <PlayArrow size={size} strokeWidth={2} />;
  }
  if (lower === 'cancelled' || lower === 'annulee') {
    return <Cancel size={size} strokeWidth={2} />;
  }
  return <HourglassEmpty size={size} strokeWidth={2} />;
}

// Segmente de vue : l'etat choisi est porte par `data-state=on` cote Radix, la
// ou MUI utilisait `.Mui-selected`.
const TOGGLE_ITEM_CLASS =
  'normal-case text-xs font-semibold px-[9px] py-[2.4px] gap-[3px] border-none rounded-md '
  + 'text-muted-foreground transition-colors duration-150 motion-reduce:transition-none '
  + 'hover:bg-transparent hover:text-foreground '
  + 'data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm';

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Ton sémantique de la pastille d'icône. */
  tone: StatusTone;
}

function StatCard({ icon, label, value, tone }: StatCardProps) {
  return (
    <div className="px-4 py-[14px] rounded-xl border border-solid border-border bg-card shadow-none flex items-center gap-[7.5px] min-w-0 flex-[1_1_0]">
      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', TONE_BADGE_CLASS[tone])}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-2xs text-faint font-semibold uppercase tracking-wide leading-[1.2]">
          {label}
        </p>
        <p className="font-[family-name:var(--font-display)] text-lg font-semibold leading-[1.2] text-foreground tabular-nums tracking-[-.01em]">
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface PropertyInterventionsTabProps {
  interventions: PropertyIntervention[];
  propertyId: string;
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export default function PropertyInterventionsTab({ interventions, propertyId: _propertyId }: PropertyInterventionsTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const today = useMemo(() => new Date(), []);
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    // Anchor on the most recent intervention's month, or today
    if (interventions.length > 0) {
      const sorted = [...interventions].sort((a, b) =>
        new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
      );
      return new Date(sorted[0].scheduledDate);
    }
    return new Date();
  });
  const [selectedDay, setSelectedDay] = useState<Date>(today);

  // Group interventions by date key
  const byDay = useMemo(() => {
    const map = new Map<string, PropertyIntervention[]>();
    for (const iv of interventions) {
      const k = dateKey(new Date(iv.scheduledDate));
      const arr = map.get(k) ?? [];
      arr.push(iv);
      map.set(k, arr);
    }
    return map;
  }, [interventions]);

  // Stats
  const stats = useMemo(() => {
    let pending = 0;
    let completed = 0;
    let inProgress = 0;
    let revenue = 0;
    for (const iv of interventions) {
      const s = iv.status.toLowerCase();
      if (s === 'completed' || s === 'terminee' || s === 'terminé') completed += 1;
      else if (s === 'in_progress' || s === 'en_cours') inProgress += 1;
      else pending += 1;
      revenue += iv.cost ?? 0;
    }
    return { total: interventions.length, pending, completed, inProgress, revenue };
  }, [interventions]);

  // Calendar grid + selected day's items
  const cells = useMemo(() => buildCalendarGrid(monthAnchor), [monthAnchor]);
  const selectedDayKey = dateKey(selectedDay);
  const selectedDayItems = byDay.get(selectedDayKey) ?? [];

  const prevMonth = () => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const nextMonth = () => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goToToday = () => {
    setMonthAnchor(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDay(today);
  };

  // ─── Empty state ──────────────────────────────────────────────────────────
  if (interventions.length === 0) {
    return (
      <EmptyState
        icon={<Build />}
        title={t('properties.noInterventions')}
        description="Les interventions planifiées apparaîtront ici sur un calendrier"
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* ─── Stats ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        <StatCard
          icon={<Build size={18} strokeWidth={1.75} />}
          label="Total"
          value={stats.total}
          tone="accent"
        />
        <StatCard
          icon={<HourglassEmpty size={18} strokeWidth={1.75} />}
          label="En attente"
          value={stats.pending}
          tone="warn"
        />
        <StatCard
          icon={<PlayArrow size={18} strokeWidth={1.75} />}
          label="En cours"
          value={stats.inProgress}
          tone="info"
        />
        <StatCard
          icon={<CheckCircle size={18} strokeWidth={1.75} />}
          label="Terminées"
          value={stats.completed}
          tone="ok"
        />
        <StatCard
          icon={<Euro size={18} strokeWidth={1.75} />}
          label="Revenus"
          value={<Money value={stats.revenue} from="EUR" decimals={0} />}
          tone="accent"
        />
      </div>

      {/* ─── View toggle ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center flex-wrap gap-1.5">
        <ToggleGroup
          type="single"
          size="sm"
          spacing={0}
          value={view}
          // Radix renvoie '' quand on re-clique l'option active : le garde-fou
          // evite de laisser la vue sans mode.
          onValueChange={(v) => { if (v) setView(v as typeof view); }}
          className="bg-field border border-solid border-field-line rounded-lg p-[3px] gap-[2px]"
        >
          <ToggleGroupItem value="calendar" className={TOGGLE_ITEM_CLASS}>
            <CalendarMonth size={14} strokeWidth={1.75} />
            Calendrier
          </ToggleGroupItem>
          <ToggleGroupItem value="list" className={TOGGLE_ITEM_CLASS}>
            <ViewList size={14} strokeWidth={1.75} />
            Liste
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex items-center gap-1.5">
          {view === 'calendar' && (
            <>
              <Button variant="ghost" size="sm" onClick={goToToday}>
                Aujourd'hui
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Mois précédent" onClick={prevMonth}>
                <ChevronLeft size={18} strokeWidth={1.75} />
              </Button>
              <p className="text-sm font-semibold min-w-[130px] text-center capitalize tabular-nums">
                {MONTH_NAMES_FR[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
              </p>
              <Button variant="ghost" size="icon-sm" aria-label="Mois suivant" onClick={nextMonth}>
                <ChevronRight size={18} strokeWidth={1.75} />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* ─── Calendar view ───────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1.5fr_1fr] gap-3">
          {/* Calendar grid */}
          <Card className="gap-0 py-0 p-3 bg-card">
            {/* Weekday header */}
            <div className="grid grid-cols-7 mb-1.5">
              {DAY_LABELS_FR.map((d) => (
                <p className="text-2xs font-semibold text-faint text-center uppercase tracking-wide" key={d}>
                  {d}
                </p>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((d) => {
                const inMonth = d.getMonth() === monthAnchor.getMonth();
                const isToday = isSameDay(d, today);
                const isSelected = isSameDay(d, selectedDay);
                const items = byDay.get(dateKey(d)) ?? [];
                const hasItems = items.length > 0;

                return (
                  <div
                    key={dateKey(d)}
                    onClick={() => setSelectedDay(d)}
                    // p 0.75 = 4.5px (theme.spacing = 6)
                    className={cn(
                      'min-h-[56px] rounded-md p-[4.5px] flex flex-col cursor-pointer border border-solid',
                      'transition-colors duration-150 motion-reduce:transition-none',
                      'focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2',
                      isSelected
                        ? 'bg-primary text-primary-foreground hover:bg-primary'
                        : cn(
                            hasItems ? 'bg-primary-soft' : 'bg-transparent',
                            'text-inherit hover:bg-muted',
                          ),
                      isToday && !isSelected ? 'border-primary' : 'border-transparent',
                      inMonth ? 'opacity-100' : 'opacity-35',
                    )}
                  >
                    <p className={cn('[font-family:var(--font-display)] text-xs text-end leading-[1.2] tabular-nums', isToday || isSelected ? 'font-bold' : 'font-medium')}>
                      {d.getDate()}
                    </p>
                    {hasItems && (
                      <div className="flex flex-wrap gap-0.5 mt-auto">
                        {items.slice(0, 3).map((iv) => (
                          <div
                            key={iv.id}
                            className={cn(
                              'w-1.5 h-1.5 rounded-[3px]',
                              isSelected ? 'bg-primary-foreground opacity-90' : TONE_DOT_CLASS[interventionStatusTone(iv.status)],
                            )}
                          />
                        ))}
                        {items.length > 3 && (
                          <p className={cn('text-[0.5625rem] font-bold', isSelected ? 'text-primary-foreground' : 'text-muted-foreground')}>
                            +{items.length - 3}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-2 mt-3 pt-2 border-t border-border flex-wrap">
              {([
                { label: 'En attente', tone: 'warn' },
                { label: 'En cours', tone: 'info' },
                { label: 'Terminée', tone: 'ok' },
                { label: 'Annulée', tone: 'neutral' },
              ] as { label: string; tone: StatusTone }[]).map((leg) => (
                <div className="flex items-center gap-0.5" key={leg.label}>
                  <div className={cn('w-[9px] h-[9px] rounded-[3px]', TONE_DOT_CLASS[leg.tone])} />
                  <p className="text-xs text-muted-foreground">{leg.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Selected day details */}
          <Card className="gap-0 py-0 p-3 bg-card flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center',
                isSameDay(selectedDay, today) ? 'bg-primary text-primary-foreground' : 'bg-primary-soft text-primary',
              )}>
                <CalendarMonth size={16} strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-sm font-semibold capitalize leading-[1.2] text-foreground">
                  {selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedDayItems.length === 0
                    ? 'Aucune intervention'
                    : `${selectedDayItems.length} intervention${selectedDayItems.length > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-4 text-faint">
                <CalendarMonth size={28} strokeWidth={1.5} />
                <p className="text-xs mt-1.5">
                  Sélectionnez un jour avec un point coloré
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {selectedDayItems.map((iv) => {
                  const tone = interventionStatusTone(iv.status);
                  return (
                    <div
                      key={iv.id}
                      onClick={() => navigate(`/interventions/${iv.id}`)}
                      className="p-[7.5px] rounded-lg border border-solid border-border cursor-pointer transition-colors duration-150 motion-reduce:transition-none hover:bg-muted"
                    >
                      <div className="flex justify-between items-start mb-0.5 gap-1.5">
                        <p className="text-sm font-semibold leading-[1.3] text-foreground">
                          {getInterventionTypeLabel(iv.type, t)}
                        </p>
                        <StatusChip tone={tone} label={getInterventionStatusLabel(iv.status, t)} icon={statusIcon(iv.status, 12)} className="h-[20px]" />
                      </div>
                      {iv.description && (
                        // line-clamp-2 pose display/-webkit-box-orient/overflow d'un bloc
                        <p className="text-xs text-muted-foreground mb-[3px] line-clamp-2 leading-[1.4]">
                          {iv.description}
                        </p>
                      )}
                      <div className="flex justify-between items-center">
                        {iv.cost != null && iv.cost > 0 ? (
                          <div className="flex items-center gap-0.5">
                            <span className="inline-flex text-primary">
                              <Euro size={12} strokeWidth={1.75} />
                            </span>
                            <p className="font-[family-name:var(--font-display)] text-xs font-semibold text-foreground tabular-nums">
                              <Money value={iv.cost} from="EUR" decimals={0} />
                            </p>
                          </div>
                        ) : (
                          <div />
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="inline-flex text-faint">
                              <ChevronRight size={14} strokeWidth={1.75} />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>Voir le détail</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ─── List view ───────────────────────────────────────────────────── */}
      {view === 'list' && (
        <Card className="gap-0 py-0 bg-card overflow-hidden">
          {(() => {
            // Group by month-year
            const groups = new Map<string, PropertyIntervention[]>();
            const sorted = [...interventions].sort((a, b) =>
              new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime(),
            );
            for (const iv of sorted) {
              const d = new Date(iv.scheduledDate);
              const key = `${d.getFullYear()}-${d.getMonth()}`;
              const arr = groups.get(key) ?? [];
              arr.push(iv);
              groups.set(key, arr);
            }
            return Array.from(groups.entries()).map(([key, items]) => {
              const [y, m] = key.split('-').map(Number);
              return (
                <div key={key}>
                  {/* Bandeau de mois collant : il doit rester opaque au défilement,
                      d'où `bg-muted` plutôt que la surface de carte. */}
                  <div className="px-3 py-1.5 bg-muted border-b border-border flex items-center justify-between sticky top-0 z-[1]">
                    <p className="text-2xs font-semibold uppercase tracking-wide text-faint">
                      {MONTH_NAMES_FR[m]} {y}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {items.length} intervention{items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {items.map((iv) => (
                    // Breakpoint MUI sm = 600px (non configure) : variante exacte min-[600px].
                    <div
                      key={iv.id}
                      onClick={() => navigate(`/interventions/${iv.id}`)}
                      className="grid grid-cols-[70px_1fr_auto] min-[600px]:grid-cols-[80px_1fr_130px_90px_20px] gap-[9px] items-center px-3 py-[7.5px] cursor-pointer border-b border-solid border-border last:border-b-0 hover:bg-muted transition-colors duration-150 motion-reduce:transition-none"
                    >
                      <div className="text-center">
                        <p className="font-[family-name:var(--font-display)] text-lg font-semibold leading-[1] text-foreground tabular-nums">
                          {new Date(iv.scheduledDate).getDate()}
                        </p>
                        <p className="text-2xs font-semibold text-faint uppercase tracking-wide">
                          {new Date(iv.scheduledDate).toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {getInterventionTypeLabel(iv.type, t)}
                        </p>
                        {iv.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                            {iv.description}
                          </p>
                        )}
                      </div>
                      <StatusChip
                        tone={interventionStatusTone(iv.status)}
                        label={getInterventionStatusLabel(iv.status, t)}
                        icon={statusIcon(iv.status, 12)}
                      />
                      <p className="[font-family:var(--font-display)] text-sm font-semibold text-foreground text-end hidden min-[600px]:block tabular-nums">
                        {iv.cost != null && iv.cost > 0 ? <Money value={iv.cost} from="EUR" decimals={0} /> : '—'}
                      </p>
                      <div className="hidden min-[600px]:inline-flex text-faint">
                        <ChevronRight size={16} strokeWidth={1.75} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </Card>
      )}
    </div>
  );
}
