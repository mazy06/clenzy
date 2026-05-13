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
  getInterventionStatusHex,
  getInterventionTypeLabel,
} from '../../utils/statusUtils';
import type { PropertyIntervention } from '../../hooks/usePropertyDetails';

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
  value: string | number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 1.25,
        borderColor: 'divider',
        minWidth: 0,
        flex: '1 1 0',
      }}
    >
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color,
          bgcolor: `${color}15`,
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.2 }}>
          {label}
        </Typography>
        <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.2 }}>
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
      <Paper
        variant="outlined"
        sx={{ borderStyle: 'dashed', borderRadius: 2, p: 4, textAlign: 'center' }}
      >
        <Box component="span" sx={{ display: 'inline-flex', color: 'text.disabled', mb: 1 }}>
          <Build size={36} strokeWidth={1.5} />
        </Box>
        <Typography sx={{ fontSize: '0.9375rem', fontWeight: 600, color: 'text.secondary' }}>
          {t('properties.noInterventions')}
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: 'text.disabled', mt: 0.5 }}>
          Les interventions planifiées apparaîtront ici sur un calendrier
        </Typography>
      </Paper>
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
          color="#6B8A9A"
        />
        <StatCard
          icon={<HourglassEmpty size={18} strokeWidth={1.75} />}
          label="En attente"
          value={stats.pending}
          color="#f59e0b"
        />
        <StatCard
          icon={<PlayArrow size={18} strokeWidth={1.75} />}
          label="En cours"
          value={stats.inProgress}
          color="#0ea5e9"
        />
        <StatCard
          icon={<CheckCircle size={18} strokeWidth={1.75} />}
          label="Terminées"
          value={stats.completed}
          color="#10b981"
        />
        <StatCard
          icon={<Euro size={18} strokeWidth={1.75} />}
          label="Revenus"
          value={`${stats.revenue}€`}
          color="#8b5cf6"
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
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontSize: '0.8125rem',
              fontWeight: 500,
              px: 1.5,
              py: 0.5,
              gap: 0.5,
              border: '1px solid',
              borderColor: 'divider',
            },
            '& .Mui-selected': {
              bgcolor: 'primary.main !important',
              color: 'primary.contrastText !important',
              borderColor: 'primary.main !important',
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
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
            {/* Weekday header */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 1 }}>
              {DAY_LABELS_FR.map((d, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: '0.6875rem',
                    fontWeight: 700,
                    color: 'text.secondary',
                    textAlign: 'center',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
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
                      borderRadius: 1.5,
                      p: 0.75,
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      bgcolor: isSelected
                        ? 'primary.main'
                        : hasItems
                          ? 'action.hover'
                          : 'transparent',
                      color: isSelected ? 'primary.contrastText' : 'inherit',
                      border: '1px solid',
                      borderColor: isToday && !isSelected ? 'primary.main' : 'transparent',
                      opacity: inMonth ? 1 : 0.35,
                      transition: 'background-color 150ms, border-color 150ms',
                      '&:hover': {
                        bgcolor: isSelected ? 'primary.main' : 'action.selected',
                      },
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: isToday || isSelected ? 700 : 500,
                        textAlign: 'right',
                        lineHeight: 1.2,
                      }}
                    >
                      {d.getDate()}
                    </Typography>
                    {hasItems && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.25, mt: 'auto' }}>
                        {items.slice(0, 3).map((iv) => {
                          const c = getInterventionStatusHex(iv.status);
                          return (
                            <Box
                              key={iv.id}
                              sx={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                bgcolor: isSelected ? '#fff' : c,
                                opacity: isSelected ? 0.9 : 1,
                              }}
                            />
                          );
                        })}
                        {items.length > 3 && (
                          <Typography
                            sx={{
                              fontSize: '0.5625rem',
                              fontWeight: 700,
                              color: isSelected ? 'primary.contrastText' : 'text.secondary',
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
            <Box sx={{ display: 'flex', gap: 1.5, mt: 2, pt: 1.5, borderTop: '1px solid', borderColor: 'divider', flexWrap: 'wrap' }}>
              {[
                { label: 'En attente', color: '#f59e0b' },
                { label: 'En cours', color: '#0ea5e9' },
                { label: 'Terminée', color: '#10b981' },
                { label: 'Annulée', color: '#9e9e9e' },
              ].map((leg) => (
                <Box key={leg.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: leg.color }} />
                  <Typography sx={{ fontSize: '0.6875rem', color: 'text.secondary' }}>{leg.label}</Typography>
                </Box>
              ))}
            </Box>
          </Paper>

          {/* Selected day details */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: isSameDay(selectedDay, today) ? 'primary.main' : 'action.hover',
                  color: isSameDay(selectedDay, today) ? 'primary.contrastText' : 'text.primary',
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
                  const c = getInterventionStatusHex(iv.status);
                  return (
                    <Box
                      key={iv.id}
                      onClick={() => navigate(`/interventions/${iv.id}`)}
                      sx={{
                        p: 1.25,
                        borderRadius: 1.5,
                        border: '1px solid',
                        borderColor: 'divider',
                        cursor: 'pointer',
                        transition: 'border-color 150ms, background-color 150ms',
                        '&:hover': {
                          borderColor: c,
                          bgcolor: `${c}08`,
                        },
                        position: 'relative',
                        pl: 1.5,
                        '&::before': {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: 6,
                          bottom: 6,
                          width: 3,
                          borderRadius: 2,
                          bgcolor: c,
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5, gap: 1 }}>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.3 }}>
                          {getInterventionTypeLabel(iv.type, t)}
                        </Typography>
                        <Chip
                          icon={statusIcon(iv.status, 12, c)}
                          label={getInterventionStatusLabel(iv.status, t)}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            bgcolor: `${c}15`,
                            color: c,
                            border: `1px solid ${c}30`,
                            borderRadius: '6px',
                            '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: `${c} !important` },
                            '& .MuiChip-label': { px: 0.75 },
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
                            <Box component="span" sx={{ display: 'inline-flex', color: 'primary.main' }}>
                              <Euro size={12} strokeWidth={1.75} />
                            </Box>
                            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: 'primary.main' }}>
                              {iv.cost}€
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
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
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
                      bgcolor: 'action.hover',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      position: 'sticky',
                      top: 0,
                      zIndex: 1,
                    }}
                  >
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'text.secondary' }}>
                      {MONTH_NAMES_FR[m]} {y}
                    </Typography>
                    <Typography sx={{ fontSize: '0.6875rem', color: 'text.disabled' }}>
                      {items.length} intervention{items.length > 1 ? 's' : ''}
                    </Typography>
                  </Box>
                  {items.map((iv) => {
                    const c = getInterventionStatusHex(iv.status);
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
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: 'action.hover' },
                          transition: 'background-color 150ms',
                        }}
                      >
                        <Box sx={{ textAlign: 'center' }}>
                          <Typography sx={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1 }}>
                            {new Date(iv.scheduledDate).getDate()}
                          </Typography>
                          <Typography sx={{ fontSize: '0.625rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.3 }}>
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
                          icon={statusIcon(iv.status, 12, c)}
                          label={getInterventionStatusLabel(iv.status, t)}
                          size="small"
                          sx={{
                            height: 22,
                            fontSize: '0.6875rem',
                            fontWeight: 600,
                            bgcolor: `${c}15`,
                            color: c,
                            border: `1px solid ${c}30`,
                            borderRadius: '6px',
                            display: { xs: 'none', sm: 'inline-flex' },
                            '& .MuiChip-icon': { ml: 0.5, mr: -0.25, color: `${c} !important` },
                            '& .MuiChip-label': { px: 0.75 },
                          }}
                        />
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: 'primary.main', textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
                          {iv.cost != null && iv.cost > 0 ? `${iv.cost}€` : '—'}
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
