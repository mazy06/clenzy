import React, { useMemo, useState } from 'react';
import { cn } from '../../utils/cn';
import StatusChip from '../../components/StatusChip';
import { Card } from '../../components/ui';
import { useNavigate } from 'react-router-dom';
import { Paper, Typography, IconButton, Tooltip, Button, ToggleButton, ToggleButtonGroup } from '@mui/material';
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

// Statut intervention → tokens sémantiques (pattern chips « texte couleur + fond -soft »).
function interventionStatusTokens(status: string): { fg: string; bg: string } {
  const lower = status.toLowerCase();
  if (lower === 'completed' || lower === 'terminee' || lower === 'terminé') return { fg: 'var(--ok)', bg: 'var(--ok-soft)' };
  if (lower === 'in_progress' || lower === 'en_cours') return { fg: 'var(--info)', bg: 'var(--info-soft)' };
  if (lower === 'cancelled' || lower === 'annulee') return { fg: 'var(--muted)', bg: 'var(--hover)' };
  return { fg: 'var(--warn)', bg: 'var(--warn-soft)' };
}

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

function statusIcon(status: string, size: number, color: string) {
  const lower = status.toLowerCase();
  if (lower === 'completed' || lower === 'terminee' || lower === 'terminé') {
    return <CheckCircle size={size} strokeWidth={2} color={color} />;
  }
  if (lower === 'in_progress' || lower === 'en_cours') {
    return <PlayArrow size={size} strokeWidth={2} color={color} />;
  }
  if (lower === 'cancelled' || lower === 'annulee') {
    return <Cancel size={size} strokeWidth={2} color={color} />;
  }
  return <HourglassEmpty size={size} strokeWidth={2} color={color} />;
}

// ─── Stat card ───────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Couple de tokens { fg, bg } (ex. var(--ok) / var(--ok-soft)). */
  fg: string;
  bg: string;
}

