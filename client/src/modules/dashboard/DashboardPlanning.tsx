import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Chip,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  CalendarViewWeek,
  CalendarMonth,
  Home,
  CleaningServices,
  Build,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardPlanning } from '../../hooks/useDashboardPlanning';
import type { PlanningViewMode } from '../../hooks/useDashboardPlanning';
import type { Reservation, ReservationStatus, PlanningIntervention, PlanningInterventionType } from '../../services/api';
import {
  RESERVATION_STATUS_COLORS,
  RESERVATION_STATUS_LABELS,
  INTERVENTION_TYPE_COLORS,
  INTERVENTION_TYPE_LABELS,
  INTERVENTION_STATUS_LABELS,
} from '../../services/api/reservationsApi';

// ─── Constants ───────────────────────────────────────────────────────────────

const PROPERTY_COL_WIDTH = 160;
const MIN_DAY_COL_WIDTH = 32;  // Minimum pour garder la lisibilité
const RESERVATION_ROW_HEIGHT = 36;
const INTERVENTION_ROW_HEIGHT = 28;
const ROW_PADDING = 4;

const STATUS_FILTER_OPTIONS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'confirmed', label: 'Confirmées' },
  { value: 'pending', label: 'En attente' },
  { value: 'checked_in', label: 'Check-in' },
  { value: 'checked_out', label: 'Check-out' },
  { value: 'cancelled', label: 'Annulées' },
];

