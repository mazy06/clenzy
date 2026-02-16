import React, { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  IconButton,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
  Switch,
  FormControlLabel,
  useTheme,
  useMediaQuery,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Today as TodayIcon,
  Home,
  CleaningServices,
  Build,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useTranslation } from '../../hooks/useTranslation';
import { useDashboardPlanning } from '../../hooks/useDashboardPlanning';
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
const BAR_ROW_HEIGHT = 36;
const ROW_PADDING = 4;
const PROPERTIES_PER_PAGE = 8;
const GRADUATION_ROW_HEIGHT = 10;

// ─── Zoom system ─────────────────────────────────────────────────────────────

const HOUR_RANGE_START = 0;
const HOUR_RANGE_END = 24;
const TOTAL_HOURS = HOUR_RANGE_END - HOUR_RANGE_START; // 24

type ZoomLevel = 'compact' | 'standard' | 'detailed';

const ZOOM_CONFIG: Record<ZoomLevel, { dayWidth: number; marks: number[]; label: string }> = {
  compact:  { dayWidth: 38,  marks: [], label: 'J' },
  standard: { dayWidth: 136, marks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], label: '1H' },
  detailed: { dayWidth: 260, marks: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16, 16.5, 17, 17.5, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5, 22, 22.5, 23, 23.5], label: '30m' },
};

// ─── Filter options ──────────────────────────────────────────────────────────

const STATUS_FILTER_OPTIONS: { value: ReservationStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous' },
  { value: 'confirmed', label: 'Confirmees' },
  { value: 'pending', label: 'En attente' },
  { value: 'checked_in', label: 'Check-in' },
  { value: 'checked_out', label: 'Check-out' },
  { value: 'cancelled', label: 'Annulees' },
];

