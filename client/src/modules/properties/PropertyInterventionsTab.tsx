import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Button,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
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
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '11px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: fg,
          bgcolor: bg,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '10.5px', color: 'var(--faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '18px', fontWeight: 600, lineHeight: 1.2, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.01em' }}>
          {value}
        </Typography>
      </Box>
    </Paper>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

interface PropertyInterventionsTabProps {
  interventions: PropertyIntervention[];
  propertyId: string;
}

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

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* ─── Stats ───────────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
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
      </Box>

      {/* ─── View toggle ─────────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
              <Typography sx={{ fontSize: '0.875rem', fontWeight: 600, minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>
                {MONTH_NAMES_FR[monthAnchor.getMonth()]} {monthAnchor.getFullYear()}
              </Typography>
              <IconButton size="small" onClick={nextMonth}>
                <ChevronRight size={18} strokeWidth={1.75} />
              </IconButton>
            </>
          )}
        </Box>
      </Box>

      {/* ─── Calendar view ───────────────────────────────────────────────── */}
      {view === 'calendar' && (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr' }, gap: 2 }}>
          {/* Calendar grid */}
          <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid var(--line)', bgcolor: 'var(--card)', boxShadow: 'none' }}>
            {/* Weekday header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
              {DAY_LABELS_FR.map((d) => (
                <Typography
                  key={d}
                  sx={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    color: 'var(--faint)',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: '.05em',
                  }}
                >
                  {d}
                </Typography>
              ))}
            </Box>

            {/* Day cells */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5 }}>
              {cells.map((d) => {
                const inMonth = d.getMonth() === monthAnchor.getMonth();
                const isToday = isSameDay(d, today);
                const isSelected = isSameDay(d, selectedDay);
                const items = byDay.get(dateKey(d)) ?? [];
                const hasItems = items.length > 0;

                return (
                  <Box
                    key={dateKey(d)}
                    onClick={() => setSelectedDay(d)}
                    sx={{
                      minHeight: 56,
                      borderRadius: '8px',
                      p: 0.75,
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      bgcolor: isSelected
                        ? 'var(--accent)'
                        : hasItems
                          ? 'var(--accent-soft)'
                          : 'transparent',
                      color: isSelected ? 'var(--on-accent)' : 'inherit',
                      border: '1px solid',
                      borderColor: isToday && !isSelected ? 'var(--accent)' : 'transparent',
                      opacity: inMonth ? 1 : 0.35,
                      transition: 'background-color .14s, border-color .14s',
                      '&:hover': {
                        bgcolor: isSelected ? 'var(--accent)' : 'var(--hover)',
                      },
                      '&:focus-visible': { outline: '2px solid var(--accent)', outlineOffset: '2px' },
                    }}
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
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 'auto' }}>
                        {items.slice(0, 3).map((iv) => (
                          <Box
                            key={iv.id}
                            sx={{
                              width: 6,
                              height: 6,
                              borderRadius: '3px',
                              bgcolor: isSelected ? 'var(--on-accent)' : interventionStatusTokens(iv.status).fg,
                              opacity: isSelected ? 0.9 : 1,
                            }}
                          />
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
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>

            {/* Legend */}
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, pt: 1.5, borderTop: '1px solid var(--line)', flexWrap: 'wrap' }}>
              {[
                { label: 'En attente', color: 'var(--warn)' },
                { label: 'En cours', color: 'var(--info)' },
                { label: 'Terminée', color: 'var(--ok)' },
                { label: 'Annulée', color: 'var(--muted)' },
              ].map((leg) => (
                <Box key={leg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 9, height: 9, borderRadius: '3px', bgcolor: leg.color }} />
                  <Typography sx={{ fontSize: '11.5px', color: 'var(--muted)' }}>{leg.label}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Selected day details */}
          <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid var(--line)', bgcolor: 'var(--card)', boxShadow: 'none', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isSameDay(selectedDay, today) ? 'var(--accent)' : 'var(--accent-soft)',
                  color: isSameDay(selectedDay, today) ? 'var(--on-accent)' : 'var(--accent)',
                }}
              >
                <CalendarMonth size={16} strokeWidth={1.75} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 700, textTransform: 'capitalize', lineHeight: 1.2 }}>
                  {selectedDay.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                  {selectedDayItems.length === 0
                    ? 'Aucune intervention'
                    : `${selectedDayItems.length} intervention${selectedDayItems.length > 1 ? 's' : ''}`}
                </Typography>
              </Box>
            </Box>

            {selectedDayItems.length === 0 ? (
              <Box
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 3,
                  color: 'text.disabled',
                }}
              >
                <CalendarMonth size={28} strokeWidth={1.5} />
                <Typography sx={{ fontSize: '0.75rem', mt: 1 }}>
                  Sélectionnez un jour avec un point coloré
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {selectedDayItems.map((iv) => {
                  const tk = interventionStatusTokens(iv.status);
                  return (
                    <Box
                      key={iv.id}
                      onClick={() => navigate(`/interventions/${iv.id}`)}
                      sx={{
                        p: 1.25,
                        borderRadius: '11px',
                        border: '1px solid var(--line)',
                        cursor: 'pointer',
                        transition: 'border-color .14s, background-color .14s',
                        '&:hover': {
                          borderColor: 'var(--line-2)',
                          bgcolor: 'var(--hover)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3 }}>
                          {getInterventionTypeLabel(iv.type, t)}
                        </Typography>
                        <Chip
                          icon={statusIcon(iv.status, 12, tk.fg)}
                          label={getInterventionStatusLabel(iv.status, t)}
                          size="small"
                          sx={{
                            height: 20,
                            bgcolor: tk.bg,
                            color: tk.fg,
                            border: 'none',
                            '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: `${tk.fg} !important` },
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                      </Box>
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
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {iv.cost != null && iv.cost > 0 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Box component="span" sx={{ display: 'inline-flex', color: 'var(--accent)' }}>
                              <Euro size={12} strokeWidth={1.75} />
                            </Box>
                            <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '12.5px', fontWeight: 600, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                              <Money value={iv.cost} from="EUR" decimals={0} />
                            </Typography>
                          </Box>
                        ) : (
                          <Box />
                        )}
                        <Tooltip title="Voir le détail">
                          <Box sx={{ display: 'inline-flex', color: 'text.disabled' }}>
                            <ChevronRight size={14} strokeWidth={1.75} />
                          </Box>
                        </Tooltip>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Paper>
        </Box>
      )}

      {/* ─── List view ───────────────────────────────────────────────────── */}
      {view === 'list' && (
        <Paper sx={{ borderRadius: '14px', border: '1px solid var(--line)', bgcolor: 'var(--card)', boxShadow: 'none', overflow: 'hidden' }}>
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
                <Box key={key}>
                  <Box
                    sx={{
                      px: 2,
                      py: 1,
                      bgcolor: 'var(--surface-2)',
                      borderBottom: '1px solid var(--line)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--faint)' }}>
                      {MONTH_NAMES_FR[m]} {y}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                      {items.length} intervention{items.length > 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  {items.map((iv) => {
                    const tk = interventionStatusTokens(iv.status);
                    return (
                      <Box
                        key={iv.id}
                        onClick={() => navigate(`/interventions/${iv.id}`)}
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: { xs: '70px 1fr auto', sm: '80px 1fr 130px 90px 20px' },
                          gap: 1.5,
                          alignItems: 'center',
                          px: 2,
                          py: 1.25,
                          cursor: 'pointer',
                          borderBottom: '1px solid var(--line)',
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: 'var(--hover)' },
                          transition: 'background-color .14s',
                        }}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '17px', fontWeight: 600, lineHeight: 1, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
                            {new Date(iv.scheduledDate).getDate()}
                          </Typography>
                          <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                            {new Date(iv.scheduledDate).toLocaleDateString('fr-FR', { weekday: 'short' })}
                          </Typography>
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                            {getInterventionTypeLabel(iv.type, t)}
                          </Typography>
                          {iv.description && (
                            <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary', mt: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {iv.description}
                            </Typography>
                          )}
                        </Box>
                        <Chip
                          icon={statusIcon(iv.status, 12, tk.fg)}
                          label={getInterventionStatusLabel(iv.status, t)}
                          size="small"
                          sx={{
                            bgcolor: tk.bg,
                            color: tk.fg,
                            border: 'none',
                            display: { xs: 'none', sm: 'inline-flex' },
                            '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: `${tk.fg} !important` },
                            '& .MuiChip-label': { px: 1 },
                          }}
                        />
                        <Typography sx={{ fontFamily: 'var(--font-display)', fontSize: '13px', fontWeight: 600, color: 'var(--ink)', textAlign: 'right', display: { xs: 'none', sm: 'block' }, fontVariantNumeric: 'tabular-nums' }}>
                          {iv.cost != null && iv.cost > 0 ? <Money value={iv.cost} from="EUR" decimals={0} /> : '—'}
                        </Typography>
                        <Box sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: 'text.disabled' }}>
                          <ChevronRight size={16} strokeWidth={1.75} />
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              );
            });
          })()}
        </Paper>
      )}
    </Box>
  );
}