const INTERVENTION_FILTER_OPTIONS: { value: PlanningInterventionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'cleaning', label: 'Ménage' },
  { value: 'maintenance', label: 'Maintenance' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function toDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const startStr = start.toLocaleDateString('fr-FR', opts);
  const endStr = end.toLocaleDateString('fr-FR', {
    ...opts,
    year: 'numeric',
  });
  return `${startStr} - ${endStr}`;
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function daysBetween(d1: Date, d2: Date): number {
  const ms = d2.getTime() - d1.getTime();
  return Math.round(ms / 86400000);
}

const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

// ─── Hook: mesure dynamique de la largeur du conteneur ──────────────────────

function useContainerWidth(): [React.RefCallback<HTMLDivElement>, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<HTMLDivElement | null>(null);

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    elementRef.current = node;

    if (node) {
      setWidth(node.getBoundingClientRect().width);

      observerRef.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          setWidth(entry.contentRect.width);
        }
      });
      observerRef.current.observe(node);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [refCallback, width];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPlanning() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    properties,
    loading,
    error,
    currentDate,
    viewMode,
    setViewMode,
    goToday,
    goPrev,
    goNext,
    statusFilter,
    setStatusFilter,
    interventionTypeFilter,
    setInterventionTypeFilter,
    showInterventions,
    setShowInterventions,
    dateRange,
    days,
    filteredReservations,
    filteredInterventions,
  } = useDashboardPlanning();

  const today = useMemo(() => new Date(), []);

  // ─── Mesure dynamique de la largeur ────────────────────────────────────
  const [containerRef, containerWidth] = useContainerWidth();

  // Calcul de la largeur de chaque colonne jour
  const dayColWidth = useMemo(() => {
    if (containerWidth <= 0 || days.length === 0) return MIN_DAY_COL_WIDTH;
    const availableWidth = containerWidth - PROPERTY_COL_WIDTH - 2; // -2 pour les bordures
    const computed = Math.floor(availableWidth / days.length);
    return Math.max(computed, MIN_DAY_COL_WIDTH);
  }, [containerWidth, days.length]);

  // La grille a-t-elle besoin de scroller ?
  const gridWidth = PROPERTY_COL_WIDTH + days.length * dayColWidth;
  const needsScroll = gridWidth > containerWidth;

  // Group reservations by propertyId
  const reservationsByProperty = useMemo(() => {
    const map = new Map<number, Reservation[]>();
    filteredReservations.forEach((r) => {
      const list = map.get(r.propertyId) || [];
      list.push(r);
      map.set(r.propertyId, list);
    });
    return map;
  }, [filteredReservations]);

  // Group interventions by propertyId
  const interventionsByProperty = useMemo(() => {
    const map = new Map<number, PlanningIntervention[]>();
    filteredInterventions.forEach((i) => {
      const list = map.get(i.propertyId) || [];
      list.push(i);
      map.set(i.propertyId, list);
    });
    return map;
  }, [filteredInterventions]);

  // Compute row height per property (reservation row + optional intervention row)
  const totalRowHeight = RESERVATION_ROW_HEIGHT + ROW_PADDING * 2
    + (showInterventions ? INTERVENTION_ROW_HEIGHT + ROW_PADDING : 0);

  // ─── Loading / Error ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        {error}
      </Alert>
    );
  }

  // ─── Title ───────────────────────────────────────────────────────────────
  const titleText =
    viewMode === 'week'
      ? formatDateRange(dateRange.start, dateRange.end)
      : formatMonth(currentDate);

  return (
    <Box>
      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 1.5,
          }}
        >
          {/* Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <IconButton size="small" onClick={goPrev}>
              <ChevronLeft />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TodayIcon sx={{ fontSize: 16 }} />}
              onClick={goToday}
              sx={{ textTransform: 'none', fontSize: '0.8125rem', px: 1.5 }}
            >
              {t('dashboard.planning.today') || "Aujourd'hui"}
            </Button>
            <IconButton size="small" onClick={goNext}>
              <ChevronRight />
            </IconButton>
          </Box>

          {/* Title */}
          <Typography
            variant="subtitle1"
            fontWeight={600}
            sx={{ fontSize: '0.9375rem', textTransform: 'capitalize', minWidth: 160 }}
          >
            {titleText}
          </Typography>

          {/* Stats summary */}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
            {filteredReservations.length} {t('dashboard.planning.reservations') || 'réservation(s)'}
            {showInterventions && (
              <>
                {' · '}
                {filteredInterventions.length} {t('dashboard.planning.interventionCount') || 'intervention(s)'}
              </>
            )}
            {' · '}
            {properties.length} {t('dashboard.planning.properties') || 'logement(s)'}
          </Typography>

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Intervention toggle */}
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showInterventions}
                onChange={(e) => setShowInterventions(e.target.checked)}
              />
            }
            label={
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                {t('dashboard.planning.interventions') || 'Interventions'}
              </Typography>
            }
            sx={{ mr: 0.5 }}
          />

          {/* Intervention type filter */}
          {showInterventions && (
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ fontSize: '0.8125rem' }}>
                {t('dashboard.planning.interventionType') || 'Type'}
              </InputLabel>
              <Select
                value={interventionTypeFilter}
                label={t('dashboard.planning.interventionType') || 'Type'}
                onChange={(e) => setInterventionTypeFilter(e.target.value as PlanningInterventionType | 'all')}
                sx={{ fontSize: '0.8125rem' }}
              >
                {INTERVENTION_FILTER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8125rem' }}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Status filter */}
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ fontSize: '0.8125rem' }}>
              {t('dashboard.planning.status') || 'Statut'}
            </InputLabel>
            <Select
              value={statusFilter}
              label={t('dashboard.planning.status') || 'Statut'}
              onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')}
              sx={{ fontSize: '0.8125rem' }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.8125rem' }}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* View toggle */}
          {!isMobile && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_, val) => val && setViewMode(val as PlanningViewMode)}
            >
              <ToggleButton value="week" sx={{ px: 1.5, py: 0.5 }}>
                <CalendarViewWeek sx={{ fontSize: 18, mr: 0.5 }} />
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                  {t('dashboard.planning.week') || 'Semaine'}
                </Typography>
              </ToggleButton>
              <ToggleButton value="month" sx={{ px: 1.5, py: 0.5 }}>
                <CalendarMonth sx={{ fontSize: 18, mr: 0.5 }} />
                <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                  {t('dashboard.planning.month') || 'Mois'}
                </Typography>
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        </Box>
      </Paper>

      {/* ─── Gantt Grid ──────────────────────────────────────────────────── */}
      {properties.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Home sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
          <Typography variant="body1" color="text.secondary">
            {t('dashboard.planning.noProperties') || 'Aucun logement à afficher'}
          </Typography>
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
            {t('dashboard.planning.noPropertiesHint') ||
              "Les logements apparaîtront ici une fois qu'ils seront créés et assignés."}
          </Typography>
        </Paper>
      ) : (
        <Paper
          ref={containerRef}
          sx={{
            overflow: needsScroll ? 'auto' : 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <Box sx={{ width: needsScroll ? gridWidth : '100%', position: 'relative' }}>
            {/* ─── Header row (days) ──────────────────────────────────── */}
            <Box
              sx={{
                display: 'flex',
                position: 'sticky',
                top: 0,
                zIndex: 3,
                backgroundColor: 'background.paper',
                borderBottom: '2px solid',
                borderColor: 'divider',
              }}
            >
              {/* Property column header */}
              <Box
                sx={{
                  width: PROPERTY_COL_WIDTH,
                  minWidth: PROPERTY_COL_WIDTH,
                  flexShrink: 0,
                  px: 1.5,
                  py: 1,
                  position: 'sticky',
                  left: 0,
                  zIndex: 4,
                  backgroundColor: 'background.paper',
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                  {t('dashboard.planning.property') || 'Logement'}
                </Typography>
              </Box>

              {/* Day columns */}
              {days.map((day) => {
                const isToday = isSameDay(day, today);
                const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                return (
                  <Box
                    key={day.toISOString()}
                    sx={{
                      flex: needsScroll ? `0 0 ${dayColWidth}px` : 1,
                      minWidth: MIN_DAY_COL_WIDTH,
                      textAlign: 'center',
                      py: 0.5,
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: isToday
                        ? 'primary.main'
                        : isWeekend
                          ? 'action.hover'
                          : 'background.paper',
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.625rem',
                        fontWeight: isToday ? 700 : 400,
                        color: isToday ? 'primary.contrastText' : 'text.secondary',
                        display: 'block',
                        lineHeight: 1.2,
                      }}
                    >
                      {WEEKDAY_SHORT[day.getDay()]}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: '0.75rem',
                        fontWeight: isToday ? 700 : 500,
                        color: isToday ? 'primary.contrastText' : 'text.primary',
                        display: 'block',
                        lineHeight: 1.2,
                      }}
                    >
                      {day.getDate()}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* ─── Property rows ──────────────────────────────────────── */}
            {properties.map((property, rowIndex) => {
              const propertyReservations = reservationsByProperty.get(property.id) || [];
              const propertyInterventions = interventionsByProperty.get(property.id) || [];

              return (
                <Box
                  key={property.id}
                  sx={{
                    display: 'flex',
                    position: 'relative',
                    height: totalRowHeight,
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: rowIndex % 2 === 0 ? 'background.paper' : 'action.hover',
                    '&:hover': { backgroundColor: 'action.selected' },
                  }}
                >
                  {/* Property name cell */}
                  <Box
                    sx={{
                      width: PROPERTY_COL_WIDTH,
                      minWidth: PROPERTY_COL_WIDTH,
                      flexShrink: 0,
                      px: 1.5,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: 'inherit',
                      borderRight: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Typography
                      variant="body2"
                      fontWeight={600}
                      sx={{
                        fontSize: '0.8125rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {property.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{
                        fontSize: '0.6875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {property.city || property.address}
                    </Typography>
                  </Box>

                  {/* Day cells background + bars */}
                  <Box sx={{ display: 'flex', position: 'relative', flex: 1 }}>
                    {days.map((day) => {
                      const isToday = isSameDay(day, today);
                      const isWeekend = day.getDay() === 0 || day.getDay() === 6;

                      return (
                        <Box
                          key={day.toISOString()}
                          sx={{
                            flex: needsScroll ? `0 0 ${dayColWidth}px` : 1,
                            minWidth: MIN_DAY_COL_WIDTH,
                            height: '100%',
                            borderRight: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: isToday
                              ? 'rgba(25, 118, 210, 0.06)'
                              : isWeekend
                                ? 'rgba(0,0,0,0.02)'
                                : 'transparent',
                          }}
                        />
                      );
                    })}

                    {/* Reservation bars (top sub-row) */}
                    {propertyReservations.map((reservation) => (
                      <ReservationBar
                        key={`res-${reservation.id}`}
                        reservation={reservation}
                        days={days}
                        rangeStart={dateRange.start}
                        topOffset={ROW_PADDING}
                        barHeight={RESERVATION_ROW_HEIGHT}
                        dayColWidth={dayColWidth}
                      />
                    ))}

                    {/* Intervention bars (bottom sub-row) */}
                    {showInterventions &&
                      propertyInterventions.map((intervention) => (
                        <InterventionBar
                          key={`int-${intervention.id}`}
                          intervention={intervention}
                          days={days}
                          rangeStart={dateRange.start}
                          topOffset={ROW_PADDING + RESERVATION_ROW_HEIGHT + ROW_PADDING}
                          barHeight={INTERVENTION_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                        />
                      ))}
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Paper>
      )}

      {/* ─── Legend ───────────────────────────────────────────────────────── */}
      <Box sx={{ mt: 1.5, px: 0.5 }}>
        {/* Reservation legend */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.75, alignItems: 'center' }}>
          <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6875rem', mr: 0.5 }}>
            {t('dashboard.planning.legendReservations') || 'Réservations :'}
          </Typography>
          {STATUS_FILTER_OPTIONS.filter((s) => s.value !== 'all').map((opt) => (
            <Chip
              key={opt.value}
              label={opt.label}
              size="small"
              sx={{
                fontSize: '0.625rem',
                height: 20,
                backgroundColor: `${RESERVATION_STATUS_COLORS[opt.value as ReservationStatus]}18`,
                color: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus],
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
              }}
              icon={
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    backgroundColor: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus],
                    ml: 0.5,
                  }}
                />
              }
            />
          ))}
        </Box>

        {/* Intervention legend */}
        {showInterventions && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 0.75, alignItems: 'center' }}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6875rem', mr: 0.5 }}>
              {t('dashboard.planning.legendInterventions') || 'Interventions :'}
            </Typography>
            <Chip
              label={INTERVENTION_TYPE_LABELS.cleaning}
              size="small"
              sx={{
                fontSize: '0.625rem',
                height: 20,
                backgroundColor: `${INTERVENTION_TYPE_COLORS.cleaning}18`,
                color: INTERVENTION_TYPE_COLORS.cleaning,
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
              }}
              icon={<CleaningServices sx={{ fontSize: 12, color: INTERVENTION_TYPE_COLORS.cleaning, ml: 0.5 }} />}
            />
            <Chip
              label={INTERVENTION_TYPE_LABELS.maintenance}
              size="small"
              sx={{
                fontSize: '0.625rem',
                height: 20,
                backgroundColor: `${INTERVENTION_TYPE_COLORS.maintenance}18`,
                color: INTERVENTION_TYPE_COLORS.maintenance,
                fontWeight: 600,
                '& .MuiChip-label': { px: 0.75 },
              }}
              icon={<Build sx={{ fontSize: 12, color: INTERVENTION_TYPE_COLORS.maintenance, ml: 0.5 }} />}
            />
          </Box>
        )}

      </Box>
    </Box>
  );
}

// ─── ReservationBar Sub-component ────────────────────────────────────────────

interface ReservationBarProps {
  reservation: Reservation;
  days: Date[];
  rangeStart: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
}

function ReservationBar({ reservation, days, rangeStart, topOffset, barHeight, dayColWidth }: ReservationBarProps) {
  const checkIn = toDateOnly(reservation.checkIn);
  const checkOut = toDateOnly(reservation.checkOut);

  // Calculate position relative to the visible range
  const startOffset = daysBetween(rangeStart, checkIn);
  const endOffset = daysBetween(rangeStart, checkOut);

  // Clamp to visible range
  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  // Not visible in current range
  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  const left = visibleStart * dayColWidth;
  const width = (visibleEnd - visibleStart) * dayColWidth;
  const color = RESERVATION_STATUS_COLORS[reservation.status];
  const statusLabel = RESERVATION_STATUS_LABELS[reservation.status];

  const nights = daysBetween(checkIn, checkOut);
  const checkInStr = checkIn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const checkOutStr = checkOut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const tooltipContent = [
    `${reservation.guestName} (${reservation.guestCount} pers.)`,
    `${checkInStr} \u2192 ${checkOutStr} (${nights} nuit${nights > 1 ? 's' : ''})`,
    `${statusLabel} \xB7 ${reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1)}`,
    reservation.totalPrice > 0 ? `${reservation.totalPrice.toLocaleString('fr-FR')} \u20AC` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <Tooltip
      title={
        <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', lineHeight: 1.5 }}>
          {tooltipContent}
        </Box>
      }
      arrow
      placement="top"
    >
      <Box
        sx={{
          position: 'absolute',
          top: topOffset,
          left: left,
          width: Math.max(width - 4, 16),
          height: barHeight - 4,
          backgroundColor: color,
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          px: 0.75,
          overflow: 'hidden',
          opacity: reservation.status === 'cancelled' ? 0.5 : 0.9,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          '&:hover': {
            opacity: 1,
            boxShadow: `0 2px 8px ${color}60`,
            zIndex: 1,
          },
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.6875rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: reservation.status === 'cancelled' ? 'line-through' : 'none',
          }}
        >
          {width > 60 ? reservation.guestName : reservation.guestName.split(' ')[0]}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ─── InterventionBar Sub-component ──────────────────────────────────────────

interface InterventionBarProps {
  intervention: PlanningIntervention;
  days: Date[];
  rangeStart: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
}

function InterventionBar({ intervention, days, rangeStart, topOffset, barHeight, dayColWidth }: InterventionBarProps) {
  const startDate = toDateOnly(intervention.startDate);
  const endDate = toDateOnly(intervention.endDate);

  // Calculate position relative to the visible range
  const startOffset = daysBetween(rangeStart, startDate);
  // Add 1 because an intervention that starts and ends on the same day should still occupy 1 column
  const endOffset = daysBetween(rangeStart, endDate) + 1;

  // Clamp to visible range
  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  // Not visible in current range
  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  const left = visibleStart * dayColWidth;
  const width = (visibleEnd - visibleStart) * dayColWidth;
  const color = INTERVENTION_TYPE_COLORS[intervention.type];
  const typeLabel = INTERVENTION_TYPE_LABELS[intervention.type];
  const statusLabel = INTERVENTION_STATUS_LABELS[intervention.status];

  const startStr = startDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const endStr = endDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const isSingleDay = intervention.startDate === intervention.endDate;

  const tooltipContent = [
    `${typeLabel} \xB7 ${statusLabel}`,
    intervention.title,
    `${intervention.assigneeName}`,
    isSingleDay ? startStr : `${startStr} \u2192 ${endStr}`,
    `~${intervention.estimatedDurationHours}h`,
    intervention.notes || '',
  ]
    .filter(Boolean)
    .join('\n');

  // Use stripes pattern for completed interventions
  const isCompleted = intervention.status === 'completed';
  const isCancelled = intervention.status === 'cancelled';

  return (
    <Tooltip
      title={
        <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', lineHeight: 1.5 }}>
          {tooltipContent}
        </Box>
      }
      arrow
      placement="bottom"
    >
      <Box
        sx={{
          position: 'absolute',
          top: topOffset,
          left: left,
          width: Math.max(width - 4, 16),
          height: barHeight - 4,
          backgroundColor: isCancelled ? '#9e9e9e' : color,
          borderRadius: '3px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          px: 0.5,
          overflow: 'hidden',
          opacity: isCompleted ? 0.55 : isCancelled ? 0.4 : 0.85,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          backgroundImage: isCompleted
            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 5px)`
            : 'none',
          '&:hover': {
            opacity: 1,
            boxShadow: `0 2px 6px ${color}50`,
            zIndex: 1,
          },
        }}
      >
        {/* Type icon */}
        {width > 40 && (
          intervention.type === 'cleaning'
            ? <CleaningServices sx={{ fontSize: 11, color: '#fff', mr: 0.25, flexShrink: 0 }} />
            : <Build sx={{ fontSize: 11, color: '#fff', mr: 0.25, flexShrink: 0 }} />
        )}
        <Typography
          variant="caption"
          sx={{
            color: '#fff',
            fontWeight: 600,
            fontSize: '0.5625rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textDecoration: isCancelled ? 'line-through' : 'none',
          }}
        >
          {width > 80 ? intervention.title : typeLabel}
        </Typography>
      </Box>
    </Tooltip>
  );
}