const INTERVENTION_FILTER_OPTIONS: { value: PlanningInterventionType | 'all'; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'cleaning', label: 'Menage' },
  { value: 'maintenance', label: 'Maintenance' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSameDay(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function toDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatMonth(date: Date): string {
  return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function daysBetween(d1: Date, d2: Date): number {
  const ms = d2.getTime() - d1.getTime();
  return Math.round(ms / 86400000);
}

/** Returns pixel offset within a day cell for a given time string (HH:mm).
 *  Returns 0 in compact mode (dayColWidth <= 38). */
function getHourOffsetPx(timeStr: string | undefined, dayColWidth: number): number {
  if (!timeStr || dayColWidth <= 38) return 0;
  const parts = timeStr.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1] || '0', 10);
  const hourDecimal = h + m / 60;
  const clamped = Math.max(HOUR_RANGE_START, Math.min(HOUR_RANGE_END, hourDecimal));
  return ((clamped - HOUR_RANGE_START) / TOTAL_HOURS) * dayColWidth;
}

const WEEKDAY_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aou', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Hook: mesure dynamique de la largeur du conteneur ──────────────────────

function useContainerWidth(): [React.RefCallback<HTMLDivElement>, number] {
  const [width, setWidth] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const refCallback = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }
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

  useEffect(() => {
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, []);

  return [refCallback, width];
}

// ─── Compute month separators for header ────────────────────────────────────

interface MonthSeparator {
  month: number;
  year: number;
  label: string;
  startIndex: number;
  count: number;
}

function computeMonthSeparators(days: Date[]): MonthSeparator[] {
  if (days.length === 0) return [];
  const seps: MonthSeparator[] = [];
  let currentMonth = -1;
  let currentYear = -1;

  for (let i = 0; i < days.length; i++) {
    const m = days[i].getMonth();
    const y = days[i].getFullYear();
    if (m !== currentMonth || y !== currentYear) {
      seps.push({ month: m, year: y, label: `${MONTH_SHORT[m]} ${y}`, startIndex: i, count: 1 });
      currentMonth = m;
      currentYear = y;
    } else {
      seps[seps.length - 1].count++;
    }
  }
  return seps;
}

// ─── CSS gradient for hour tick marks (zero DOM overhead) ───────────────────

function buildHourTickGradient(zoomLevel: ZoomLevel, darkMode: boolean): string {
  const marks = ZOOM_CONFIG[zoomLevel].marks;
  if (marks.length === 0) return 'none';
  const stops = marks.map((h) => {
    const pct = ((h - HOUR_RANGE_START) / TOTAL_HOURS) * 100;
    const isHalfHour = !Number.isInteger(h);
    const color = h === 12
      ? 'rgba(25,118,210,0.18)'
      : isHalfHour
        ? (darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)')
        : (darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)');
    return `transparent calc(${pct}% - 0.5px), ${color} calc(${pct}% - 0.5px), ${color} calc(${pct}% + 0.5px), transparent calc(${pct}% + 0.5px)`;
  });
  return `linear-gradient(to right, ${stops.join(', ')})`;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface DashboardPlanningProps {
  forfait?: string;
}

export default function DashboardPlanning({ forfait }: DashboardPlanningProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const {
    properties,
    loading,
    loadingMore,
    error,
    currentDate,
    goToday,
    goPrev,
    goNext,
    extendRange,
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

  // ─── Zoom level ──────────────────────────────────────────────────────────
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>(isMobile ? 'compact' : 'standard');
  const dayColWidth = ZOOM_CONFIG[zoomLevel].dayWidth;
  const hourTickGradient = useMemo(() => buildHourTickGradient(zoomLevel, isDark), [zoomLevel, isDark]);
  const hasGraduation = ZOOM_CONFIG[zoomLevel].marks.length > 0;

  // ─── Compute sticky top offsets for header rows ────────────────────────
  const monthRowHeight = 24;
  const dayRowHeight = 38;
  const hasMonthRow = useMemo(() => computeMonthSeparators(days).length > 1, [days]);
  const dayRowTop = hasMonthRow ? monthRowHeight : 0;
  const graduationRowTop = dayRowTop + dayRowHeight;

  // ─── Pagination des proprietes ──────────────────────────────────────────
  const [propertyPage, setPropertyPage] = useState(0);
  const totalPropertyPages = Math.max(1, Math.ceil(properties.length / PROPERTIES_PER_PAGE));

  useEffect(() => {
    setPropertyPage(0);
  }, [properties.length]);

  const paginatedProperties = useMemo(() => {
    const start = propertyPage * PROPERTIES_PER_PAGE;
    return properties.slice(start, start + PROPERTIES_PER_PAGE);
  }, [properties, propertyPage]);

  // ─── Mois visible dynamique ──────────────────────────────────────────────
  const [visibleMonth, setVisibleMonth] = useState<Date | null>(null);
  const [visibleMonthKey, setVisibleMonthKey] = useState('');

  // ─── Scroll horizontal vers aujourd'hui au montage (une seule fois) ─────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hasScrolledToTodayRef = useRef(false);
  const daysRef = useRef(days);

  // Keep daysRef in sync — avoids recreating callbacks when days change
  useEffect(() => { daysRef.current = days; }, [days]);

  // One-shot scroll to today on initial load (and after goToday resets the flag)
  // IMPORTANT: `loading` is a dependency so the effect re-fires when loading transitions
  // from true→false. When loading=true, the component renders a spinner (not the scroll
  // container), so scrollContainerRef.current is null. Adding loading ensures we retry
  // once the grid DOM is actually rendered.
  useEffect(() => {
    if (loading || hasScrolledToTodayRef.current || days.length === 0) return;
    const timer = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const todayIndex = days.findIndex((d) => isSameDay(d, today));
      if (todayIndex >= 0) {
        // Positionner today au bord gauche (juste après la colonne logement)
        scrollContainerRef.current.scrollLeft = todayIndex * dayColWidth;
        hasScrolledToTodayRef.current = true;
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [loading, days, today, dayColWidth]);

  // ─── Preservation du scroll lors du changement de zoom ──────────────────
  const prevDayColWidthRef = useRef(dayColWidth);
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el && prevDayColWidthRef.current !== dayColWidth && prevDayColWidthRef.current > 0) {
      // Trouver le jour actuellement centre
      const centerX = el.scrollLeft + el.clientWidth / 2 - PROPERTY_COL_WIDTH;
      const centerDayIndex = Math.floor(centerX / prevDayColWidthRef.current);
      // Re-scroller pour recentrer sur le meme jour
      const newScrollLeft = centerDayIndex * dayColWidth - el.clientWidth / 2 + PROPERTY_COL_WIDTH;
      el.scrollLeft = Math.max(0, newScrollLeft);
    }
    prevDayColWidthRef.current = dayColWidth;
  }, [dayColWidth]);

  // ─── Infinite scroll + detection du mois visible ────────────────────────
  // Uses daysRef to avoid recreating this callback when days array grows (extendRange)
  const computeVisibleMonth = useCallback(() => {
    const el = scrollContainerRef.current;
    const currentDays = daysRef.current;
    if (!el || currentDays.length === 0) return;

    const visibleX = el.scrollLeft + el.clientWidth * 0.33 - PROPERTY_COL_WIDTH;
    const dayIndex = Math.floor(Math.max(0, visibleX) / dayColWidth);
    const clampedIndex = Math.min(dayIndex, currentDays.length - 1);
    const visibleDay = currentDays[clampedIndex];
    if (visibleDay) {
      const key = `${visibleDay.getFullYear()}-${String(visibleDay.getMonth() + 1).padStart(2, '0')}`;
      setVisibleMonthKey(key);
      setVisibleMonth(new Date(visibleDay.getFullYear(), visibleDay.getMonth(), 1));
    }
  }, [dayColWidth]);

  // Debounce ref for extend range — prevents multiple rapid calls during fast scroll
  const extendDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGridScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    // Always update visible month immediately (cheap operation)
    computeVisibleMonth();

    // Debounce the extendRange check to avoid rapid-fire calls
    if (extendDebounceRef.current) {
      clearTimeout(extendDebounceRef.current);
    }
    extendDebounceRef.current = setTimeout(() => {
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) return;
      const threshold = scrollEl.scrollWidth * 0.8;
      if (scrollEl.scrollLeft + scrollEl.clientWidth >= threshold) {
        extendRange();
      }
    }, 300);
  }, [extendRange, computeVisibleMonth]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (extendDebounceRef.current) clearTimeout(extendDebounceRef.current);
    };
  }, []);

  // Initial visible month detection after data loads
  useEffect(() => {
    if (daysRef.current.length > 0) {
      const timer = setTimeout(computeVisibleMonth, 200);
      return () => clearTimeout(timer);
    }
  }, [computeVisibleMonth]);

  // ─── Convertir le scroll vertical en horizontal ─────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (el.scrollWidth > el.clientWidth && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
      handleGridScroll();
    }
  }, [handleGridScroll]);

  // ─── Mesure dynamique de la largeur ─────────────────────────────────────
  const [containerRef] = useContainerWidth();

  const gridWidth = PROPERTY_COL_WIDTH + days.length * dayColWidth;
  const monthSeparators = useMemo(() => computeMonthSeparators(days), [days]);

  // ─── Group data by property ─────────────────────────────────────────────
  const reservationsByProperty = useMemo(() => {
    const map = new Map<number, Reservation[]>();
    filteredReservations.forEach((r) => {
      const list = map.get(r.propertyId) || [];
      list.push(r);
      map.set(r.propertyId, list);
    });
    return map;
  }, [filteredReservations]);

  const interventionsByProperty = useMemo(() => {
    const map = new Map<number, PlanningIntervention[]>();
    filteredInterventions.forEach((i) => {
      const list = map.get(i.propertyId) || [];
      list.push(i);
      map.set(i.propertyId, list);
    });
    return map;
  }, [filteredInterventions]);

  const totalRowHeight = BAR_ROW_HEIGHT + ROW_PADDING * 2
    + (showInterventions ? BAR_ROW_HEIGHT + ROW_PADDING : 0);

  // ─── Stats filtrees par mois visible ────────────────────────────────────
  const visibleReservationCount = useMemo(() => {
    if (!visibleMonthKey) return filteredReservations.length;
    const [y, m] = visibleMonthKey.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return filteredReservations.filter(r => r.checkOut >= monthStart && r.checkIn <= monthEnd).length;
  }, [visibleMonthKey, filteredReservations]);

  const visibleInterventionCount = useMemo(() => {
    if (!visibleMonthKey) return filteredInterventions.length;
    const [y, m] = visibleMonthKey.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    return filteredInterventions.filter(i => i.endDate >= monthStart && i.startDate <= monthEnd).length;
  }, [visibleMonthKey, filteredInterventions]);

  // ─── Title ──────────────────────────────────────────────────────────────
  const titleDate = visibleMonth ? visibleMonth : currentDate;
  const titleText = formatMonth(titleDate);

  // ─── Loading / Error ────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ─── Toolbar ─────────────────────────────────────────────────────── */}
      <Paper sx={{ p: 1, mb: 1, flexShrink: 0 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>

          {/* Zoom toggle */}
          <ToggleButtonGroup
            value={zoomLevel}
            exclusive
            onChange={(_, v) => v && setZoomLevel(v as ZoomLevel)}
            size="small"
            sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: '0.6875rem', textTransform: 'none' } }}
          >
            <ToggleButton value="compact">
              <Tooltip title="Jours"><Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>J</Typography></Tooltip>
            </ToggleButton>
            <ToggleButton value="standard">
              <Tooltip title="1 heure"><Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>1H</Typography></Tooltip>
            </ToggleButton>
            <ToggleButton value="detailed">
              <Tooltip title="30 minutes"><Typography sx={{ fontSize: '0.6875rem', fontWeight: 600 }}>30m</Typography></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Navigation */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
            <IconButton size="small" onClick={goPrev}>
              <ChevronLeft sx={{ fontSize: 20 }} />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TodayIcon sx={{ fontSize: 14 }} />}
              onClick={() => { hasScrolledToTodayRef.current = false; goToday(); }}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1, py: 0.25, minWidth: 'auto' }}
            >
              {t('dashboard.planning.today') || "Aujourd'hui"}
            </Button>
            <IconButton size="small" onClick={goNext}>
              <ChevronRight sx={{ fontSize: 20 }} />
            </IconButton>
          </Box>

          {/* Title */}
          <Typography variant="subtitle2" fontWeight={600} sx={{ fontSize: '0.8125rem', textTransform: 'capitalize' }}>
            {titleText}
          </Typography>

          <Box sx={{ flex: 1 }} />

          {/* Stats */}
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
            {visibleReservationCount} resa
            {showInterventions && <> &middot; {visibleInterventionCount} inter.</>}
            {' \u00B7 '}
            {properties.length} logement{properties.length > 1 ? 's' : ''}
          </Typography>

          {/* Legend */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
              Resa :
            </Typography>
            {STATUS_FILTER_OPTIONS.filter((s) => s.value !== 'all').map((opt) => (
              <Box key={opt.value} sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus], flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.5625rem', color: RESERVATION_STATUS_COLORS[opt.value as ReservationStatus], fontWeight: 600 }}>
                  {opt.label}
                </Typography>
              </Box>
            ))}
            {showInterventions && (
              <>
                <Box sx={{ width: '1px', height: 12, backgroundColor: 'divider', mx: 0.25 }} />
                <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.625rem', color: 'text.secondary' }}>
                  Inter. :
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <CleaningServices sx={{ fontSize: 10, color: INTERVENTION_TYPE_COLORS.cleaning }} />
                  <Typography variant="caption" sx={{ fontSize: '0.5625rem', color: INTERVENTION_TYPE_COLORS.cleaning, fontWeight: 600 }}>
                    {INTERVENTION_TYPE_LABELS.cleaning}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <Build sx={{ fontSize: 10, color: INTERVENTION_TYPE_COLORS.maintenance }} />
                  <Typography variant="caption" sx={{ fontSize: '0.5625rem', color: INTERVENTION_TYPE_COLORS.maintenance, fontWeight: 600 }}>
                    {INTERVENTION_TYPE_LABELS.maintenance}
                  </Typography>
                </Box>
              </>
            )}
          </Box>

          {/* Intervention toggle */}
          <FormControlLabel
            control={<Switch size="small" checked={showInterventions} onChange={(e) => setShowInterventions(e.target.checked)} />}
            label={<Typography variant="caption" sx={{ fontSize: '0.6875rem' }}>Interventions</Typography>}
            sx={{ mr: 0, ml: 0 }}
          />

          {/* Intervention type filter */}
          {showInterventions && (
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel sx={{ fontSize: '0.75rem' }}>Type</InputLabel>
              <Select
                value={interventionTypeFilter}
                label="Type"
                onChange={(e) => setInterventionTypeFilter(e.target.value as PlanningInterventionType | 'all')}
                sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
              >
                {INTERVENTION_FILTER_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.75rem' }}>{opt.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Status filter */}
          <FormControl size="small" sx={{ minWidth: 110 }}>
            <InputLabel sx={{ fontSize: '0.75rem' }}>Statut</InputLabel>
            <Select
              value={statusFilter}
              label="Statut"
              onChange={(e) => setStatusFilter(e.target.value as ReservationStatus | 'all')}
              sx={{ fontSize: '0.75rem', '& .MuiSelect-select': { py: 0.5 } }}
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '0.75rem' }}>{opt.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {/* ─── Grid content ───────────────────────────────────────────────── */}
      {properties.length === 0 ? (
        forfait?.toLowerCase() === 'essentiel' ? (
          <Paper sx={{ p: 4, textAlign: 'center', borderLeft: '4px solid', borderColor: 'primary.main', borderRadius: '12px' }}>
            <Box sx={{ width: 56, height: 56, borderRadius: '50%', bgcolor: 'rgba(107,138,154,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <LockIcon sx={{ fontSize: 28, color: 'primary.main' }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', mb: 0.5 }}>
              Planning non disponible avec le forfait Essentiel
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.6, maxWidth: 480, mx: 'auto' }}>
              Votre forfait actuel ne permet pas l'acces au planning interactif ni a l'import
              automatique de vos calendriers Airbnb, Booking et autres plateformes.
              Passez au forfait Confort ou Premium pour debloquer cette fonctionnalite.
            </Typography>
          </Paper>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Home sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.secondary">
              {t('dashboard.planning.noProperties') || 'Aucun logement a afficher'}
            </Typography>
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
              {t('dashboard.planning.noPropertiesHint') || "Les logements apparaitront ici une fois qu'ils seront crees et assignes."}
            </Typography>
          </Paper>
        )
      ) : (
        <Paper
          ref={containerRef}
          sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
        >
          {/* Scrollable grid area */}
          <Box
            ref={scrollContainerRef}
            onScroll={handleGridScroll}
            onWheel={handleWheel}
            sx={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', WebkitOverflowScrolling: 'touch' }}
          >
            <Box sx={{ width: gridWidth, position: 'relative' }}>

              {/* ─── Month header row ──────────────────────────────────── */}
              {monthSeparators.length > 1 && (
                <Box sx={{ display: 'flex', position: 'sticky', top: 0, zIndex: 5, backgroundColor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 6, backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider' }} />
                  {monthSeparators.map((sep) => (
                    <Box key={`${sep.year}-${sep.month}`} sx={{ width: sep.count * dayColWidth, textAlign: 'center', py: 0.25, borderRight: '2px solid', borderColor: 'primary.light', backgroundColor: 'background.paper' }}>
                      <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.6875rem', textTransform: 'capitalize', color: 'primary.main' }}>
                        {sep.label}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              {/* ─── Header row (days — nom + numéro uniquement) ──────── */}
              <Box
                sx={{
                  display: 'flex',
                  position: 'sticky',
                  top: dayRowTop,
                  zIndex: 3,
                  backgroundColor: 'background.paper',
                  borderBottom: hasGraduation ? '1px solid' : '2px solid',
                  borderColor: 'divider',
                }}
              >
                {/* Property column header */}
                <Box
                  sx={{
                    width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0,
                    px: 1.5, py: 0.5, position: 'sticky', left: 0, zIndex: 4,
                    backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Typography variant="caption" fontWeight={700} sx={{ fontSize: '0.75rem' }}>
                    {t('dashboard.planning.property') || 'Logement'}
                  </Typography>
                </Box>

                {/* Day columns — seulement nom + numéro */}
                {days.map((day, idx) => {
                  const isToday = isSameDay(day, today);
                  const isPast = day < today && !isToday;
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                  return (
                    <Box
                      key={day.toISOString()}
                      sx={{
                        width: dayColWidth, minWidth: dayColWidth, textAlign: 'center',
                        py: 0.4,
                        borderRight: '1px solid',
                        borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                        borderRightWidth: isFirstOfMonth ? 2 : 1,
                        backgroundColor: isToday ? 'primary.main' : isPast ? (isDark ? theme.palette.grey[200] : '#e8e8e8') : isWeekend ? 'action.hover' : 'background.paper',
                        opacity: isPast ? 0.6 : 1,
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '0.5625rem', fontWeight: isToday ? 700 : 400, color: isToday ? 'primary.contrastText' : isPast ? 'text.disabled' : 'text.secondary', display: 'block', lineHeight: 1.2 }}>
                        {WEEKDAY_SHORT[day.getDay()]}
                      </Typography>
                      <Typography variant="caption" sx={{ fontSize: '0.6875rem', fontWeight: isToday ? 700 : 500, color: isToday ? 'primary.contrastText' : isPast ? 'text.disabled' : 'text.primary', display: 'block', lineHeight: 1.2 }}>
                        {day.getDate()}
                      </Typography>
                    </Box>
                  );
                })}
              </Box>

              {/* ─── Graduation row (heures / minutes — rangée séparée) ─ */}
              {hasGraduation && (
                <Box
                  sx={{
                    display: 'flex',
                    position: 'sticky',
                    top: graduationRowTop,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
                    borderBottom: '2px solid',
                    borderColor: 'divider',
                  }}
                >
                  {/* Property column spacer */}
                  <Box
                    sx={{
                      width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0,
                      position: 'sticky', left: 0, zIndex: 4,
                      backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider',
                      height: GRADUATION_ROW_HEIGHT,
                    }}
                  />

                  {/* Graduation tick marks per day (traits verticaux, sans labels) */}
                  {days.map((day, idx) => {
                    const isToday = isSameDay(day, today);
                    const isPast = day < today && !isToday;
                    const isFirstOfMonth = day.getDate() === 1 && idx > 0;
                    const hourMarks = ZOOM_CONFIG[zoomLevel].marks;

                    return (
                      <Box
                        key={`grad-${day.toISOString()}`}
                        sx={{
                          width: dayColWidth, minWidth: dayColWidth,
                          position: 'relative',
                          height: GRADUATION_ROW_HEIGHT,
                          borderRight: '1px solid',
                          borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                          borderRightWidth: isFirstOfMonth ? 2 : 1,
                          backgroundColor: isToday
                            ? 'rgba(25,118,210,0.08)'
                            : isPast
                              ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)')
                              : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)'),
                          opacity: isPast ? 0.5 : 1,
                        }}
                      >
                        {hourMarks.map((h) => {
                          const leftPct = ((h - HOUR_RANGE_START) / TOTAL_HOURS) * 100;
                          const isHalfHour = !Number.isInteger(h);
                          return (
                            <Box
                              key={h}
                              sx={{
                                position: 'absolute',
                                left: `${leftPct}%`,
                                top: 0,
                                width: '1px',
                                height: isHalfHour ? '40%' : '100%',
                                backgroundColor: isToday
                                  ? (isHalfHour ? 'rgba(25,118,210,0.2)' : 'rgba(25,118,210,0.4)')
                                  : (h === 12
                                    ? 'rgba(25,118,210,0.25)'
                                    : isHalfHour
                                      ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                                      : (isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)')),
                              }}
                            />
                          );
                        })}
                      </Box>
                    );
                  })}
                </Box>
              )}

              {/* ─── Property rows (paginated) ──────────────────────── */}
              {paginatedProperties.map((property, rowIndex) => {
                const propertyReservations = reservationsByProperty.get(property.id) || [];
                const propertyInterventions = interventionsByProperty.get(property.id) || [];
                const rowBg = rowIndex % 2 === 0
                  ? theme.palette.background.paper
                  : (isDark ? theme.palette.grey[200] : '#f5f5f5');

                return (
                  <Box
                    key={property.id}
                    sx={{
                      display: 'flex', position: 'relative', height: totalRowHeight,
                      borderBottom: '1px solid', borderColor: 'divider', backgroundColor: rowBg,
                      '&:hover': { backgroundColor: isDark ? theme.palette.grey[300] : '#ebebeb' },
                      '&:hover > .sticky-property-cell': { backgroundColor: isDark ? theme.palette.grey[300] : '#ebebeb' },
                    }}
                  >
                    {/* Property name cell */}
                    <Box
                      className="sticky-property-cell"
                      sx={{
                        width: PROPERTY_COL_WIDTH, minWidth: PROPERTY_COL_WIDTH, flexShrink: 0, px: 1.5,
                        display: 'flex', flexDirection: 'column', justifyContent: 'center',
                        position: 'sticky', left: 0, zIndex: 2, backgroundColor: rowBg,
                        borderRight: '1px solid', borderColor: 'divider', boxShadow: isDark ? '2px 0 4px rgba(0,0,0,0.3)' : '2px 0 4px rgba(0,0,0,0.08)',
                      }}
                    >
                      <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {property.name}
                      </Typography>
                      {property.ownerName && (
                        <Typography variant="caption" sx={{ fontSize: '0.625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'primary.main', fontWeight: 500 }}>
                          {property.ownerName}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.625rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {property.city || property.address}
                      </Typography>
                    </Box>

                    {/* Day cells background + bars */}
                    <Box sx={{ display: 'flex', position: 'relative', flex: 1 }}>
                      {days.map((day, idx) => {
                        const isToday = isSameDay(day, today);
                        const isPast = day < today && !isToday;
                        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                        const isFirstOfMonth = day.getDate() === 1 && idx > 0;

                        return (
                          <Box
                            key={day.toISOString()}
                            sx={{
                              width: dayColWidth, minWidth: dayColWidth, height: '100%',
                              borderRight: '1px solid',
                              borderColor: isFirstOfMonth ? 'primary.light' : 'divider',
                              borderRightWidth: isFirstOfMonth ? 2 : 1,
                              backgroundColor: isPast
                                ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')
                                : isToday
                                  ? 'rgba(25, 118, 210, 0.06)'
                                  : isWeekend
                                    ? (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)')
                                    : 'transparent',
                              backgroundImage: isPast ? 'none' : hourTickGradient,
                            }}
                          />
                        );
                      })}

                      {/* Reservation bars */}
                      {propertyReservations.map((reservation) => (
                        <MemoizedReservationBar
                          key={`res-${reservation.id}`}
                          reservation={reservation}
                          days={days}
                          rangeStart={dateRange.start}
                          topOffset={ROW_PADDING}
                          barHeight={BAR_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                          zoomLevel={zoomLevel}
                        />
                      ))}

                      {/* Intervention bars */}
                      {showInterventions && propertyInterventions.map((intervention) => (
                        <MemoizedInterventionBar
                          key={`int-${intervention.id}`}
                          intervention={intervention}
                          days={days}
                          rangeStart={dateRange.start}
                          topOffset={ROW_PADDING + BAR_ROW_HEIGHT + ROW_PADDING}
                          barHeight={BAR_ROW_HEIGHT}
                          dayColWidth={dayColWidth}
                          zoomLevel={zoomLevel}
                        />
                      ))}
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Loading indicator */}
          {loadingMore && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'action.hover', flexShrink: 0 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6875rem' }}>
                Chargement des mois suivants...
              </Typography>
            </Box>
          )}

          {/* Pagination */}
          {totalPropertyPages > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, py: 0.5, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper', flexShrink: 0 }}>
              <IconButton size="small" onClick={() => setPropertyPage((p) => Math.max(0, p - 1))} disabled={propertyPage === 0}>
                <ChevronLeft sx={{ fontSize: 18 }} />
              </IconButton>
              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {propertyPage * PROPERTIES_PER_PAGE + 1} - {Math.min((propertyPage + 1) * PROPERTIES_PER_PAGE, properties.length)} / {properties.length} logements
              </Typography>
              <IconButton size="small" onClick={() => setPropertyPage((p) => Math.min(totalPropertyPages - 1, p + 1))} disabled={propertyPage >= totalPropertyPages - 1}>
                <ChevronRight sx={{ fontSize: 18 }} />
              </IconButton>
            </Box>
          )}
        </Paper>
      )}
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
  zoomLevel: ZoomLevel;
}

function ReservationBar({ reservation, days, rangeStart, topOffset, barHeight, dayColWidth, zoomLevel }: ReservationBarProps) {
  const checkIn = toDateOnly(reservation.checkIn);
  const checkOut = toDateOnly(reservation.checkOut);
  const today = new Date();
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  const startOffset = daysBetween(rangeStart, checkIn);
  const endOffset = daysBetween(rangeStart, checkOut);

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  // Hour-level adjustments
  const checkInHourOffset = (startOffset >= 0 && zoomLevel !== 'compact')
    ? getHourOffsetPx(reservation.checkInTime, dayColWidth)
    : 0;
  const checkOutHourOffset = (endOffset <= days.length && zoomLevel !== 'compact')
    ? getHourOffsetPx(reservation.checkOutTime, dayColWidth)
    : 0;

  const left = visibleStart * dayColWidth + checkInHourOffset;
  const right = visibleEnd * dayColWidth + checkOutHourOffset;
  const width = right - left;

  // ─── Statut effectif basé sur la date du jour ─────────────────────────────
  // Si annulé/en attente, on garde le statut brut.
  // Sinon on calcule en fonction de checkIn/checkOut vs aujourd'hui.
  const effectiveStatus: ReservationStatus = (() => {
    if (reservation.status === 'cancelled' || reservation.status === 'pending') {
      return reservation.status;
    }
    if (todayOnly > checkOut) return 'checked_out';
    if (todayOnly >= checkIn && todayOnly <= checkOut) return 'checked_in';
    return reservation.status; // futur → confirmed
  })();

  const color = RESERVATION_STATUS_COLORS[effectiveStatus];
  const statusLabel = RESERVATION_STATUS_LABELS[effectiveStatus];
  const nights = daysBetween(checkIn, checkOut);
  const checkInStr = checkIn.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const checkOutStr = checkOut.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  const tooltipContent = [
    `${reservation.guestName} (${reservation.guestCount} pers.)`,
    `${checkInStr}${reservation.checkInTime ? ' ' + reservation.checkInTime : ''} \u2192 ${checkOutStr}${reservation.checkOutTime ? ' ' + reservation.checkOutTime : ''} (${nights} nuit${nights > 1 ? 's' : ''})`,
    `${statusLabel} \xB7 ${reservation.source.charAt(0).toUpperCase() + reservation.source.slice(1)}`,
    reservation.totalPrice > 0 ? `${reservation.totalPrice.toLocaleString('fr-FR')} \u20AC` : '',
  ].filter(Boolean).join('\n');

  return (
    <Tooltip title={<Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', lineHeight: 1.5 }}>{tooltipContent}</Box>} arrow placement="top">
      <Box
        sx={{
          position: 'absolute', top: topOffset, left: left,
          width: Math.max(width - 4, 16), height: barHeight - 4,
          backgroundColor: color, borderRadius: '14px', cursor: 'pointer',
          display: 'flex', alignItems: 'center', px: 1.5, overflow: 'hidden',
          opacity: effectiveStatus === 'cancelled' ? 0.5 : 0.9,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          '&:hover': { opacity: 1, boxShadow: `0 2px 8px ${color}60`, zIndex: 1 },
        }}
      >
        <Typography variant="caption" sx={{
          color: '#fff', fontWeight: 600, fontSize: '0.75rem', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: effectiveStatus === 'cancelled' ? 'line-through' : 'none',
        }}>
          {width > 60 ? reservation.guestName : reservation.guestName.split(' ')[0]}
        </Typography>
      </Box>
    </Tooltip>
  );
}

const MemoizedReservationBar = React.memo(ReservationBar, (prev, next) => {
  return prev.reservation.id === next.reservation.id
    && prev.dayColWidth === next.dayColWidth
    && prev.zoomLevel === next.zoomLevel
    && prev.topOffset === next.topOffset
    && prev.days.length === next.days.length;
});

// ─── InterventionBar Sub-component ──────────────────────────────────────────

interface InterventionBarProps {
  intervention: PlanningIntervention;
  days: Date[];
  rangeStart: Date;
  topOffset: number;
  barHeight: number;
  dayColWidth: number;
  zoomLevel: ZoomLevel;
}

function InterventionBar({ intervention, days, rangeStart, topOffset, barHeight, dayColWidth, zoomLevel }: InterventionBarProps) {
  const startDate = toDateOnly(intervention.startDate);
  const endDate = toDateOnly(intervention.endDate);

  const startOffset = daysBetween(rangeStart, startDate);
  const endOffset = daysBetween(rangeStart, endDate) + 1;

  const visibleStart = Math.max(0, startOffset);
  const visibleEnd = Math.min(days.length, endOffset);

  if (visibleStart >= days.length || visibleEnd <= 0) return null;

  // Hour-level adjustment — only for start position (anchor at start)
  const startHourOffset = (startOffset >= 0 && zoomLevel !== 'compact')
    ? getHourOffsetPx(intervention.startTime, dayColWidth)
    : 0;

  const left = visibleStart * dayColWidth + startHourOffset;

  // Minimum width to always show full label — anchored at start, ignore end clipping
  const MIN_BAR_WIDTH = 120;
  const width = Math.max(MIN_BAR_WIDTH, 16);

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
    isSingleDay
      ? `${startStr}${intervention.startTime ? ' ' + intervention.startTime : ''}${intervention.endTime ? ' \u2192 ' + intervention.endTime : ''}`
      : `${startStr} \u2192 ${endStr}`,
    `~${intervention.estimatedDurationHours}h`,
    intervention.notes || '',
  ].filter(Boolean).join('\n');

  const isCompleted = intervention.status === 'completed';
  const isCancelled = intervention.status === 'cancelled';

  return (
    <Tooltip title={<Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem', lineHeight: 1.5 }}>{tooltipContent}</Box>} arrow placement="bottom">
      <Box
        sx={{
          position: 'absolute', top: topOffset, left: left,
          width: width, height: barHeight - 4,
          backgroundColor: isCancelled ? '#9e9e9e' : color, borderRadius: '14px',
          cursor: 'pointer', display: 'flex', alignItems: 'center', px: 1, gap: 0.5, overflow: 'hidden',
          opacity: isCompleted ? 0.55 : isCancelled ? 0.4 : 0.85,
          transition: 'opacity 0.15s, box-shadow 0.15s',
          backgroundImage: isCompleted
            ? `repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.25) 3px, rgba(255,255,255,0.25) 5px)`
            : 'none',
          '&:hover': { opacity: 1, boxShadow: `0 2px 6px ${color}50`, zIndex: 1 },
        }}
      >
        {intervention.type === 'cleaning'
          ? <CleaningServices sx={{ fontSize: 12, color: '#fff', flexShrink: 0 }} />
          : <Build sx={{ fontSize: 12, color: '#fff', flexShrink: 0 }} />
        }
        <Typography variant="caption" sx={{
          color: '#fff', fontWeight: 600, fontSize: '0.5625rem', overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          textDecoration: isCancelled ? 'line-through' : 'none',
        }}>
          {intervention.title}
        </Typography>
      </Box>
    </Tooltip>
  );
}

const MemoizedInterventionBar = React.memo(InterventionBar, (prev, next) => {
  return prev.intervention.id === next.intervention.id
    && prev.dayColWidth === next.dayColWidth
    && prev.zoomLevel === next.zoomLevel
    && prev.topOffset === next.topOffset
    && prev.days.length === next.days.length;
});