function StatCard({ icon, label, value, fg, bg }: StatCardProps) {
  return (
    <Paper
      sx={{
        p: '14px 16px',
        borderRadius: '13px',
        border: '1px solid var(--line)',
        bgcolor: 'var(--card)',
        boxShadow: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        minWidth: 0,
        flex: '1 1 0',
      }}
    >
      <div className="w-[36px] h-[36px] rounded-[11px] flex items-center justify-center shrink-0" style={{ color: fg, backgroundColor: bg }}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="cn-text-body1 text-[10.5px] text-[var(--faint)] font-bold uppercase tracking-[.04em] leading-[1.2]">
          {label}
        </p>
        <p className="cn-text-body1 font-[var(--font-display)] text-[18px] font-semibold leading-[1.2] text-[var(--ink)] tabular-nums tracking-[-.01em]">
          {value}
        </p>
      </div>
    </Paper>
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
          fg="var(--accent)" bg="var(--accent-soft)"
        />
        <StatCard
          icon={<HourglassEmpty size={18} strokeWidth={1.75} />}
          label="En attente"
          value={stats.pending}
          fg="var(--warn)" bg="var(--warn-soft)"
        />
        <StatCard
          icon={<PlayArrow size={18} strokeWidth={1.75} />}
          label="En cours"
          value={stats.inProgress}
          fg="var(--info)" bg="var(--info-soft)"
        />
        <StatCard
          icon={<CheckCircle size={18} strokeWidth={1.75} />}
          label="Terminées"
          value={stats.completed}
          fg="var(--ok)" bg="var(--ok-soft)"
        />
        <StatCard
          icon={<Euro size={18} strokeWidth={1.75} />}
          label="Revenus"
          value={<Money value={stats.revenue} from="EUR" decimals={0} />}
          fg="var(--accent)" bg="var(--accent-soft)"
        />
      </div>

      {/* ─── View toggle ─────────────────────────────────────────────────── */}
      <div className="flex justify-between items-center flex-wrap gap-1.5">
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, v) => v && setView(v)}
          size="small"
          sx={{
            bgcolor: 'var(--field)',
            border: '1px solid var(--field-line)',
            borderRadius: '10px',
            p: '3px',
            gap: '2px',
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontSize: '12px',
              fontWeight: 600,
              px: 1.5,
              py: 0.4,
              gap: 0.5,
              border: 'none',
              borderRadius: '8px !important',
              color: 'var(--muted)',
              transition: 'background-color .14s, color .14s',
              '&:hover': { bgcolor: 'transparent', color: 'var(--body)' },
            },
            '& .Mui-selected': {
              bgcolor: 'var(--card) !important',
              color: 'var(--accent) !important',
              boxShadow: '0 1px 3px color-mix(in srgb, var(--ink) 10%, transparent)',
            },
          }}
        >
          <ToggleButton value="calendar">
            <CalendarMonth size={14} strokeWidth={1.75} />
            Calendrier
          </ToggleButton>
          <ToggleButton value="list">
            <ViewList size={14} strokeWidth={1.75} />
            Liste
          </ToggleButton>
        </ToggleButtonGroup>

        <div className="flex items-center gap-1.5">
          {view === 'calendar' && (
            <>
              <Button
                size="small"
                onClick={goToToday}
                sx={{ textTransform: 'none', fontSize: '0.75rem', fontWeight: 500 }}
              >
                Aujourd'hui
              </Button>
              <IconButton size="small" onClick={prevMonth}>
                <ChevronLeft size={18} strokeWidth={1.75} />
              </IconButton>
              <p className="cn-text-body1 text-[0.875rem] font-semibold min-w-[130px] text-center capitalize">
                {MONTH_NAMES_FR[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
              </p>
              <IconButton size="small" onClick={nextMonth}>
                <ChevronRight size={18} strokeWidth={1.75} />
              </IconButton>
            </>
          )}
        </div>
      </div>

      {/* ─── Calendar view ───────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <div className="grid grid-cols-[1fr] min-[900px]:grid-cols-[1.5fr_1fr] gap-3">
          {/* Calendar grid */}
          <Card className="gap-0 py-0 p-3 bg-[var(--card)]">
            {/* Weekday header */}
            <div className="grid grid-cols-7 mb-1.5">
              {DAY_LABELS_FR.map((d) => (
                <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] text-center uppercase tracking-[.05em]" key={d}>
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
                      'min-h-[56px] rounded-[8px] p-[4.5px] flex flex-col cursor-pointer border border-solid',
                      'transition-[background-color,border-color] duration-[140ms]',
                      'focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:outline-offset-2',
                      isSelected
                        ? 'bg-[var(--accent)] text-[var(--on-accent)] hover:bg-[var(--accent)]'
                        : cn(
                            hasItems ? 'bg-[var(--accent-soft)]' : 'bg-transparent',
                            'text-inherit hover:bg-[var(--hover)]',
                          ),
                      isToday && !isSelected ? 'border-[var(--accent)]' : 'border-transparent',
                      inMonth ? 'opacity-100' : 'opacity-35',
                    )}
                  >
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-display)',
                        fontSize: '12px',
                        fontWeight: isToday || isSelected ? 700 : 500,
                        textAlign: 'right',
                        lineHeight: 1.2,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {d.getDate()}
                    </Typography>
                    {hasItems && (
                      <div className="flex flex-wrap gap-0.5 mt-auto">
                        {items.slice(0, 3).map((iv) => (
                          <div className={cn('w-[6px] h-[6px] rounded-[3px]', isSelected ? 'opacity-90' : 'opacity-100')} style={{ backgroundColor: isSelected ? 'var(--on-accent)' : interventionStatusTokens(iv.status).fg }} key={iv.id} />
                        ))}
                        {items.length > 3 && (
                          <Typography
                            sx={{
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              color: isSelected ? 'var(--on-accent)' : 'var(--muted)',
                            }}
                          >
                            +{items.length - 3}
                          </Typography>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-2 mt-3 pt-2 border-t border-[var(--line)] flex-wrap">
              {[
                { label: 'En attente', color: 'var(--warn)' },
                { label: 'En cours', color: 'var(--info)' },
                { label: 'Terminée', color: 'var(--ok)' },
                { label: 'Annulée', color: 'var(--muted)' },
              ].map((leg) => (
                <div className="flex items-center gap-0.5" key={leg.label}>
                  <div className="w-[9px] h-[9px] rounded-[3px]" style={{ backgroundColor: leg.color }} />
                  <p className="cn-text-body1 text-[11.5px] text-[var(--muted)]">{leg.label}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Selected day details */}
          <Card className="gap-0 py-0 p-3 bg-[var(--card)] flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={cn('w-[32px] h-[32px] rounded-[12px] flex items-center justify-center', isSameDay(selectedDay, today) ? 'bg-[var(--accent)]' : 'bg-[var(--accent-soft)]', isSameDay(selectedDay, today) ? 'text-[var(--on-accent)]' : 'text-[var(--accent)]')}>
                <CalendarMonth size={16} strokeWidth={1.75} />
              </div>
              <div>
                <p className="cn-text-body1 text-[0.9375rem] font-bold capitalize leading-[1.2]">
                  {selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                <p className="cn-text-body1 text-[0.75rem] text-muted-foreground">
                  {selectedDayItems.length === 0
                    ? 'Aucune intervention'
                    : `${selectedDayItems.length} intervention${selectedDayItems.length > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            {selectedDayItems.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-4 text-muted-foreground opacity-60">
                <CalendarMonth size={28} strokeWidth={1.5} />
                <p className="cn-text-body1 text-[0.75rem] mt-1.5">
                  Sélectionnez un jour avec un point coloré
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {selectedDayItems.map((iv) => {
                  const tk = interventionStatusTokens(iv.status);
                  return (
                    <div className="p-[7.5px] rounded-[11px] border border-solid border-[var(--line)] cursor-pointer hover:border-[var(--line-2)] hover:bg-[var(--hover)]" style={{ transition: 'border-color .14s, background-color .14s' }} key={iv.id} onClick={() => navigate(`/interventions/${iv.id}`)}>
                      <div className="flex justify-between items-start mb-0.5 gap-1.5">
                        <p className="cn-text-body1 text-[0.8125rem] font-semibold leading-[1.3]">
                          {getInterventionTypeLabel(iv.type, t)}
                        </p>
                        <StatusChip tokens={{ color: tk.fg, bg: tk.bg }} label={getInterventionStatusLabel(iv.status, t)} icon={statusIcon(iv.status, 12, tk.fg)} className="h-[20px]" />
                      </div>
                      {iv.description && (
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                            mb: 0.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4,
                          }}
                        >
                          {iv.description}
                        </Typography>
                      )}
                      <div className="flex justify-between items-center">
                        {iv.cost != null && iv.cost > 0 ? (
                          <div className="flex items-center gap-0.5">
                            <span className="inline-flex text-[var(--accent)]">
                              <Euro size={12} strokeWidth={1.75} />
                            </span>
                            <p className="cn-text-body1 font-[var(--font-display)] text-[12.5px] font-semibold text-[var(--ink)] tabular-nums">
                              <Money value={iv.cost} from="EUR" decimals={0} />
                            </p>
                          </div>
                        ) : (
                          <div />
                        )}
                        <Tooltip title="Voir le détail">
                          <div className="inline-flex text-muted-foreground opacity-60">
                            <ChevronRight size={14} strokeWidth={1.75} />
                          </div>
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
        <Card className="gap-0 py-0 bg-[var(--card)] overflow-hidden">
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
                  <div className="px-3 py-1.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between sticky top-[0px] z-[1]">
                    <p className="cn-text-body1 text-[10.5px] font-bold uppercase tracking-[.05em] text-[var(--faint)]">
                      {MONTH_NAMES_FR[m]} {y}
                    </p>
                    <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground opacity-60">
                      {items.length} intervention{items.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  {items.map((iv) => {
                    const tk = interventionStatusTokens(iv.status);
                    return (
                      // Breakpoint MUI sm = 600px (non configure) : variante exacte min-[600px].
                      <div
                        key={iv.id}
                        onClick={() => navigate(`/interventions/${iv.id}`)}
                        className="grid grid-cols-[70px_1fr_auto] min-[600px]:grid-cols-[80px_1fr_130px_90px_20px] gap-[9px] items-center px-3 py-[7.5px] cursor-pointer border-b border-solid border-[var(--line)] last:border-b-0 hover:bg-[var(--hover)] transition-[background-color] duration-[140ms]"
                      >
                        <div className="text-center">
                          <p className="cn-text-body1 font-[var(--font-display)] text-[17px] font-semibold leading-[1] text-[var(--ink)] tabular-nums">
                            {new Date(iv.scheduledDate).getDate()}
                          </p>
                          <p className="cn-text-body1 text-[10.5px] font-bold text-[var(--faint)] uppercase tracking-[.06em]">
                            {new Date(iv.scheduledDate).toLocaleDateString('fr-FR', { weekday: 'short' })}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="cn-text-body1 text-[0.8125rem] font-semibold">
                            {getInterventionTypeLabel(iv.type, t)}
                          </p>
                          {iv.description && (
                            <p className="cn-text-body1 text-[0.6875rem] text-muted-foreground mt-0.5 overflow-hidden text-ellipsis whitespace-nowrap">
                              {iv.description}
                            </p>
                          )}
                        </div>
                        <StatusChip tokens={{ color: tk.fg, bg: tk.bg }} label={getInterventionStatusLabel(iv.status, t)} icon={statusIcon(iv.status, 12, tk.fg)} />
                        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', textAlign: 'right', display: { xs: 'none', sm: 'block' }, fontVariantNumeric: 'tabular-nums' }}>
                          {iv.cost != null && iv.cost > 0 ? <Money value={iv.cost} from="EUR" decimals={0} /> : '—'}
                        </Typography>
                        <div className="hidden min-[600px]:inline-flex text-[var(--faint)]">
                          <ChevronRight size={16} strokeWidth={1.75} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            });
          })()}
        </Card>
      )}
    </div>
  );
}
